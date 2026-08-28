const { query } = require("../config/db");
const { redisClient } = require("../config/redis");

async function listRainfall(req, res, next) {
  try {
    const districtsRes = await query("SELECT * FROM districts ORDER BY id");
    const data = await Promise.all(
      districtsRes.rows.map(async (district) => {
        const cached = await redisClient.get(`rainfall:latest:${district.id}`).catch(() => null);
        let latest = cached ? JSON.parse(cached) : null;
        if (!latest) {
          const r = await query(
            "SELECT * FROM rainfall_readings WHERE district_id = $1 ORDER BY recorded_at DESC LIMIT 1",
            [district.id]
          );
          latest = r.rows[0] || null;
        }
        return { ...district, latest_reading: latest };
      })
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getDistrictHistory(req, res, next) {
  try {
    const { district } = req.params;
    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    const distRes = await query("SELECT id FROM districts WHERE name = $1", [district]);
    if (!distRes.rows.length) {
      const err = new Error("District not found");
      err.status = 404;
      throw err;
    }
    const historyRes = await query(
      "SELECT intensity_mm_hr, accumulated_24h_mm, recorded_at FROM rainfall_readings WHERE district_id = $1 ORDER BY recorded_at DESC LIMIT $2",
      [distRes.rows[0].id, limit]
    );
    res.json({ success: true, data: historyRes.rows.reverse() });
  } catch (err) {
    next(err);
  }
}

module.exports = { listRainfall, getDistrictHistory };
