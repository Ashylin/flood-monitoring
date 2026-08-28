/* Applies schema.sql against the configured database. Idempotent (IF NOT EXISTS everywhere). */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool, waitForDb } = require("../config/db");

async function migrate() {
  await waitForDb();
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("[migrate] schema applied successfully");
  await pool.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("[migrate] failed", err);
  process.exit(1);
});
