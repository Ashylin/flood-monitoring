# River Gauge Sensor Firmware (ESP32 + Ultrasonic)

Turns a $10–15 ultrasonic sensor into a real river gauge that reports directly
into the Flood Monitoring backend — the same way USGS/UK Environment Agency
gauges work under the hood, just at hobbyist scale.

## Hardware (~₹800–1,500 per station)

| Part | Notes |
|---|---|
| ESP32 dev board | Any variant (WROOM32 etc.) — has WiFi built in |
| JSN-SR04T waterproof ultrasonic sensor | Outdoor-rated version of the common HC-SR04; measures distance to water surface |
| 5V power (USB power bank / solar panel + battery + charge controller) | For unattended outdoor deployment |
| Weatherproof enclosure | Mount above the river, sensor facing straight down at the water |
| (Optional) SIM800L GSM module | Swap for WiFi if there's no WiFi at the site — code note below |

## How it works

1. Mount the sensor on a bridge, pole, or gauge post directly above the water, facing straight down.
2. It measures the distance from itself to the water surface.
3. `water_level = station_reference_height - distance_to_water` (you calibrate `station_reference_height` once, at install time, against a known level).
4. Every `READING_INTERVAL_MS`, the ESP32 POSTs the computed level to your backend's device endpoint.

## Backend setup (do this first)

1. Get a device token for the station (requires an admin JWT — log in via
   `POST /api/auth/login` first, or use the token an admin account already has):
   ```bash
   curl -X POST http://your-server:4000/api/rivers/1/provision-device \
     -H "Authorization: Bearer <admin-jwt-token>"
   ```
   Response includes `device_token` — copy it into the firmware config below. **This token is shown once; store it safely.**
2. Flash the firmware with your WiFi credentials, server URL, station ID, device token, and the reference height you measured at install time.

## Firmware

See `river_gauge.ino` — flash with Arduino IDE (install the "ESP32" board package first) or PlatformIO.

## Calibrating `STATION_REFERENCE_HEIGHT_M`

At install time, measure (with a tape measure or laser) the vertical distance
from the sensor to a known point — e.g. the riverbed, or a fixed benchmark —
and set `STATION_REFERENCE_HEIGHT_M` so that `water_level` reads correctly
against your station's actual `watch_level`/`warning_level`/`danger_level`
thresholds in the database.

## Power notes for solar/unattended deployment

- Deep-sleep the ESP32 between readings to save power — wake, measure, POST, sleep.
- A 5W solar panel + 18650 battery + TP4056 charge module is a common cheap combo for a station reporting every 5–15 minutes.
- If there's no WiFi at the site, swap the WiFi calls for a SIM800L GSM module posting over HTTP — the backend endpoint doesn't care how the request arrives.
