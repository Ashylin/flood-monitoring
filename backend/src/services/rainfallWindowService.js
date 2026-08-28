/**
 * Rolling rainfall-window utilities, shared by the live rainfall ingestion
 * (via accumulated windows) and the historical backtest. Pure functions —
 * no DB/network — so they're trivially unit-testable.
 *
 * Rainfall categories follow India Meteorological Department (IMD)
 * standard 24h classification (publicly documented, e.g. IMD's rainfall
 * terminology bulletins):
 *   Light            2.5 – 15.5 mm / 24h
 *   Moderate         15.6 – 64.4 mm / 24h
 *   Heavy            64.5 – 115.5 mm / 24h
 *   Very Heavy       115.6 – 204.4 mm / 24h
 *   Extremely Heavy  > 204.4 mm / 24h
 *
 * IMD does not publish an official 6h classification, so the 6h helper
 * here is our own proportional derivation (24h thresholds / 4), clearly
 * labeled as such rather than presented as an official IMD standard.
 */

const IMD_24H_THRESHOLDS_MM = {
  light: 2.5,
  moderate: 15.6,
  heavy: 64.5,
  veryHeavy: 115.6,
  extremelyHeavy: 204.5,
};

function classify24hRainfall(mm) {
  if (mm >= IMD_24H_THRESHOLDS_MM.extremelyHeavy) return "extremely_heavy";
  if (mm >= IMD_24H_THRESHOLDS_MM.veryHeavy) return "very_heavy";
  if (mm >= IMD_24H_THRESHOLDS_MM.heavy) return "heavy";
  if (mm >= IMD_24H_THRESHOLDS_MM.moderate) return "moderate";
  if (mm >= IMD_24H_THRESHOLDS_MM.light) return "light";
  return "negligible";
}

/**
 * Given a chronological array of { time, precipitationMm } hourly points,
 * returns the same length array with rolling 6h and 24h sums attached at
 * each point (using only points at or before that hour — a real backend
 * only ever knows the past, so the backtest must respect that too).
 */
function computeRollingWindows(hourlyPoints) {
  const out = [];
  for (let i = 0; i < hourlyPoints.length; i += 1) {
    const window6 = hourlyPoints.slice(Math.max(0, i - 5), i + 1);
    const window24 = hourlyPoints.slice(Math.max(0, i - 23), i + 1);
    const rain6h = window6.reduce((sum, p) => sum + p.precipitationMm, 0);
    const rain24h = window24.reduce((sum, p) => sum + p.precipitationMm, 0);
    out.push({
      time: hourlyPoints[i].time,
      precipitationMm: hourlyPoints[i].precipitationMm,
      rain6h: Math.round(rain6h * 10) / 10,
      rain24h: Math.round(rain24h * 10) / 10,
      category24h: classify24hRainfall(rain24h),
    });
  }
  return out;
}

module.exports = { IMD_24H_THRESHOLDS_MM, classify24hRainfall, computeRollingWindows };
