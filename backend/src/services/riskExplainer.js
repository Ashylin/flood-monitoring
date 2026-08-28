/**
 * The explainable risk engine: turns raw signals (river status, rainfall
 * windows, rate of change, data freshness) into a 0-100 score, a category,
 * and a human-readable list of reasons — the "why" behind every alert.
 *
 * Deliberately rule-based, not ML. If asked "is this AI?", the honest
 * answer is no — it's transparent weighted scoring you can trace by hand,
 * which is the point: every number here is explainable.
 *
 * Design rule carried over from floodRiskService.computeZoneRisk: a zone
 * with no live river feed must never be able to reach "high" or "critical"
 * from rainfall alone. This module enforces that by capping the river
 * component's contribution at 0 when there's no usable river reading —
 * rainfall alone (max 30 points) can only ever reach the "medium" band.
 */
const { classify24hRainfall } = require("./rainfallWindowService");

const RIVER_STATUS_POINTS = { danger: 60, warning: 45, watch: 30, normal: 10, no_feed: 0, unknown: 0 };
const RAINFALL_CATEGORY_POINTS = {
  extremely_heavy: 30,
  very_heavy: 26,
  heavy: 20,
  moderate: 12,
  light: 5,
  negligible: 0,
};
const RATE_OF_CHANGE_MAX_POINTS = 10;
const RAPID_RISE_M_PER_HR = 0.2; // >20cm/hr is a fast rise for most TN gauges

const STALE_THRESHOLD_MINUTES = 60; // beyond this, confidence in a reading is reduced
const NO_DATA_THRESHOLD_MINUTES = 24 * 60; // beyond this, treat as if there's no reading at all

function dataFreshness(recordedAt, nowMs = Date.now()) {
  if (!recordedAt) return { status: "no_data", ageMinutes: null };
  const ageMinutes = (nowMs - new Date(recordedAt).getTime()) / 60000;
  if (ageMinutes > NO_DATA_THRESHOLD_MINUTES) return { status: "no_data", ageMinutes };
  if (ageMinutes > STALE_THRESHOLD_MINUTES) return { status: "stale", ageMinutes };
  return { status: "fresh", ageMinutes };
}

/**
 * @param {number|null} currentLevel current water level (m)
 * @param {number|null} priorLevel a reading from roughly 1-3h earlier (m)
 * @param {number|null} hoursBetween actual hours between the two readings
 */
function computeRateOfChange(currentLevel, priorLevel, hoursBetween) {
  if (currentLevel == null || priorLevel == null || !hoursBetween || hoursBetween <= 0) {
    return { ratePerHour: null, rapidRise: false };
  }
  const ratePerHour = (currentLevel - priorLevel) / hoursBetween;
  return { ratePerHour: Math.round(ratePerHour * 100) / 100, rapidRise: ratePerHour >= RAPID_RISE_M_PER_HR };
}

function scoreToLevel(score) {
  if (score >= 70) return "critical";
  if (score >= 45) return "high";
  if (score >= 20) return "medium";
  if (score > 0) return "low";
  return "insufficient_data";
}

/**
 * @param {object} params
 * @param {string} params.riverStatus  'normal'|'watch'|'warning'|'danger'|'no_feed'|'unknown'
 * @param {object|null} params.riverFreshness  from dataFreshness(), or null if no reading at all
 * @param {number|null} params.rain6hMm
 * @param {number|null} params.rain24hMm
 * @param {object|null} params.rainfallFreshness  from dataFreshness(), or null if no reading at all
 * @param {object} params.rateOfChange  from computeRateOfChange()
 * @param {string} params.stationName
 * @param {string} params.zoneName
 */
function computeDetailedRisk(params) {
  const { riverStatus, riverFreshness, rain6hMm, rain24hMm, rainfallFreshness, rateOfChange, stationName, zoneName } = params;

  const reasons = [];

  // River component — zeroed out entirely if there's no feed at all, so
  // rainfall alone can never push the score past the "medium" band.
  let riverPoints = RIVER_STATUS_POINTS[riverStatus] ?? 0;
  if (riverFreshness && riverFreshness.status === "stale") {
    riverPoints = Math.round(riverPoints * 0.5);
    reasons.push(`River reading at ${stationName || "the linked station"} is ${Math.round(riverFreshness.ageMinutes)} min old — confidence reduced, weighted at half strength`);
  } else if (riverStatus !== "no_feed" && riverStatus !== "unknown" && riverPoints > 0) {
    reasons.push(`River level at ${stationName || "the linked station"} is at status "${riverStatus}"`);
  }

  // Rainfall component
  const rain24hCategory = classify24hRainfall(rain24hMm || 0);
  let rainfallPoints = RAINFALL_CATEGORY_POINTS[rain24hCategory] ?? 0;
  if (rainfallFreshness && rainfallFreshness.status === "stale") {
    rainfallPoints = Math.round(rainfallPoints * 0.5);
    reasons.push(`Rainfall data is ${Math.round(rainfallFreshness.ageMinutes)} min old — confidence reduced`);
  } else if (rainfallPoints > 0) {
    reasons.push(`24h rainfall of ${(rain24hMm || 0).toFixed(1)}mm classifies as IMD "${rain24hCategory.replace("_", " ")}"`);
  }
  if (rain6hMm != null && rain6hMm >= 40) {
    reasons.push(`${rain6hMm.toFixed(1)}mm fell in the last 6h alone — a fast-accumulating spell`);
  }

  // Rate-of-change component
  let ratePoints = 0;
  if (rateOfChange.rapidRise) {
    ratePoints = RATE_OF_CHANGE_MAX_POINTS;
    reasons.push(`River level is rising rapidly (+${rateOfChange.ratePerHour}m/hr) — trend matters as much as absolute level`);
  }

  const rawScore = riverPoints + rainfallPoints + ratePoints;
  const score = Math.max(0, Math.min(100, rawScore));
  const level = scoreToLevel(score);

  if (score === 0) {
    reasons.push(
      riverStatus === "no_feed"
        ? `No live river feed for ${zoneName || "this zone"} and rainfall is currently light`
        : "No significant risk signals currently present"
    );
  }

  return {
    score,
    level,
    reasons,
    reasonSummary: reasons.join("; "),
    components: { riverPoints, rainfallPoints, ratePoints },
  };
}

module.exports = { computeDetailedRisk, computeRateOfChange, dataFreshness, scoreToLevel };
