const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");

const { pool } = require("./config/db");
const { redisClient } = require("./config/redis");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const openapiSpec = require("./docs/openapi.json");

const authRoutes = require("./routes/auth");
const riverRoutes = require("./routes/rivers");
const rainfallRoutes = require("./routes/rainfall");
const zoneRoutes = require("./routes/zones");
const alertRoutes = require("./routes/alerts");
const backtestRoutes = require("./routes/backtest");

/**
 * Builds and returns a fully configured Express app, without starting an
 * HTTP listener. Kept separate from index.js so tests can import this and
 * hit it with supertest, and so io can be swapped for a stub in tests.
 *
 * @param {{ emit: Function }} io - a real Socket.io server, or a stub with
 *   an .emit() method (e.g. `{ emit: () => {} }`) for tests.
 */
function createApp(io) {
  const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
  const app = express();

  app.set("io", io);

  app.use(helmet());
  app.use(cors({ origin: CORS_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));
  if (process.env.NODE_ENV !== "test") {
    app.use(morgan("tiny"));
  }
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get("/api/health", async (req, res) => {
    let dbOk = false;
    let redisOk = false;
    try {
      await pool.query("SELECT 1");
      dbOk = true;
    } catch (_) {
      /* reported via dbOk = false */
    }
    try {
      await redisClient.ping();
      redisOk = true;
    } catch (_) {
      /* reported via redisOk = false */
    }
    const healthy = dbOk && redisOk;
    res.status(healthy ? 200 : 503).json({
      success: healthy,
      data: {
        status: healthy ? "healthy" : "degraded",
        db: dbOk,
        redis: redisOk,
        demo_mode: process.env.DEMO_MODE === "true",
        uptime_s: process.uptime(),
      },
    });
  });

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
  app.get("/api/openapi.json", (req, res) => res.json(openapiSpec));

  app.use("/api/auth", authRoutes);
  app.use("/api/rivers", riverRoutes);
  app.use("/api/rainfall", rainfallRoutes);
  app.use("/api/zones", zoneRoutes);
  app.use("/api/alerts", alertRoutes);
  app.use("/api/backtest", backtestRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
