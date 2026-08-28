/**
 * Computes a flood-zone risk level from the linked station's water level
 * (relative to its watch/warning/danger thresholds) and the district's
 * recent rainfall intensity. Pure function -> easy to unit test.
 */
function stationStatus(reading, station) {
  if (!station) return "unknown";
  if (station.data_source === "unavailable" || !reading) return "no_feed";
  const level = Number(reading.water_level);
  if (level >= Number(station.danger_level)) return "danger";
  if (level >= Number(station.warning_level)) return "warning";
  if (level >= Number(station.watch_level)) return "watch";
  return "normal";
}

/**
 * When a station has no live/manual feed connected, zone risk falls back to
 * a rainfall-only estimate and is capped at "medium" — we deliberately never
 * let a missing river feed silently produce a "low risk, all clear" reading,
 * and we never invent a river-level-driven score without real river data.
 */
function computeZoneRisk({ stationReading, station, rainfallIntensityMmHr }) {
  const status = stationStatus(stationReading, station);

  if (status === "no_feed" || status === "unknown") {
    if (rainfallIntensityMmHr >= 25) return "medium"; // heavy rain alone, no river confirmation
    return "insufficient_data";
  }

  let score = 0;
  switch (status) {
    case "danger":
      score += 3;
      break;
    case "warning":
      score += 2;
      break;
    case "watch":
      score += 1;
      break;
    default:
      score += 0;
  }

  if (rainfallIntensityMmHr >= 50) score += 3;
  else if (rainfallIntensityMmHr >= 25) score += 2;
  else if (rainfallIntensityMmHr >= 10) score += 1;

  if (score >= 5) return "critical";
  if (score >= 3) return "high";
  if (score >= 1) return "medium";
  return "low";
}

module.exports = { stationStatus, computeZoneRisk };
