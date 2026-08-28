/**
 * PRE-WIRED, INACTIVE stub for an official Tamil Nadu / CWC river-level API.
 *
 * As of August 2026, no such public, documented, real-time API exists (see
 * README). This file exists so that the moment you (or your organization)
 * gets institutional access — e.g. a data-sharing agreement with CWC or
 * Tamil Nadu's Water Resources Department — you only need to:
 *
 *   1. Fill in TN_GOV_API_BASE_URL and TN_GOV_API_KEY in your .env
 *   2. Map each of your `stations` rows to the real source's station/site ID
 *      in STATION_ID_MAP below
 *   3. Implement parseReading() to match whatever shape that API returns
 *   4. Call startTnGovIngestion(io) from index.js instead of/alongside the
 *      demo simulator or manual entry
 *
 * Nothing else in the app needs to change — this writes into the same
 * river_readings table via the same code path as every other source.
 */
const { query } = require("../config/db");
const { redisClient } = require("../config/redis");

// Map your internal station id -> the official source's station identifier.
// Fill this in once you know the real IDs from whatever API/feed you get access to.
const STATION_ID_MAP = {
  // 1: "CWC_STATION_CODE_HERE",
  // 2: "CWC_STATION_CODE_HERE",
};

function isConfigured() {
  return Boolean(process.env.TN_GOV_API_BASE_URL && process.env.TN_GOV_API_KEY);
}

async function fetchOfficialReading(externalStationId) {
  // EXAMPLE ONLY — replace with the real request shape once you have a
  // documented endpoint. This throws until it's actually implemented, so
  // nobody accidentally ships fabricated numbers under this module's name.
  throw new Error(
    "tnGovApiStub.fetchOfficialReading() is not implemented — this activates only once a real, " +
      "documented Tamil Nadu / CWC API is available and configured. See file header for setup steps."
  );

  // Once implemented, it should look roughly like:
  //
  // const res = await fetch(`${process.env.TN_GOV_API_BASE_URL}/stations/${externalStationId}/latest`, {
  //   headers: { Authorization: `Bearer ${process.env.TN_GOV_API_KEY}` },
  // });
  // if (!res.ok) throw new Error(`TN Gov API request failed: ${res.status}`);
  // const data = await res.json();
  // return parseReading(data);
}

// Adapt this to whatever shape the real API actually returns.
// function parseReading(apiResponse) {
//   return { waterLevel: apiResponse.level_m, flowRate: apiResponse.discharge_cumecs ?? null };
// }

async function ingestOne(internalStationId, externalStationId, io) {
  const { waterLevel, flowRate } = await fetchOfficialReading(externalStationId);

  const result = await query(
    `INSERT INTO river_readings (station_id, water_level, flow_rate) VALUES ($1,$2,$3) RETURNING *`,
    [internalStationId, waterLevel.toFixed(2), flowRate != null ? flowRate.toFixed(2) : null]
  );
  const reading = result.rows[0];

  await query("UPDATE stations SET data_source = 'live_feed' WHERE id = $1", [internalStationId]);
  await redisClient.set(`river:latest:${internalStationId}`, JSON.stringify(reading), { EX: 3600 }).catch(() => {});
  io.emit("river:update", { station_id: internalStationId, reading });
  return reading;
}

function startTnGovIngestion(io, { intervalMs = 15 * 60 * 1000 } = {}) {
  if (!isConfigured()) {
    console.log(
      "[tn-gov-ingestion] not configured (no TN_GOV_API_BASE_URL/TN_GOV_API_KEY) — skipping. " +
        "See backend/src/ingestion/tnGovApiStub.js for setup steps once you have real access."
    );
    return () => {};
  }

  async function pollOnce() {
    for (const [internalId, externalId] of Object.entries(STATION_ID_MAP)) {
      try {
        await ingestOne(Number(internalId), externalId, io);
      } catch (err) {
        console.error(`[tn-gov-ingestion] failed for station ${internalId}:`, err.message);
      }
    }
  }

  pollOnce();
  const timer = setInterval(pollOnce, intervalMs);
  console.log(`[tn-gov-ingestion] started — polling official TN/CWC API every ${intervalMs / 60000} min`);
  return () => clearInterval(timer);
}

module.exports = { startTnGovIngestion, isConfigured };
