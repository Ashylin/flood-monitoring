require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");

const { waitForDb, pool } = require("./config/db");
const { waitForRedis, redisClient } = require("./config/redis");
const { createApp } = require("./app");
const { attachSocketHandlers } = require("./sockets/realtime");
const { startRainfallIngestion } = require("./ingestion/openMeteoRainfall");
const { startTnGovIngestion } = require("./ingestion/tnGovApiStub");
const { startZoneRiskWorker } = require("./services/zoneRiskWorker");
const { startDemoSimulator } = require("./services/demoSimulator");

const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

async function main() {
  await waitForDb();
  await waitForRedis();

  const app = createApp(null); // placeholder, replaced with the real io below
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: CORS_ORIGIN, methods: ["GET", "POST", "PATCH"] } });
  app.set("io", io);

  attachSocketHandlers(io);
  startRainfallIngestion(io, { intervalMs: Number(process.env.RAINFALL_POLL_INTERVAL_MS) || 15 * 60 * 1000 });
  startTnGovIngestion(io); // no-op until TN_GOV_API_BASE_URL/TN_GOV_API_KEY are configured
  startZoneRiskWorker(io, { intervalMs: Number(process.env.ZONE_RECOMPUTE_INTERVAL_MS) || 5 * 60 * 1000 });

  if (process.env.DEMO_MODE === "true") {
    startDemoSimulator(io, { intervalMs: Number(process.env.DEMO_INTERVAL_MS) || 8000 });
  }

  server.listen(PORT, () => {
    console.log(`[server] Flood Monitoring API listening on :${PORT}`);
  });

  const shutdown = async (signal) => {
    console.log(`[server] received ${signal}, shutting down gracefully...`);
    server.close(() => console.log("[server] HTTP server closed"));
    await pool.end().catch(() => {});
    await redisClient.quit().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[server] fatal startup error", err);
  process.exit(1);
});
