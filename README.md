# Tamil Nadu Flood Monitoring & Early Warning System

A full-stack, real-time flood monitoring platform for disaster management authorities,
covering all 38 districts of Tamil Nadu. Tracks rainfall intensity, river water levels,
flood-prone zone risk scores, and pushes emergency alerts instantly to every connected
dashboard.

##  Be honest about the data sources — read this first

- **Rainfall is genuinely real and automatic.** Every district is polled from
  [Open-Meteo](https://open-meteo.com) (free, no API key, no signup) every 15 minutes.
  This is live precipitation data, not a simulation.
- **River water levels have NO live public API in India today.** The Central Water
  Commission's flood portal (`ffs.india-water.gov.in`) shows near-real-time levels to
  humans, but publishes no official API, and `data.gov.in`'s CWC datasets exist but
  currently have no working API endpoint either (verified August 2026). Rather than
  fabricate river numbers to look "real-time," every seeded station starts with
  `data_source = 'unavailable'` and reports status `no_feed` honestly in the API and UI.
- **`POST /api/rivers/:id/readings`** lets an authenticated operator (or any system you
  connect — your own IoT sensors, a state WRD feed, a field team calling in numbers)
  submit a real reading. The first submission automatically flips that station to
  `data_source = 'manual'`. Flood-zone risk scoring only ever uses this real river data;
  it never guesses a water level from rainfall alone.
- Zones linked to a station with no feed connected report `insufficient_data` unless
  rainfall alone is heavy enough to justify a capped `medium` warning — the system is
  designed to never silently report "all clear" when it actually has no idea.

If your organization has access to real telemetry (state Water Resources Department,
your own sensor network, etc.), wire it into `backend/src/ingestion/` alongside the
Open-Meteo module and call `submitReading`/`ingestRiverReading` the same way.

## Three ways to get real river data into this system

1. **Build physical IoT sensors** — an ESP32 + waterproof ultrasonic sensor reports
   directly to the backend. Firmware, wiring, and a full BOM are in `firmware/`.
   Provision a station first: `POST /api/rivers/:id/provision-device` (auth required),
   then flash the returned `device_token` into the firmware. This is a real, working,
   fully-automatic feed — not a simulation — the moment hardware is installed.
2. **Get official institutional access** and fill in `backend/src/ingestion/tnGovApiStub.js`
   — it's pre-wired and inactive, ready to activate the moment you have real credentials.
3. **Manual entry** — `POST /api/rivers/:id/readings` for an operator or partner agency
   to submit real numbers by hand.

## Demo mode (presentations only)

Set `DEMO_MODE=true` to simulate river readings on any station that doesn't yet have
a real feed connected — useful for showing the UI/interactions before hardware exists.
Every demo reading is tagged `data_source: 'demo'`, the frontend shows a persistent
"DEMO MODE ACTIVE" banner, and the moment a real feed (manual/IoT/official) connects to
a station, demo mode automatically stops touching it. Never enable this for a real
deployment.

## Architecture

```
                    ┌─────────────────────┐
                    │   React + TS SPA     │  (frontend/)
                    │  Dashboard, Charts,  │
                    │  Alerts, Zone Map    │
                    └──────────┬───────────┘
                        REST + WebSocket
                               │
                    ┌──────────▼───────────┐
                    │  Node.js + Express    │  (backend/)
                    │  REST API + Socket.io │
                    └────┬─────────────┬────┘
                         │             │
                 ┌───────▼───┐   ┌─────▼─────┐
                 │ PostgreSQL │   │   Redis    │
                 │ (readings, │   │ (live cache,
                 │  zones,    │   │  pub/sub for
                 │  alerts)   │   │  real-time) │
                 └────────────┘   └────────────┘
```

## Stack

- **Frontend:** React 18, TypeScript, Vite, Recharts, Socket.io-client
- **Backend:** Node.js, Express.js, Socket.io, node-postgres (`pg`), `redis`
- **Database:** PostgreSQL (persistent readings/zones/alerts)
- **Cache/Bus:** Redis (latest-value cache + pub/sub fan-out to all dashboards)
- **Infra:** Docker + Docker Compose, Git

## Features

- 🌧️ **Real, live** rainfall intensity + 24h accumulation per district (all 38 TN districts), polled from Open-Meteo
- 📈 River water-level tracking per gauge station (normal / watch / warning / danger / **no_feed**), fed by real manual/IoT/API submissions only — never fabricated
- 🗺️ Flood-prone zone risk scoring (low / medium / high / critical / insufficient_data) computed only from real data
- 🧮 **Explainable risk engine** — every zone gets a 0-100 score and a plain-language reason (e.g. "River level at Manali Gauge is at status 'danger'; 24h rainfall of 156mm classifies as IMD 'very heavy'"), not just a bucket. Rule-based and transparent, not ML — see [Risk engine](#risk-engine)
- ⏱️ **Rate-of-change detection** — flags a rapidly rising river level even before it crosses an absolute threshold
- 🕐 **Data-freshness awareness** — a stale reading (>60min old) is weighted at half confidence and flagged in the reason, never silently trusted as current
- 🚨 Emergency alert broadcast (create, acknowledge, resolve) pushed instantly via WebSocket
- 🔐 **JWT authentication with roles** (admin/operator/viewer) — see [Authentication](#authentication) below
- ✍️ `POST /api/rivers/:id/readings` — authenticated endpoint for operators to submit real river levels
- 📡 `POST /api/rivers/:id/device-readings` — per-device-token endpoint for real IoT sensors (see `firmware/`)
- 📖 **Interactive API docs** at `/api/docs` (Swagger UI), spec at `/api/openapi.json`
- ✅ **62 automated tests** (Jest + Supertest) covering risk logic, rainfall windows, auth, and the full API — see [Testing](#testing)
- 📊 **Historical backtest** against real, cited Chennai flood events (Dec 2015, Nov 2021) — see [Historical backtest](#historical-backtest)
- 🤖 **CI pipeline** (GitHub Actions) — lints, migrates against a real Postgres/Redis, and runs the full test suite on every push
- 🐳 One-command local startup via `docker compose up`
- ☁️ **Deployable in ~15 minutes** — see [DEPLOY.md](./DEPLOY.md) for Render (backend) + Vercel (frontend)

## Quick start

```bash
git clone <this-repo>
cd flood-monitoring-system
cp backend/.env.example backend/.env
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000/api
- Health check: http://localhost:4000/api/health

## Local dev (without Docker)

```bash
# 1. Postgres & Redis must be running locally (or via `docker compose up postgres redis`)
cd backend && npm install && npm run migrate && npm run seed && npm run dev

cd ../frontend && npm install && npm run dev
```

## REST API

| Method | Endpoint                     | Description                          |
|--------|-------------------------------|---------------------------------------|
| GET    | /api/health                   | Service health check                  |
| GET    | /api/docs                     | Interactive Swagger UI API docs       |
| POST   | /api/auth/register             | Self-register as viewer/operator      |
| POST   | /api/auth/login                | Log in, receive a JWT                 |
| GET    | /api/auth/me                   | Current authenticated user (auth req.)|
| GET    | /api/rivers                   | All river stations + latest reading + status  |
| GET    | /api/rivers/:id                | Station detail + history              |
| GET    | /api/rivers/:id/history        | Time-series readings                  |
| POST   | /api/rivers/:id/readings       | Submit a real reading (admin/operator)|
| POST   | /api/rivers/:id/device-readings| IoT sensor submits a reading (x-device-token) |
| POST   | /api/rivers/:id/provision-device| Generate a device token for a station (admin only) |
| GET    | /api/rainfall                 | Latest rainfall per district          |
| GET    | /api/rainfall/:district/history| Rainfall time-series                  |
| GET    | /api/zones                    | Flood-prone zones + risk level        |
| GET    | /api/alerts                   | Active + historical alerts            |
| POST   | /api/alerts                   | Create an emergency alert (admin/operator) |
| PATCH  | /api/alerts/:id                | Acknowledge / resolve an alert (admin/operator) |

Full interactive docs, with request/response schemas for every endpoint, are at
`/api/docs` once the server is running.

## Authentication

Three separate auth mechanisms, one per type of actor:

- **Humans (operators/admins)** — JWT via `/api/auth/login`, sent as `Authorization: Bearer <token>`.
  Roles: `admin` (full access, including device provisioning), `operator` (submit readings,
  create/update alerts), `viewer` (read-only). Self-registration is capped at
  `viewer`/`operator` — nobody can grant themselves admin over the API.
- **IoT sensors** — a per-station secret token (`x-device-token` header), generated by an
  admin via `/api/rivers/:id/provision-device`. A compromised sensor can only ever post
  readings for its own station.
- **First admin account** — created via `npm run seed:admin` (reads `ADMIN_EMAIL`/`ADMIN_PASSWORD`
  from the environment), not through a public endpoint.

## Testing

```bash
cd backend
npm install
npm run migrate   # applies schema to your local/test database
npm test          # 62 tests: unit (risk logic, explainable risk engine, rainfall windows, auth utils) + integration (full API via Supertest)
npm run lint
```

The integration tests run against a real Postgres + Redis (see `tests/api.test.js`) —
in CI, GitHub Actions spins up disposable Postgres/Redis service containers for this
automatically (see `.github/workflows/ci.yml`).

## Historical backtest

```bash
cd backend
npm run backtest
```

Runs the risk engine's rainfall classification against two real, documented Chennai
flood events (December 2015 and November 2021) and writes a report to
`backend/backtest-reports/`. On a machine with normal internet access, it pulls the
actual hour-by-hour historical rainfall from Open-Meteo's free archive API (ERA5
reanalysis, 1940–present) and reports how many hours before the flood's rainfall peak
the engine would have flagged IMD "heavy" rainfall or above. Without internet access,
it falls back to evaluating the engine against documented peak-24h totals only (with
citations) — the report always states plainly which mode produced its result.

This validates the rainfall-driven half of the risk engine against real history; see
the reports themselves for the honest limitations (no river telemetry existed for
these historical dates, so this isn't a full multi-signal replay).

## Risk engine

`backend/src/services/riskExplainer.js` — deliberately rule-based and transparent,
not ML (if asked "is this AI?", the honest answer is no). Every zone recompute
produces:

- **Score (0-100)**: river status (0-60 pts) + IMD rainfall category (0-30 pts) +
  rate-of-change (0-10 pts). A zone with no live river feed has its river
  component forced to 0, so rainfall alone can never push the score above the
  "medium" band (max 30/100) — the same "never claim more than the data supports"
  rule that governs the rest of this project.
- **Category**: derived from the score (`insufficient_data` / `low` / `medium` /
  `high` / `critical`), stored in `flood_zones.risk_level`.
- **Reason**: a plain-language sentence built from whichever signals actually
  contributed — e.g. `"River level at Manali Gauge is at status 'danger'"`,
  `"24h rainfall of 156.0mm classifies as IMD 'very heavy'"`,
  `"River level is rising rapidly (+0.35m/hr)"` — stored in `flood_zones.risk_reason`
  and included in auto-generated alert messages.
- **Data freshness**: `fresh` / `stale` / `no_data`. A reading older than 60
  minutes is weighted at half strength and explicitly called out in the reason,
  rather than silently trusted as current.

See `backend/tests/riskExplainer.test.js` for the full behavior spec, including the
safety-cap test that proves rainfall alone can never fabricate a "high"/"critical"
result.

## WebSocket events (Socket.io)

- `river:update` — new river level reading
- `rainfall:update` — new rainfall reading
- `zone:update` — recomputed zone risk
- `alert:new` / `alert:updated` — emergency alerts

## Database schema

See `backend/src/db/schema.sql` — tables: `users`, `stations`, `river_readings`, `districts`,
`rainfall_readings`, `flood_zones`, `alerts`.

## Reliability notes

- Postgres is the source of truth; Redis only caches "latest value" + pub/sub, so a Redis
  restart never loses data.
- Backend retries DB/Redis connections with backoff on boot and exposes `/api/health`
  for container orchestration liveness/readiness probes.
- All API responses follow a consistent `{ success, data | error }` envelope.
- Manual validation on every write endpoint; centralized error middleware.
- Passwords are bcrypt-hashed (never stored or logged in plaintext); JWTs expire after 12h.

## Deployment

See [DEPLOY.md](./DEPLOY.md) for a full walkthrough deploying the backend (+ Postgres +
Redis) to Render and the frontend to Vercel, using the included `render.yaml` Blueprint.

## Placement / portfolio use

See [docs/PLACEMENT_PREP.md](./docs/PLACEMENT_PREP.md) for positioning language, resume
bullets, and detailed interview Q&A grounded in what's actually implemented here.

