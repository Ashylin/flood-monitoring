/**
 * Creates (or updates the password of) the first admin account.
 * Run: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... npm run seed:admin
 */
require("dotenv").config();
const { pool, waitForDb } = require("../config/db");
const { hashPassword } = require("../utils/authUtils");

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables first.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  await waitForDb();
  const passwordHash = await hashPassword(password);

  await pool.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'`,
    [email.toLowerCase(), passwordHash]
  );

  console.log(`[seed-admin] admin account ready: ${email.toLowerCase()}`);
  await pool.end();
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("[seed-admin] failed", err);
  process.exit(1);
});
