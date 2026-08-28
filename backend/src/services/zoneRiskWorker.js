/**
 * Periodically recomputes flood-zone risk from whatever real data currently
 * exists: live/manual/IoT river readings (if any) + live Open-Meteo rainfall.
 * Never invents a reading — a zone whose station has no feed connected gets
 * an explicit 'insufficient_data' result, never a silently-safe default.
 *
 * Uses the explainable risk engine (riskExplainer.js): every recompute
 * produces a 0-100 score and a plain-language list of reasons, both stored
 * alongside the risk_level bucket so the API/UI can show *why*, not just
 * *what*.
 */
const { query } = require("../config/db");
const { stationStatus } = require("./floodRiskService");
const { computeDetailedRisk, computeRateOfChange, dataFreshness } = require("./riskExplainer");

const RAINFALL_POLL_INTERVAL_HOURS = (Number(process.env.RAINFALL_POLL_INTERVAL_MS) || 15 * 60 * 1000) / 3600000;

/** Sums intensity_mm_hr readings from the last 6h, weighted by the polling
 * interval, to approximate a rolling 6h accumulation from data already in
 * Postgres — no extra external calls needed. */
async function get6hRainfall(districtId) {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const result = await query(
    "SELECT intensity_mm_hr FROM rainfall_readings WHERE district_id = $1 AND recorded_at >= $2",
    [districtId, sixHoursAgo]
  );
  return result.rows.reduce((sum, r) => sum + Number(r.intensity_mm_hr) * RAINFALL_POLL_INTERVAL_HOURS, 0);
}

async function getRateOfChange(stationId) {
  const readings = await query(
    "SELECT water_level, recorded_at FROM river_readings WHERE station_id = $1 ORDER BY recorded_at DESC LIMIT 1"
  , [stationId]);
  if (!readings.rows.length) return computeRateOfChange(null, null, null);

  const current = readings.rows[0];
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const priorResult = await query(
    "SELECT water_level, recorded_at FROM river_readings WHERE station_id = $1 AND recorded_at <= $2 ORDER BY recorded_at DESC LIMIT 1",
    [stationId, oneHourAgo]
  );
  if (!priorResult.rows.length) return computeRateOfChange(null, null, null);

  const prior = priorResult.rows[0];
  const hours = (new Date(current.recorded_at) - new Date(prior.recorded_at)) / 3600000;
  return computeRateOfChange(Number(current.water_level), Number(prior.water_level), hours);
}

async function recomputeZones(io) {
  const zonesRes = await query("SELECT * FROM flood_zones");

  for (const zone of zonesRes.rows) {
    let station = null;
    let reading = null;
    let rateOfChange = { ratePerHour: null, rapidRise: false };

    if (zone.station_id) {
      const stationRes = await query("SELECT * FROM stations WHERE id = $1", [zone.station_id]);
      station = stationRes.rows[0] || null;
      if (station) {
        const readingRes = await query(
          "SELECT * FROM river_readings WHERE station_id = $1 ORDER BY recorded_at DESC LIMIT 1",
          [station.id]
        );
        reading = readingRes.rows[0] || null;
        rateOfChange = await getRateOfChange(station.id);
      }
    }

    const districtRes = await query("SELECT id FROM districts WHERE name = $1", [zone.district]);
    let rain24h = 0;
    let rain6h = 0;
    let rainfallFreshness = null;
    if (districtRes.rows.length) {
      const districtId = districtRes.rows[0].id;
      const rainRes = await query(
        "SELECT * FROM rainfall_readings WHERE district_id = $1 ORDER BY recorded_at DESC LIMIT 1",
        [districtId]
      );
      if (rainRes.rows[0]) {
        rain24h = Number(rainRes.rows[0].accumulated_24h_mm);
        rainfallFreshness = dataFreshness(rainRes.rows[0].recorded_at);
      }
      rain6h = await get6hRainfall(districtId);
    }

    const riverStatus = stationStatus(reading, station);
    const riverFreshness = reading ? dataFreshness(reading.recorded_at) : null;

    const detailed = computeDetailedRisk({
      riverStatus,
      riverFreshness,
      rain6hMm: rain6h,
      rain24hMm: rain24h,
      rainfallFreshness,
      rateOfChange,
      stationName: station?.name,
      zoneName: zone.name,
    });

    const freshnessSummary =
      riverFreshness?.status === "stale" || rainfallFreshness?.status === "stale" ? "stale" : reading || rain24h > 0 ? "fresh" : "no_data";

    const changed = detailed.level !== zone.risk_level || detailed.score !== zone.risk_score;
    if (changed) {
      const updated = await query(
        `UPDATE flood_zones
         SET risk_level = $1, risk_score = $2, risk_reason = $3, data_freshness = $4, updated_at = now()
         WHERE id = $5 RETURNING *`,
        [detailed.level, detailed.score, detailed.reasonSummary, freshnessSummary, zone.id]
      );
      io.emit("zone:update", updated.rows[0]);

      if ((detailed.level === "critical" || detailed.level === "high") && zone.risk_level !== detailed.level) {
        const severity = detailed.level === "critical" ? "emergency" : "warning";
        const alertRes = await query(
          `INSERT INTO alerts (zone_id, station_id, severity, title, message, created_by)
           VALUES ($1,$2,$3,$4,$5,'auto-monitor') RETURNING *`,
          [
            zone.id,
            station ? station.id : null,
            severity,
            `${detailed.level === "critical" ? "CRITICAL" : "Elevated"} flood risk: ${zone.name} (score ${detailed.score}/100)`,
            `Automated monitoring escalated ${zone.name} (${zone.district}) to ${detailed.level.toUpperCase()} risk. Reason: ${detailed.reasonSummary}`,
          ]
        );
        io.emit("alert:new", alertRes.rows[0]);
      }
    }
  }
}

function startZoneRiskWorker(io, { intervalMs = 5 * 60 * 1000 } = {}) {
  recomputeZones(io).catch((err) => console.error("[zone-risk-worker] initial run failed", err.message));
  const timer = setInterval(() => {
    recomputeZones(io).catch((err) => console.error("[zone-risk-worker] tick failed", err.message));
  }, intervalMs);
  console.log(`[zone-risk-worker] started — recomputing risk every ${intervalMs / 60000} min`);
  return () => clearInterval(timer);
}

module.exports = { startZoneRiskWorker, recomputeZones };
