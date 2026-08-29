/**
 * Serves historical backtest timelines: real historical rainfall replayed
 * through the exact same risk engine (riskExplainer.computeDetailedRisk)
 * that scores live/demo zone risk — never a separate scoring function.
 * Read-only, no auth (public historical/educational data).
 */
const { query } = require("../config/db");
const events = require("../backtest/knownEvents");
const { computeRollingWindows } = require("../services/rainfallWindowService");
const { computeDetailedRisk } = require("../services/riskExplainer");

async function listEvents(req, res, next) {
  try {
    const rows = await query(
      "SELECT event_slug, count(*) AS point_count, min(recorded_at) AS from_time, max(recorded_at) AS to_time FROM historical_rainfall_hourly GROUP BY event_slug"
    );
    const seededSlugs = new Set(rows.rows.map((r) => r.event_slug));
    const available = events
      .filter((e) => seededSlugs.has(e.slug))
      .map((e) => ({ slug: e.slug, label: e.label, peakDate: e.peakDate }));
    res.json({ success: true, data: available });
  } catch (err) {
    next(err);
  }
}

async function getBacktest(req, res, next) {
  try {
    const { slug } = req.params;
    const event = events.find((e) => e.slug === slug);
    if (!event) {
      const err = new Error("Unknown historical event");
      err.status = 404;
      throw err;
    }

    const rowsRes = await query(
      "SELECT recorded_at, precipitation_mm FROM historical_rainfall_hourly WHERE event_slug = $1 ORDER BY recorded_at ASC",
      [slug]
    );
    if (!rowsRes.rows.length) {
      const err = new Error(
        "No historical rainfall seeded yet for this event — the seed step (backend/src/backtest/seedHistoricalRainfall.js) " +
          "runs on server boot and requires real outbound internet access to Open-Meteo's archive API."
      );
      err.status = 404;
      throw err;
    }

    const hourly = rowsRes.rows.map((r) => ({ time: r.recorded_at.toISOString(), precipitationMm: Number(r.precipitation_mm) }));
    const withWindows = computeRollingWindows(hourly);

    // riverStatus is hardcoded 'no_feed' — no historical river-gauge data
    // exists for this event, so this is the exact same code path a live
    // zone with no connected river feed goes through today.
    const timeline = withWindows.map((point) => {
      const detailed = computeDetailedRisk({
        riverStatus: "no_feed",
        riverFreshness: null,
        rain6hMm: point.rain6h,
        rain24hMm: point.rain24h,
        rainfallFreshness: null,
        rateOfChange: { ratePerHour: null, rapidRise: false },
        stationName: null,
        zoneName: event.label,
      });
      return {
        time: point.time,
        precipitationMm: point.precipitationMm,
        rain6h: point.rain6h,
        rain24h: point.rain24h,
        category24h: point.category24h,
        riskScore: detailed.score,
        riskLevel: detailed.level,
        reasonSummary: detailed.reasonSummary,
      };
    });

    const peakScorePoint = timeline.reduce((max, p) => (p.riskScore > (max?.riskScore ?? -1) ? p : max), null);
    const firstMediumPoint = timeline.find((p) => p.riskLevel === "medium") || null;
    const documentedPeakIso = `${event.peakDate}T12:00:00Z`; // documented peak is a date, not a timestamp — noon UTC as a neutral reference point
    const leadTimeHoursBeforeDocumentedPeak = firstMediumPoint
      ? Math.round((new Date(documentedPeakIso) - new Date(firstMediumPoint.time)) / 3600000)
      : null;

    res.json({
      success: true,
      data: {
        event: {
          slug: event.slug,
          label: event.label,
          peakDate: event.peakDate,
          documented: event.documented,
        },
        dataSource: {
          hourlyReplay: "Open-Meteo Historical Weather API — ERA5 reanalysis (ECMWF/Copernicus), archive-api.open-meteo.com",
          groundTruthFigures: "See event.documented sources above (World Weather Attribution / IMD via news reporting)",
        },
        timeline,
        summary: {
          peakScorePoint,
          firstMediumPoint,
          leadTimeHoursBeforeDocumentedPeak,
          maxAttainableLevelNote:
            "This replay uses only rainfall (no historical river-gauge data exists for this event). The engine caps rainfall-only " +
            "risk below 'high'/'critical' by design — those levels require live river-gauge confirmation, same rule as the live system.",
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listEvents, getBacktest };
