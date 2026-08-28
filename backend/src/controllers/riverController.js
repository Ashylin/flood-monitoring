const { query } = require("../config/db");
const { redisClient } = require("../config/redis");
const { stationStatus } = require("../services/floodRiskService");

async function listStations(req, res, next) {
  try {
    const stationsRes = await query("SELECT * FROM stations ORDER BY id");
    const stations = await Promise.all(
      stationsRes.rows.map(async (station) => {
        const cached = await redisClient.get(`river:latest:${station.id}`).catch(() => null);
        let latest = cached ? JSON.parse(cached) : null;
        if (!latest) {
          const r = await query(
            "SELECT * FROM river_readings WHERE station_id = $1 ORDER BY recorded_at DESC LIMIT 1",
            [station.id]
          );
          latest = r.rows[0] || null;
        }
        return {
          ...station,
          latest_reading: latest,
          status: stationStatus(latest, station),
        };
      })
    );
    res.json({ success: true, data: stations });
  } catch (err) {
    next(err);
  }
}

async function getStation(req, res, next) {
  try {
    const { id } = req.params;
    const stationRes = await query("SELECT * FROM stations WHERE id = $1", [id]);
    if (!stationRes.rows.length) {
      const err = new Error("Station not found");
      err.status = 404;
      throw err;
    }
    const station = stationRes.rows[0];
    const latestRes = await query(
      "SELECT * FROM river_readings WHERE station_id = $1 ORDER BY recorded_at DESC LIMIT 1",
      [id]
    );
    const latest = latestRes.rows[0] || null;
    res.json({ success: true, data: { ...station, latest_reading: latest, status: stationStatus(latest, station) } });
  } catch (err) {
    next(err);
  }
}

async function getStationHistory(req, res, next) {
  try {
    const { id } = req.params;
    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    const historyRes = await query(
      "SELECT water_level, flow_rate, recorded_at FROM river_readings WHERE station_id = $1 ORDER BY recorded_at DESC LIMIT $2",
      [id, limit]
    );
    res.json({ success: true, data: historyRes.rows.reverse() });
  } catch (err) {
    next(err);
  }
}

/**
 * Lets an operator (or any authenticated system with real gauge access)
 * submit an actual river-level reading by hand. This is the "manual"
 * data_source path — no fabricated numbers, only what a real person or
 * system reports. First manual reading flips the station's data_source
 * from 'unavailable' to 'manual' automatically.
 */
async function submitReading(req, res, next) {
  try {
    const { id } = req.params;
    const { water_level, flow_rate, recorded_at } = req.body;

    if (water_level === undefined || water_level === null || Number.isNaN(Number(water_level))) {
      const err = new Error("water_level (number, meters) is required");
      err.status = 422;
      err.publicMessage = err.message;
      throw err;
    }

    const stationRes = await query("SELECT * FROM stations WHERE id = $1", [id]);
    if (!stationRes.rows.length) {
      const err = new Error("Station not found");
      err.status = 404;
      throw err;
    }
    const station = stationRes.rows[0];

    const insertRes = await query(
      `INSERT INTO river_readings (station_id, water_level, flow_rate, recorded_at)
       VALUES ($1, $2, $3, COALESCE($4, now())) RETURNING *`,
      [id, Number(water_level).toFixed(2), flow_rate != null ? Number(flow_rate).toFixed(2) : null, recorded_at || null]
    );
    const reading = insertRes.rows[0];

    if (station.data_source === "unavailable") {
      await query("UPDATE stations SET data_source = 'manual' WHERE id = $1", [id]);
    }

    await redisClient.set(`river:latest:${id}`, JSON.stringify(reading), { EX: 3600 }).catch(() => {});
    req.app.get("io").emit("river:update", { station_id: Number(id), reading });

    res.status(201).json({ success: true, data: reading });
  } catch (err) {
    next(err);
  }
}

/**
 * Physical sensor (IoT device) ingestion. A device authenticates with a
 * per-station secret token (NOT the general operator API key) so a
 * compromised sensor can only ever post to its own station.
 */
async function submitDeviceReading(req, res, next) {
  try {
    const { id } = req.params;
    const deviceToken = req.header("x-device-token");
    const { water_level, flow_rate } = req.body;

    if (!deviceToken) {
      const err = new Error("Missing x-device-token header");
      err.status = 401;
      err.publicMessage = err.message;
      throw err;
    }
    if (water_level === undefined || water_level === null || Number.isNaN(Number(water_level))) {
      const err = new Error("water_level (number, meters) is required");
      err.status = 422;
      err.publicMessage = err.message;
      throw err;
    }

    const stationRes = await query("SELECT * FROM stations WHERE id = $1", [id]);
    if (!stationRes.rows.length) {
      const err = new Error("Station not found");
      err.status = 404;
      throw err;
    }
    const station = stationRes.rows[0];

    if (!station.device_token || station.device_token !== deviceToken) {
      const err = new Error("Invalid device token for this station");
      err.status = 401;
      err.publicMessage = err.message;
      throw err;
    }

    const insertRes = await query(
      `INSERT INTO river_readings (station_id, water_level, flow_rate) VALUES ($1,$2,$3) RETURNING *`,
      [id, Number(water_level).toFixed(2), flow_rate != null ? Number(flow_rate).toFixed(2) : null]
    );
    const reading = insertRes.rows[0];

    if (station.data_source !== "iot_device") {
      await query("UPDATE stations SET data_source = 'iot_device' WHERE id = $1", [id]);
    }

    await redisClient.set(`river:latest:${id}`, JSON.stringify(reading), { EX: 3600 }).catch(() => {});
    req.app.get("io").emit("river:update", { station_id: Number(id), reading });

    res.status(201).json({ success: true, data: reading });
  } catch (err) {
    next(err);
  }
}

/**
 * Generates a fresh device token for a station (operator-authenticated).
 * The token is shown once — store it in your sensor's firmware config.
 */
async function provisionDevice(req, res, next) {
  try {
    const { id } = req.params;
    const crypto = require("crypto");
    const token = crypto.randomBytes(24).toString("hex");

    const result = await query(
      "UPDATE stations SET device_token = $1 WHERE id = $2 RETURNING id, name, device_token",
      [token, id]
    );
    if (!result.rows.length) {
      const err = new Error("Station not found");
      err.status = 404;
      throw err;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listStations,
  getStation,
  getStationHistory,
  submitReading,
  submitDeviceReading,
  provisionDevice,
};
