# Placement prep: Tamil Nadu Flood Risk Monitoring System

This document is for you, not for the repo's visitors — it's interview ammunition,
written against what's actually built, not generic advice. Every technical claim
below should match the code; if it ever stops matching (you change something),
update this file too.

---

## Positioning statement (use this almost verbatim if asked "what is this project")

> A lightweight, localized, and explainable flood-risk monitoring prototype for
> Tamil Nadu. It combines real live rainfall data, real river-level submissions
> (manual, IoT-sensor, or future official-API), and zone-level context into a
> transparent 0-100 risk score with a plain-language reason — not a black box.
> It doesn't replace or compete with the Central Water Commission or Tamil Nadu's
> Water Resources Department; it's a full-stack demonstration of the pipeline a
> real early-warning system needs: real-time ingestion, explainable risk scoring,
> automatic alerting, and a dashboard — validated against real historical flood
> data, not just synthetic demo values.

---

## Resume bullets

Pick 3-4 depending on space. Each is written to be defensible if an interviewer
asks "walk me through that" — don't use one you can't back up in detail.

- Built a full-stack, real-time flood-risk monitoring system (React/TypeScript,
  Node/Express, PostgreSQL, Redis, Socket.IO, Docker) with JWT role-based auth,
  62 automated tests, and a CI pipeline running against live Postgres/Redis
  service containers on every push.
- Designed a transparent, rule-based risk-scoring engine (river status + IMD
  rainfall classification + rate-of-change + data-freshness weighting) that
  outputs a 0-100 score and a human-readable explanation for every alert,
  instead of an opaque risk bucket.
- Validated the risk engine's rainfall classification against real historical
  data for the Chennai 2015 and 2021 floods (Open-Meteo's ERA5 reanalysis
  archive + documented IMD figures), with results and honest limitations
  written into a generated report.
- Engineered the system to be honest about data availability by design: river
  stations without a connected feed report "no live feed" rather than a
  fabricated reading, and zones without river data cap their risk score so
  rainfall alone can never falsely signal "critical."
- Built three real river-data ingestion paths — authenticated manual entry,
  per-device-token IoT sensor endpoint (with ESP32 firmware), and a pre-wired
  stub for an official government API — since no public real-time river-level
  API currently exists for India.

---

## Scope & limitations (say this proactively, don't wait to be asked)

- This is **not** an official flood-warning system and doesn't claim CWC/TN-WRD
  accuracy, coverage, or authority. It's a portfolio-grade demonstration of the
  full pipeline a real system needs.
- Rainfall is genuinely real-time (Open-Meteo, polled live). River-level data is
  **not** automatically sourced today, because — verified directly, not assumed —
  no public real-time river-telemetry API exists for India as of August 2026.
  The system is honest about this: stations show "no live feed" until a real
  reading (manual, IoT, or future official API) is connected.
- The risk-scoring thresholds (which score maps to which category, what counts
  as a "rapid rise") are this project's own design choices, informed by IMD's
  official rainfall categories but not an official multi-signal flood-forecasting
  standard.
- The historical backtest evaluates the rainfall-driven component of the engine
  only — no river telemetry exists for 2015/2021 to replay, so it cannot and
  does not claim to reproduce a full multi-signal historical risk score.
- Zone vulnerability currently uses a static population figure; it does not (yet)
  incorporate computed elevation or water-body proximity.

## What existing government systems already do (say this if asked)

- The Central Water Commission runs India's actual gauge network and publishes
  near-real-time levels on its Flood Forecasting portal
  (`ffs.india-water.gov.in`) and the official FloodWatch India app — but with no
  public API.
- IMD provides official rainfall forecasts, warnings, and the rainfall
  classification standard this project's engine reuses.
- Tamil Nadu's Water Resources Department manages actual reservoir operations
  and release decisions this project has no visibility into or authority over.

---

## Interview Q&A

Answers are written the way you'd actually say them — direct, specific, not
padded with buzzwords. Adjust to your own voice, but keep the specifics.

**1. Why did you initially use browser-based mock data?**
To get the UI and interaction design right before committing to backend
architecture — you can iterate on layout and state management in an afternoon
with `setInterval` and fake numbers, instead of waiting on a database schema.
It's a legitimate prototyping step, not a shortcut I wanted to ship.

**2. What limitation did that approach have?**
It couldn't prove anything about the real pipeline — no persistence, no
multi-client consistency, no real auth, no proof the risk logic works against
real inputs. It looked like a monitoring system but wasn't one.

**3. Why did you redesign it as a full-stack system?**
Because the value of a monitoring system is in the pipeline — real ingestion,
persistent history, consistent state across every connected client, and
auditable alerts — not the UI. A convincing demo and a working system are
different claims, and I wanted to be able to make the second one honestly.

**4. Why PostgreSQL?**
It's the system of record: river readings, rainfall history, zones, alerts, and
users all need relational integrity (foreign keys between stations and
readings, unique constraints preventing duplicate seed data — I actually hit
and fixed a real duplicate-row bug from a missing constraint) and durability
that a cache can't guarantee.

**5. Why Redis?**
Two jobs, not one: caching each station/district's "latest reading" so a GET
request doesn't always hit Postgres, and — architecturally — it's the natural
place to add pub/sub if this scaled to multiple backend instances. Postgres
remains the source of truth; Redis is disposable, so a Redis restart never
loses data.

**6. Why Socket.IO?**
Because a monitoring dashboard has to reflect state changes as they happen —
polling would mean either laggy updates or wasted requests. Socket.IO pushes
`river:update`, `rainfall:update`, `zone:update`, and `alert:new`/`alert:updated`
events to every connected client the instant something changes in the backend.

**7. How does the frontend talk to the backend?**
REST over HTTPS for everything request/response (fetching stations, submitting
readings, auth), plus a persistent Socket.IO connection for push updates. The
frontend never polls for freshness — it trusts the socket events and only
re-fetches on initial load or reconnect.

**8. How does authentication work?**
Three separate mechanisms for three different actors, on purpose: humans get
JWTs via `/api/auth/login` (bcrypt-hashed passwords, role claims for
admin/operator/viewer, 12h expiry); IoT sensors get a per-station secret token
via `/api/rivers/:id/provision-device` so a compromised sensor can only ever
post to its own station; and self-registration is capped at
viewer/operator — nobody can grant themselves admin through the API.

**9. How does an alert move through the system, end to end?**
A real reading comes in (manual submission, IoT device, or future official
feed) → the zone-risk worker recomputes that zone's score from river status +
rainfall + rate-of-change → if the score crosses into high/critical *and* the
level actually changed, it inserts a row into the `alerts` table with
`created_by: 'auto-monitor'` and the generated reason string → that insert
triggers a Socket.IO `alert:new` emit → every connected dashboard receives it
and renders it immediately, no refresh. I've verified this end-to-end multiple
times, including confirming `created_by` in the database to prove it wasn't a
manually-created Swagger alert.

**10. How does demo mode differ from live mode?**
Demo mode is backend-driven, not a frontend trick: a `DEMO_MODE=true` flag
starts a service that writes simulated readings — tagged `data_source: 'demo'`
— through the exact same Postgres/Redis/Socket.IO pipeline real data uses. It
never touches a station that already has a real feed connected, and the
frontend shows a persistent "DEMO MODE ACTIVE" banner. The point was to prove
even the demo goes through the real pipeline, not a shortcut around it.

**11. How is environmental data obtained?**
Rainfall: Open-Meteo's free, no-key API, polled live every 15 minutes for all
38 Tamil Nadu districts — genuinely real. River levels: no public real-time API
exists for India today (I verified this directly rather than assuming), so the
system supports three real paths instead — authenticated manual entry,
per-device IoT sensor tokens with actual ESP32 firmware, and a pre-wired stub
ready to activate the moment official access exists.

**12. How is the risk score calculated?**
Three weighted components, capped at 100: river status contributes up to 60
points (danger=60, warning=45, watch=30, normal=10, no feed=0), 24h rainfall
contributes up to 30 points based on IMD's official rainfall categories, and a
detected rapid rise (>0.2m/hr) adds up to 10. Critically, if there's no river
feed, that component is forced to zero — so rainfall alone can never push a
score into "high" or "critical," which I have a specific test enforcing.

**13. How does the system automatically generate alerts?**
A background worker recomputes every zone's risk on an interval. If the
computed level crosses into high or critical *and* it's a genuine change from
the last computed level, it inserts an alert automatically — no human touches
Swagger for this path. Swagger still exists, but only as a developer/testing
tool for manual operator actions, not the primary alerting mechanism.

**14. What do existing government systems already do?**
[See "What existing government systems already do" above — say it plainly,
don't undersell it or oversell your own system by comparison.]

**15. What's the scope and limitations of your prototype?**
[See "Scope & limitations" above.]

**16. What did you personally implement?**
Everything in the repo — architecture, schema design, the risk-scoring engine
and its test suite, the auth system, the ingestion adapters, the IoT firmware,
CI pipeline, and deployment configuration. Be ready to open the actual code and
walk through any file if asked; don't claim more polish than exists (e.g., the
zone vulnerability score is still just population — say that if asked, don't
pretend it's computed from elevation data yet).

---

## If they ask something this doc doesn't cover

Default to the same honesty pattern used throughout the build: state what's
real, state what's simulated or not yet built, and explain *why* it's built
that way rather than defending it as complete. That consistency — "the
architecture never fakes what it doesn't know" — is the actual differentiator
of this project versus a generic dashboard-plus-mock-alerts build, and it's a
stronger interview answer than pretending everything is finished.
