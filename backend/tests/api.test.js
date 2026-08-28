process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-production";

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { createApp } = require("../src/app");
const { pool } = require("../src/config/db");
const { redisClient, waitForRedis } = require("../src/config/redis");

const fakeIo = { emit: () => {} };
const app = createApp(fakeIo);

beforeAll(async () => {
  // Applies the (idempotent) schema so tests can run against a fresh CI database.
  const schema = fs.readFileSync(path.join(__dirname, "../src/db/schema.sql"), "utf8");
  await pool.query(schema);
  await waitForRedis();
});

afterAll(async () => {
  await pool.end();
  await redisClient.quit().catch(() => {});
});

function uniqueEmail() {
  return `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

describe("GET /api/health", () => {
  test("reports healthy with real DB/Redis connections", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.db).toBe(true);
    expect(res.body.data.redis).toBe(true);
  });
});

describe("Auth flow", () => {
  const email = uniqueEmail();
  const password = "correct horse battery staple";

  test("registers a new operator account", async () => {
    const res = await request(app).post("/api/auth/register").send({ email, password, role: "operator" });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.token).toBeTruthy();
  });

  test("rejects duplicate registration with the same email", async () => {
    const res = await request(app).post("/api/auth/register").send({ email, password, role: "operator" });
    expect(res.status).toBe(409);
  });

  test("rejects registration with a role of 'admin' (self-escalation not allowed)", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: uniqueEmail(), password, role: "admin" });
    expect(res.status).toBe(422);
  });

  test("logs in with correct credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });

  test("rejects login with wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({ email, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  test("GET /api/auth/me requires a valid token", async () => {
    const noAuth = await request(app).get("/api/auth/me");
    expect(noAuth.status).toBe(401);

    const login = await request(app).post("/api/auth/login").send({ email, password });
    const token = login.body.data.token;

    const withAuth = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(withAuth.status).toBe(200);
    expect(withAuth.body.data.email).toBe(email);
  });
});

describe("Alerts — role-gated writes", () => {
  let operatorToken;
  let viewerToken;

  beforeAll(async () => {
    const opEmail = uniqueEmail();
    const opRes = await request(app)
      .post("/api/auth/register")
      .send({ email: opEmail, password: "correct horse battery staple", role: "operator" });
    operatorToken = opRes.body.data.token;

    const viewerEmail = uniqueEmail();
    const viewerRes = await request(app)
      .post("/api/auth/register")
      .send({ email: viewerEmail, password: "correct horse battery staple", role: "viewer" });
    viewerToken = viewerRes.body.data.token;
  });

  test("GET /api/alerts works without auth (public read)", async () => {
    const res = await request(app).get("/api/alerts");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test("POST /api/alerts without a token is rejected", async () => {
    const res = await request(app)
      .post("/api/alerts")
      .send({ title: "Test alert", message: "Test message", severity: "advisory" });
    expect(res.status).toBe(401);
  });

  test("POST /api/alerts as a viewer is rejected (wrong role)", async () => {
    const res = await request(app)
      .post("/api/alerts")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ title: "Test alert", message: "Test message", severity: "advisory" });
    expect(res.status).toBe(403);
  });

  test("POST /api/alerts as an operator succeeds", async () => {
    const res = await request(app)
      .post("/api/alerts")
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({ title: "Test alert from CI", message: "Automated test message", severity: "advisory" });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("active");
  });

  test("POST /api/alerts rejects invalid severity with 422", async () => {
    const res = await request(app)
      .post("/api/alerts")
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({ title: "Bad alert", message: "msg", severity: "not-a-real-severity" });
    expect(res.status).toBe(422);
  });

  test("PATCH /api/alerts/:id transitions status as an operator", async () => {
    const created = await request(app)
      .post("/api/alerts")
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({ title: "Alert to resolve", message: "msg", severity: "watch" });
    const id = created.body.data.id;

    const patched = await request(app)
      .patch(`/api/alerts/${id}`)
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({ status: "resolved" });
    expect(patched.status).toBe(200);
    expect(patched.body.data.status).toBe("resolved");
  });
});

describe("Rivers", () => {
  test("GET /api/rivers returns the seeded stations with honest status", async () => {
    const res = await request(app).get("/api/rivers");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    // Freshly migrated stations with no reading yet should never claim to be "normal"
    const untouchedStation = res.body.data.find((s) => s.data_source === "unavailable");
    if (untouchedStation) {
      expect(untouchedStation.status).toBe("no_feed");
    }
  });
});

describe("Rainfall & Zones", () => {
  test("GET /api/rainfall returns all 38 Tamil Nadu districts", async () => {
    const res = await request(app).get("/api/rainfall");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(38);
  });

  test("GET /api/zones returns flood zones", async () => {
    const res = await request(app).get("/api/zones");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
