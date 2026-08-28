# Deployment Guide

This deploys the backend (API + Postgres + Redis) to **Render** using the included
`render.yaml` Blueprint, and the frontend to **Vercel**. Both have free tiers
suitable for a placement/portfolio demo — verify current pricing/limits on each
platform before deploying, since these change over time.

Total time: ~15 minutes, most of it waiting for builds.

---

## Part 1 — Push to GitHub

Render and Vercel both deploy from a Git repository, so this has to happen first.

```bash
cd flood-monitoring-system
git init
git add .
git commit -m "Initial commit"
```

Create a new repository on GitHub (via the website), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/flood-monitoring-system.git
git branch -M main
git push -u origin main
```

---

## Part 2 — Backend + Postgres + Redis (Render)

1. Go to [dashboard.render.com](https://dashboard.render.com) and sign up/log in (GitHub login is easiest).
2. Click **New** → **Blueprint**.
3. Connect your GitHub account if you haven't, then select the `flood-monitoring-system` repo.
4. Render detects `render.yaml` at the repo root and shows you a preview of what it will create:
   - `flood-postgres` (managed Postgres database)
   - `flood-redis` (managed Redis/Key Value store)
   - `flood-backend` (the API, built from `backend/Dockerfile`)
5. Click **Apply** / **Deploy Blueprint**. Render provisions all three and starts building — this takes a few minutes the first time.
6. Once `flood-backend` shows **Live**, copy its URL (something like `https://flood-backend-xxxx.onrender.com`) — you'll need it for the frontend.

### Run the database migration

The schema doesn't apply itself — run it once against the live database:

1. In the Render dashboard, open the `flood-backend` service → **Shell** tab (this opens a terminal inside the running container).
2. Run:
   ```bash
   npm run migrate
   ```
3. (Optional) Create your first admin account:
   ```bash
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=your-password-here npm run seed:admin
   ```

### Verify it's actually working

```bash
curl https://YOUR-BACKEND-URL.onrender.com/api/health
```

You should get back `{"success":true,"data":{"status":"healthy",...}}`. If `db` or
`redis` show `false`, double-check the Blueprint's environment variables got wired
correctly (they should be automatic via `fromDatabase`/`fromService` in `render.yaml`).

Free-tier web services on Render spin down after 15 minutes idle — the first request
after idle time takes ~30–60 seconds to wake up. This is normal, not a bug; mention it if demoing live.

---

## Part 3 — Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) and sign up/log in (GitHub login is easiest).
2. Click **Add New** → **Project**, then import the same `flood-monitoring-system` GitHub repo.
3. **Important — this is a monorepo**: in the project configuration screen, set:
   - **Root Directory**: `frontend`
   - Framework preset: Vercel should auto-detect **Vite**.
4. Add environment variables (same screen, or Project Settings → Environment Variables afterward):
   - `VITE_API_URL` = `https://YOUR-BACKEND-URL.onrender.com/api`
   - `VITE_SOCKET_URL` = `https://YOUR-BACKEND-URL.onrender.com`
5. Click **Deploy**. Takes 1–2 minutes.
6. Once live, copy the Vercel URL (e.g. `https://flood-monitoring-system.vercel.app`).

### Connect the two: fix CORS

Go back to Render → `flood-backend` → **Environment**, and set:
- `CORS_ORIGIN` = `https://flood-monitoring-system.vercel.app` (your actual Vercel URL, no trailing slash)

Save — this triggers an automatic redeploy of the backend. Once it's back up, your
frontend can actually talk to it (without this, the browser blocks the requests).

---

## Part 4 — Verify the whole thing

Open your Vercel URL in a browser. You should see:
- The dashboard loading real data (38 districts, river stations)
- The socket "Live" badge turning green after a couple seconds
- Rainfall numbers actually populating within ~15 minutes (Open-Meteo polls on that interval — see backend logs in Render if you want to watch it happen sooner)

Try logging in with the admin account you seeded, and creating a test alert — it
should appear instantly without a page refresh (that's the WebSocket working).

---

## Costs & limits to know about

- **Render free Postgres expires ~30 days after creation.** Fine for a demo/interview window; if you need it longer-term, upgrade the database plan before day 30 or you'll lose the data.
- **Render free web services spin down after 15 min idle.** Fine for portfolio use; annoying if you want it always-instant for a live interview — consider upgrading `flood-backend`'s plan the day before an interview if that matters.
- **Vercel's free tier** is generous for a static frontend and unlikely to be a constraint here.
- Pricing on all platforms changes — check current numbers at render.com/pricing and vercel.com/pricing before committing to anything long-term.

## Alternative: fully local Docker (no cloud accounts needed)

If you just need something running for a demo you control (e.g. your own laptop
during an interview, or a college server), skip all of the above and use:

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

See the main `README.md` for details. This has no spin-down, no expiry, and no
account signups — the trade-off is it's only reachable on your machine/network
unless you expose it yourself (e.g. via ngrok for a quick public link).
