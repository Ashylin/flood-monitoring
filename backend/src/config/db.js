const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PG_HOST || "localhost",
  port: Number(process.env.PG_PORT) || 5432,
  user: process.env.PG_USER || "flood_admin",
  password: process.env.PG_PASSWORD || "flood_secret",
  database: process.env.PG_DATABASE || "flood_monitoring",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[postgres] unexpected error on idle client", err);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 200) {
    console.warn(`[postgres] slow query (${duration}ms): ${text}`);
  }
  return res;
}

async function waitForDb(retries = 15, delayMs = 2000) {
  for (let i = 1; i <= retries; i += 1) {
    try {
      await pool.query("SELECT 1");
      console.log("[postgres] connected");
      return;
    } catch (err) {
      console.warn(`[postgres] connection attempt ${i}/${retries} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Could not connect to Postgres after multiple retries");
}

module.exports = { pool, query, waitForDb };
