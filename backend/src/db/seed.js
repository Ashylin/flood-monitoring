/* schema.sql already seeds baseline stations/districts/zones on ON CONFLICT DO NOTHING,
   so this script just triggers the same migration and confirms row counts. */
require("dotenv").config();
const { pool, waitForDb } = require("../config/db");

async function seed() {
  await waitForDb();
  const counts = await Promise.all(
    ["stations", "districts", "flood_zones"].map((t) =>
      pool.query(`SELECT count(*)::int AS c FROM ${t}`).then((r) => [t, r.rows[0].c])
    )
  );
  counts.forEach(([t, c]) => console.log(`[seed] ${t}: ${c} rows`));
  await pool.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] failed", err);
  process.exit(1);
});
