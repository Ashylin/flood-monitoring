-- Flood Monitoring System schema (Tamil Nadu coverage)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer', -- admin | operator | viewer
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  river_name VARCHAR(120) NOT NULL,
  district VARCHAR(120) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  danger_level NUMERIC(6,2) NOT NULL,
  warning_level NUMERIC(6,2) NOT NULL,
  watch_level NUMERIC(6,2) NOT NULL,
  -- 'live_feed'  = wired to a real telemetry/API source (see ingestion/)
  -- 'manual'     = an operator enters readings by hand
  -- 'iot_device' = a physical sensor (ESP32/RPi) reports readings automatically
  -- 'demo'       = simulated demo data only — never treated as real
  -- 'unavailable'= no data source connected yet; UI shows "no live feed"
  data_source VARCHAR(20) NOT NULL DEFAULT 'unavailable',
  -- Set only for data_source = 'iot_device'. A per-station secret token the
  -- physical sensor sends to prove it's authorized to post readings.
  device_token VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS river_readings (
  id BIGSERIAL PRIMARY KEY,
  station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  water_level NUMERIC(6,2) NOT NULL,
  flow_rate NUMERIC(10,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_river_readings_station_time ON river_readings(station_id, recorded_at DESC);

-- Safe upgrade path for databases created before device_token/demo existed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'device_token'
  ) THEN
    ALTER TABLE stations ADD COLUMN device_token VARCHAR(64);
  END IF;
END $$;

-- Safe upgrade path for databases created before stations.name had a UNIQUE
-- constraint (older installs would silently accumulate duplicate seed rows
-- every time `npm run migrate` was re-run). De-duplicates first (keeping the
-- lowest id per name), then adds the constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stations_name_key'
  ) THEN
    DELETE FROM stations a USING stations b
      WHERE a.id > b.id AND a.name = b.name;
    ALTER TABLE stations ADD CONSTRAINT stations_name_key UNIQUE (name);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS districts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  state VARCHAR(80) NOT NULL DEFAULT 'Tamil Nadu',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS rainfall_readings (
  id BIGSERIAL PRIMARY KEY,
  district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  intensity_mm_hr NUMERIC(6,2) NOT NULL,
  accumulated_24h_mm NUMERIC(7,2) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rainfall_district_time ON rainfall_readings(district_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS flood_zones (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  district VARCHAR(120) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  population_at_risk INTEGER DEFAULT 0,
  station_id INTEGER REFERENCES stations(id),
  risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safe upgrade path for databases created before flood_zones.name had a
-- UNIQUE constraint (see the stations equivalent above for why this matters).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'flood_zones_name_key'
  ) THEN
    DELETE FROM flood_zones a USING flood_zones b
      WHERE a.id > b.id AND a.name = b.name;
    ALTER TABLE flood_zones ADD CONSTRAINT flood_zones_name_key UNIQUE (name);
  END IF;
END $$;

-- Safe upgrade path for databases created before the explainable risk
-- engine existed (adds numeric score + human-readable reason + a freshness
-- flag alongside the existing risk_level bucket).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flood_zones' AND column_name = 'risk_score'
  ) THEN
    ALTER TABLE flood_zones ADD COLUMN risk_score INTEGER;
    ALTER TABLE flood_zones ADD COLUMN risk_reason TEXT;
    ALTER TABLE flood_zones ADD COLUMN data_freshness VARCHAR(20) DEFAULT 'unknown';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  zone_id INTEGER REFERENCES flood_zones(id),
  station_id INTEGER REFERENCES stations(id),
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_by VARCHAR(120) DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);

-- Raw hourly rainfall for historical backtest events (e.g. Chennai Dec 2015).
-- Stores only the immutable historical fact (real, cited precipitation
-- figures from Open-Meteo's ERA5 reanalysis archive) — risk scores are
-- always computed at read time from this via the same engine that scores
-- live/demo data, never cached here, so a backtest always reflects the
-- current risk logic. event_slug matches backend/src/backtest/knownEvents.js.
CREATE TABLE IF NOT EXISTS historical_rainfall_hourly (
  id BIGSERIAL PRIMARY KEY,
  event_slug VARCHAR(60) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  precipitation_mm NUMERIC(6,2) NOT NULL,
  UNIQUE (event_slug, recorded_at)
);
CREATE INDEX IF NOT EXISTS idx_historical_rainfall_event_time ON historical_rainfall_hourly(event_slug, recorded_at);

-- ============================================================
-- Seed: all 38 Tamil Nadu districts, with real district-HQ coordinates.
-- Rainfall for every one of these is polled LIVE from Open-Meteo.
-- ============================================================
INSERT INTO districts (name, state, latitude, longitude) VALUES
  ('Chennai', 'Tamil Nadu', 13.0827, 80.2707),
  ('Tiruvallur', 'Tamil Nadu', 13.1231, 79.9120),
  ('Chengalpattu', 'Tamil Nadu', 12.6925, 79.9770),
  ('Kanchipuram', 'Tamil Nadu', 12.8342, 79.7036),
  ('Vellore', 'Tamil Nadu', 12.9165, 79.1325),
  ('Ranipet', 'Tamil Nadu', 12.9249, 79.3308),
  ('Tirupathur', 'Tamil Nadu', 12.4959, 78.5686),
  ('Krishnagiri', 'Tamil Nadu', 12.5266, 78.2150),
  ('Dharmapuri', 'Tamil Nadu', 12.1277, 78.1580),
  ('Salem', 'Tamil Nadu', 11.6643, 78.1460),
  ('Namakkal', 'Tamil Nadu', 11.2189, 78.1677),
  ('Erode', 'Tamil Nadu', 11.3410, 77.7172),
  ('Tiruppur', 'Tamil Nadu', 11.1085, 77.3411),
  ('Coimbatore', 'Tamil Nadu', 11.0168, 76.9558),
  ('Nilgiris', 'Tamil Nadu', 11.4064, 76.6932),
  ('Karur', 'Tamil Nadu', 10.9601, 78.0766),
  ('Tiruchirappalli', 'Tamil Nadu', 10.7905, 78.7047),
  ('Perambalur', 'Tamil Nadu', 11.2333, 78.8667),
  ('Ariyalur', 'Tamil Nadu', 11.1401, 79.0782),
  ('Cuddalore', 'Tamil Nadu', 11.7480, 79.7714),
  ('Villupuram', 'Tamil Nadu', 11.9401, 79.4861),
  ('Kallakurichi', 'Tamil Nadu', 11.7385, 78.9593),
  ('Thanjavur', 'Tamil Nadu', 10.7870, 79.1378),
  ('Tiruvarur', 'Tamil Nadu', 10.7661, 79.6345),
  ('Nagapattinam', 'Tamil Nadu', 10.7672, 79.8449),
  ('Mayiladuthurai', 'Tamil Nadu', 11.1014, 79.6540),
  ('Pudukkottai', 'Tamil Nadu', 10.3813, 78.8213),
  ('Madurai', 'Tamil Nadu', 9.9252, 78.1198),
  ('Theni', 'Tamil Nadu', 10.0104, 77.4768),
  ('Dindigul', 'Tamil Nadu', 10.3624, 77.9695),
  ('Sivaganga', 'Tamil Nadu', 9.8433, 78.4809),
  ('Ramanathapuram', 'Tamil Nadu', 9.3639, 78.8395),
  ('Virudhunagar', 'Tamil Nadu', 9.5852, 77.9577),
  ('Tirunelveli', 'Tamil Nadu', 8.7139, 77.7567),
  ('Tenkasi', 'Tamil Nadu', 8.9598, 77.3152),
  ('Thoothukudi', 'Tamil Nadu', 8.7642, 78.1348),
  ('Kanyakumari', 'Tamil Nadu', 8.1780, 77.4300),
  ('Salem Rural', 'Tamil Nadu', 11.7000, 78.0000)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Seed: river gauge stations for known flood-prone rivers in TN.
-- data_source = 'unavailable' because no public live telemetry feed exists
-- for these today (see README). Wire in real readings via the 'manual'
-- ingestion endpoint, or flip data_source to 'live_feed' once you connect
-- an official source (state WRD, your own IoT sensors, etc).
-- ============================================================
INSERT INTO stations (name, river_name, district, latitude, longitude, danger_level, warning_level, watch_level, data_source) VALUES
  ('Manali Gauge', 'Kosasthalaiyar', 'Tiruvallur', 13.1650, 80.2600, 6.5, 5.5, 4.5, 'unavailable'),
  ('Poonamallee Gauge', 'Adyar', 'Chennai', 13.0500, 80.1000, 5.0, 4.0, 3.2, 'unavailable'),
  ('Saidapet Gauge', 'Adyar', 'Chennai', 13.0230, 80.2230, 4.8, 3.9, 3.0, 'unavailable'),
  ('Musiri Gauge', 'Cauvery', 'Tiruchirappalli', 10.9420, 78.4430, 8.0, 7.0, 6.0, 'unavailable'),
  ('Mettur Dam Gauge', 'Cauvery', 'Salem', 11.7880, 77.8010, 120.0, 115.0, 110.0, 'unavailable'),
  ('Vaigai Dam Gauge', 'Vaigai', 'Theni', 9.9430, 77.4670, 71.0, 68.0, 65.0, 'unavailable')
ON CONFLICT (name) DO NOTHING;

INSERT INTO flood_zones (name, district, latitude, longitude, population_at_risk, station_id, risk_level) VALUES
  ('Ennore Creek Belt', 'Tiruvallur', 13.2146, 80.3212, 26000, 1, 'low'),
  ('Saidapet-Velachery Basin', 'Chennai', 13.0210, 80.2230, 42000, 3, 'low'),
  ('Musiri Riverbank', 'Tiruchirappalli', 10.9500, 78.4500, 18000, 4, 'low'),
  ('Mettur Downstream Belt', 'Salem', 11.7200, 77.8300, 31000, 5, 'low'),
  ('Vaigai Basin Lowlands', 'Theni', 9.9600, 77.4900, 15000, 6, 'low')
ON CONFLICT (name) DO NOTHING;
