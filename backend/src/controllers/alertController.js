const { query } = require("../config/db");

function validateAlertPayload(body) {
  const errors = [];
  const validSeverities = ["advisory", "watch", "warning", "emergency"];
  if (!body.title || String(body.title).trim().length < 3) errors.push("title is required (min 3 chars)");
  if (!body.message || String(body.message).trim().length < 3) errors.push("message is required (min 3 chars)");
  if (!validSeverities.includes(body.severity)) errors.push(`severity must be one of: ${validSeverities.join(", ")}`);
  return errors;
}

async function listAlerts(req, res, next) {
  try {
    const { status } = req.query;
    const params = [];
    let sql = `
      SELECT a.*, z.name AS zone_name, s.name AS station_name
      FROM alerts a
      LEFT JOIN flood_zones z ON z.id = a.zone_id
      LEFT JOIN stations s ON s.id = a.station_id
    `;
    if (status) {
      params.push(status);
      sql += ` WHERE a.status = $1`;
    }
    sql += " ORDER BY a.created_at DESC LIMIT 200";
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function createAlert(req, res, next) {
  try {
    const errors = validateAlertPayload(req.body);
    if (errors.length) {
      const err = new Error(errors.join("; "));
      err.status = 422;
      err.publicMessage = errors.join("; ");
      throw err;
    }
    const { zone_id, station_id, severity, title, message, created_by } = req.body;
    const result = await query(
      `INSERT INTO alerts (zone_id, station_id, severity, title, message, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [zone_id || null, station_id || null, severity, title.trim(), message.trim(), created_by || "operator"]
    );
    const alert = result.rows[0];
    req.app.get("io").emit("alert:new", alert);
    res.status(201).json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
}

async function updateAlertStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ["active", "acknowledged", "resolved"];
    if (!validStatuses.includes(status)) {
      const err = new Error(`status must be one of: ${validStatuses.join(", ")}`);
      err.status = 422;
      err.publicMessage = err.message;
      throw err;
    }
    const timestampCol = status === "acknowledged" ? "acknowledged_at" : status === "resolved" ? "resolved_at" : null;
    const sql = timestampCol
      ? `UPDATE alerts SET status = $1, ${timestampCol} = now() WHERE id = $2 RETURNING *`
      : `UPDATE alerts SET status = $1 WHERE id = $2 RETURNING *`;
    const result = await query(sql, [status, id]);
    if (!result.rows.length) {
      const err = new Error("Alert not found");
      err.status = 404;
      throw err;
    }
    const alert = result.rows[0];
    req.app.get("io").emit("alert:updated", alert);
    res.json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAlerts, createAlert, updateAlertStatus };
