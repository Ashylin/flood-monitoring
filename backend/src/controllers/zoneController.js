const { query } = require("../config/db");

async function listZones(req, res, next) {
  try {
    const result = await query(`
      SELECT z.*, s.name AS station_name, s.river_name
      FROM flood_zones z
      LEFT JOIN stations s ON s.id = z.station_id
      ORDER BY
        CASE z.risk_level
          WHEN 'critical' THEN 4
          WHEN 'high' THEN 3
          WHEN 'medium' THEN 2
          ELSE 1
        END DESC, z.name
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { listZones };
