require('dotenv').config();
const { pool } = require('./src/config/db');
const fs = require('fs');

(async () => {
  try {
    const before = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    console.log('TABLES BEFORE:', before.rows.map(r => r.tablename));

    const sql = fs.readFileSync('src/db/schema.sql', 'utf8');
    await pool.query(sql);
    console.log('MIGRATION: no error thrown');
  } catch (err) {
    console.log('MIGRATION ERROR:');
    console.log('message:', err.message);
    console.log('detail:', err.detail);
    console.log('position:', err.position);
    console.log('code:', err.code);
  }

  const after = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  console.log('TABLES AFTER:', after.rows.map(r => r.tablename));
  process.exit(0);
})();
