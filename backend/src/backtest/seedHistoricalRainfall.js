/**
 * Idempotently seeds real historical hourly rainfall for backtest events
 * (currently: chennai-dec-2015 only — see knownEvents.js for why 2021 isn't
 * seeded yet) from Open-Meteo's historical archive (ERA5 reanalysis,
 * archive-api.open-meteo.com, free, no key, 1940-present).
 *
 * Runs on every container boot (chained in the Dockerfile CMD, same pattern
 * as migrate.js) so it always executes with the container's own real
 * internet access. Deliberately fail-soft: a fetch failure here must never
 * crash server startup — this is a nice-to-have historical feature, not
 * core to the live monitoring system.
 */
require("dotenv").config();
const { query } = require("../config/db");
const events = require("./knownEvents");

const SEEDED_SLUGS = ["chennai-dec-2015"]; // see knownEvents.js — 2021 not yet built into the UI

function dateRangeAround(peakDateStr, daysBefore, daysAfter) {
  const peak = new Date(`${peakDateStr}T00:00:00Z`);
  const start = new Date(peak);
  start.setUTCDate(start.getUTCDate() - daysBefore);
  const end = new Date(peak);
  end.setUTCDate(end.getUTCDate() + daysAfter);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

async function fetchHistoricalHourly(latitude, longitude, startDate, endDate) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&hourly=precipitation&timezone=Asia%2FKolkata`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo archive request failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const times = data?.hourly?.time || [];
  const precip = data?.hourly?.precipitation || [];
  return times.map((t, i) => ({ time: t, precipitationMm: Number(precip[i]) || 0 }));
}

async function seedEvent(event) {
  const existing = await query("SELECT count(*) FROM historical_rainfall_hourly WHERE event_slug = $1", [event.slug]);
  if (Number(existing.rows[0].count) > 0) {
    console.log(`[seed-historical] ${event.slug} already seeded (${existing.rows[0].count} rows) — skipping fetch`);
    return;
  }

  const { startDate, endDate } = dateRangeAround(event.peakDate, 10, 2);
  const hourly = await fetchHistoricalHourly(event.latitude, event.longitude, startDate, endDate);
  if (!hourly.length) {
    console.warn(`[seed-historical] ${event.slug} — Open-Meteo returned no hourly data, nothing to seed`);
    return;
  }

  for (const point of hourly) {
    await query(
      `INSERT INTO historical_rainfall_hourly (event_slug, recorded_at, precipitation_mm)
       VALUES ($1, $2, $3) ON CONFLICT (event_slug, recorded_at) DO NOTHING`,
      [event.slug, point.time, point.precipitationMm.toFixed(2)]
    );
  }
  console.log(`[seed-historical] ${event.slug} — seeded ${hourly.length} real hourly rainfall points from Open-Meteo/ERA5 (${startDate} to ${endDate})`);
}

async function seedHistoricalRainfall() {
  for (const slug of SEEDED_SLUGS) {
    const event = events.find((e) => e.slug === slug);
    if (!event) continue;
    try {
      await seedEvent(event);
    } catch (err) {
      console.warn(`[seed-historical] ${slug} failed (${err.message}) — will retry on next boot, not blocking startup`);
    }
  }
}

module.exports = { seedHistoricalRainfall };

if (require.main === module) {
  seedHistoricalRainfall()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[seed-historical] unexpected error", err);
      process.exit(0); // still exit 0 — never block the boot chain
    });
}
