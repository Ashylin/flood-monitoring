const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => console.error("[redis] error", err));
redisClient.on("connect", () => console.log("[redis] connected"));

async function waitForRedis(retries = 15, delayMs = 2000) {
  for (let i = 1; i <= retries; i += 1) {
    try {
      if (!redisClient.isOpen) await redisClient.connect();
      await redisClient.ping();
      return;
    } catch (err) {
      console.warn(`[redis] connection attempt ${i}/${retries} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Could not connect to Redis after multiple retries");
}

module.exports = { redisClient, waitForRedis };
