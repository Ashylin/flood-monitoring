/**
 * DEMO MODE — simulated river readings for presentations/demos only.
 *
 * This is explicitly opt-in (DEMO_MODE=true) and every reading it writes is
 * tagged data_source = 'demo' in the stations table, so the frontend can
 * show a clear "DEMO DATA" banner and nobody mistakes this for a real feed.
 * It never touches a station that already has data_source 'manual',
 * 'iot_device', or 'live_feed' — demo mode only fills in stations that
 * would otherwise show "no live feed", so a real feed is never overwritten.
 */
const { query } = require("../config/db");
const { redisClient } = require("../config/redis");

function nextValue(prev, target, volatility, min, max) {
  const pull = (target - prev) * 0.05;
  const noise = (Math.random() - 0.5) * volatility;
  return Math.max(min, Math.min(max, prev + pull + noise));
}

function startDemoSimulator(io, { intervalMs = 8000 } = {}) {
  const state = {}; // stationId -> { level }

  async function tick() {
    let stations;
    try {
      stations = (
        await query("SELECT * FROM stations WHERE data_source IN ('unavailable', 'demo')")
      ).rows;
    } catch (err) {
      console.error("[demo-simulator] could not load stations", err.message);
      return;
    }

    for (const station of stations) {
      const target = Number(station.watch_level) * 0.7;
      const prev = state[station.id]?.level ?? target;
      const level = nextValue(prev, target, 0.3, 0, Number(station.danger_level) * 1.1);
      state[station.id] = { level };

      try {
        const result = await query(
          `INSERT INTO river_readings (station_id, water_level, flow_rate) VALUES ($1,$2,$3) RETURNING *`,
          [station.id, level.toFixed(2), (level * 35).toFixed(2)]
        );
        const reading = result.rows[0];

        if (station.data_source !== "demo") {
          await query("UPDATE stations SET data_source = 'demo' WHERE id = $1", [station.id]);
        }

        await redisClient.set(`river:latest:${station.id}`, JSON.stringify(reading), { EX: 3600 }).catch(() => {});
        io.emit("river:update", { station_id: station.id, reading });
      } catch (err) {
        console.error(`[demo-simulator] failed for station ${station.id}`, err.message);
      }
    }
  }

  tick();
  const timer = setInterval(tick, intervalMs);
  console.log(`[demo-simulator] ⚠ DEMO MODE ACTIVE — simulated river data every ${intervalMs / 1000}s (data_source='demo', never real)`);
  return () => clearInterval(timer);
}

module.exports = { startDemoSimulator };
