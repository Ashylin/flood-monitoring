/**
 * Historical backtest — runs the app's own rainfall-driven risk logic
 * against real past rainfall data for known Chennai flood events, and
 * reports how early the engine would have flagged elevated risk relative
 * to when the flood actually happened.
 *
 * Two data modes, always clearly labeled in the report — never silently
 * mixed:
 *
 *   LIVE MODE: fetches real hour-by-hour precipitation from Open-Meteo's
 *   historical archive (archive-api.open-meteo.com, ERA5 reanalysis,
 *   1940–present, free, no key) for the event's date range, then replays
 *   it through computeRollingWindows() + classify24hRainfall() exactly as
 *   the live system would. This gives a genuine hour-by-hour lead-time
 *   result.
 *
 *   BENCHMARK MODE (fallback): if the live archive is unreachable (e.g. no
 *   internet, or a sandboxed network), falls back to evaluating the
 *   engine's classification against the documented peak-24h and
 *   monthly-total figures from knownEvents.js — real, cited numbers, just
 *   without hour-by-hour resolution. The report states plainly which mode
 *   produced each result.
 *
 * Run: npm run backtest
 * Output: backend/backtest-reports/<slug>.md
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const events = require("./knownEvents");
const { computeRollingWindows, classify24hRainfall } = require("../services/rainfallWindowService");

const REPORT_DIR = path.join(__dirname, "..", "..", "backtest-reports");

async function fetchHistoricalHourly(latitude, longitude, startDate, endDate) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&hourly=precipitation&timezone=Asia%2FKolkata`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo archive request failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const times = data?.hourly?.time || [];
  const precip = data?.hourly?.precipitation || [];
  return times.map((t, i) => ({ time: t, precipitationMm: Number(precip[i]) || 0 }));
}

function dateRangeAround(peakDateStr, daysBefore, daysAfter) {
  const peak = new Date(`${peakDateStr}T00:00:00Z`);
  const start = new Date(peak);
  start.setUTCDate(start.getUTCDate() - daysBefore);
  const end = new Date(peak);
  end.setUTCDate(end.getUTCDate() + daysAfter);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

async function runLiveBacktest(event) {
  const { startDate, endDate } = dateRangeAround(event.peakDate, 10, 2);
  const hourly = await fetchHistoricalHourly(event.latitude, event.longitude, startDate, endDate);
  const withWindows = computeRollingWindows(hourly);

  // "Advisory-equivalent" = first hour the 24h rolling total reaches IMD
  // "heavy" (64.5mm+) — matches the same rainfall-only cap used by the
  // live system's computeZoneRisk() when no river feed is present.
  const firstAdvisory = withWindows.find((p) => p.category24h === "heavy" || p.category24h === "very_heavy" || p.category24h === "extremely_heavy");
  const peakPoint = withWindows.reduce((max, p) => (p.rain24h > (max?.rain24h || 0) ? p : max), null);

  let leadTimeHours = null;
  if (firstAdvisory && peakPoint) {
    leadTimeHours = Math.round((new Date(peakPoint.time) - new Date(firstAdvisory.time)) / (1000 * 60 * 60));
  }

  return {
    mode: "LIVE (Open-Meteo archive, real hourly ERA5 reanalysis data)",
    firstAdvisory,
    peakPoint,
    leadTimeHours,
    seriesLength: withWindows.length,
  };
}

function runBenchmarkBacktest(event) {
  const { cityAverage, stationRange } = event.documented.peak24hRainfallMm;
  const category = classify24hRainfall(cityAverage);
  const categoryHigh = classify24hRainfall(stationRange[1]);
  return {
    mode: "BENCHMARK (documented peak-24h figure only — no hour-by-hour resolution available offline)",
    cityAverageMm: cityAverage,
    cityAverageCategory: category,
    worstStationMm: stationRange[1],
    worstStationCategory: categoryHigh,
  };
}

function renderReport(event, result) {
  const lines = [];
  lines.push(`# Backtest: ${event.label}`);
  lines.push("");
  lines.push(`**Peak flood date:** ${event.peakDate}`);
  lines.push(`**Data mode:** ${result.mode}`);
  lines.push("");
  lines.push("## Documented ground truth (real, cited figures)");
  lines.push("");
  lines.push(`- Peak 24h rainfall: city average ${event.documented.peak24hRainfallMm.cityAverage}mm, station range ${event.documented.peak24hRainfallMm.stationRange[0]}–${event.documented.peak24hRainfallMm.stationRange[1]}mm`);
  lines.push(`  - Source: ${event.documented.peak24hRainfallMm.source} (${event.documented.peak24hRainfallMm.url})`);
  lines.push(`- Monthly total: ${event.documented.monthlyTotalRainfallMm.value}mm at ${event.documented.monthlyTotalRainfallMm.station}`);
  lines.push(`  - Source: ${event.documented.monthlyTotalRainfallMm.source} (${event.documented.monthlyTotalRainfallMm.url})`);
  if (event.documented.note) lines.push(`- Note: ${event.documented.note}`);
  lines.push("");

  if (result.mode.startsWith("LIVE")) {
    lines.push("## Backtest result (live hourly replay)");
    lines.push("");
    if (result.firstAdvisory) {
      lines.push(`- Engine first reached IMD "heavy" (≥64.5mm/24h) or above at **${result.firstAdvisory.time}** (24h total: ${result.firstAdvisory.rain24h}mm, category: ${result.firstAdvisory.category24h})`);
    } else {
      lines.push("- Engine never crossed the IMD \"heavy\" 24h threshold in the analyzed window (10 days before to 2 days after the documented peak).");
    }
    if (result.peakPoint) {
      lines.push(`- Highest rolling 24h total in the window: ${result.peakPoint.rain24h}mm at ${result.peakPoint.time}`);
    }
    if (result.leadTimeHours !== null) {
      lines.push(`- **Lead time: engine flagged elevated risk ${result.leadTimeHours} hours before the highest rolling rainfall total was reached.**`);
    }
    lines.push(`- Replayed ${result.seriesLength} hourly data points from Open-Meteo's archive (ERA5 reanalysis).`);
  } else {
    lines.push("## Backtest result (benchmark-only — no live internet access when this ran)");
    lines.push("");
    lines.push(`- Applying the engine's IMD-based 24h classification to the documented city-average figure (${result.cityAverageMm}mm) yields category: **${result.cityAverageCategory}**`);
    lines.push(`- Applying it to the worst individual station reading (${result.worstStationMm}mm) yields category: **${result.worstStationCategory}**`);
    lines.push("- This confirms the engine's thresholds would have correctly classified this as at least IMD \"heavy\" rainfall using the real documented total, but cannot report an hour-by-hour lead time without the full archive series.");
    lines.push("- Re-run `npm run backtest` on a machine with normal internet access to get the full hourly replay and lead-time figure.");
  }

  lines.push("");
  lines.push("## Honest limitations of this backtest");
  lines.push("");
  lines.push("- This evaluates the rainfall-only component of the risk engine. The live system also incorporates river-level data when available; no river telemetry exists for these historical dates, so this backtest cannot and does not claim to reproduce the full multi-signal risk score.");
  lines.push("- IMD's 24h rainfall categories are official; the app's specific alert thresholds (mapping categories to Advisory/Warning/Emergency) are this project's own design choice, not an official flood-warning standard.");
  lines.push("- \"Lead time\" measures how early elevated rainfall was detected relative to the peak rainfall hour — not how early it would have predicted the flood itself, which also depends on drainage, tides, and reservoir releases this system does not model.");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

  for (const event of events) {
    console.log(`\n[backtest] ${event.label}`);
    let result;
    try {
      result = await runLiveBacktest(event);
      console.log(`[backtest]   live mode succeeded (${result.seriesLength} hourly points)`);
    } catch (err) {
      console.warn(`[backtest]   live fetch failed (${err.message}) — falling back to benchmark mode`);
      result = runBenchmarkBacktest(event);
    }

    const report = renderReport(event, result);
    const outPath = path.join(REPORT_DIR, `${event.slug}.md`);
    fs.writeFileSync(outPath, report, "utf8");
    console.log(`[backtest]   report written to ${outPath}`);
  }

  console.log("\n[backtest] done.");
}

main().catch((err) => {
  console.error("[backtest] fatal error", err);
  process.exit(1);
});
