/*
 * River Gauge Sensor — ESP32 + JSN-SR04T waterproof ultrasonic sensor
 *
 * Measures distance to the water surface, computes water level, and posts
 * it to the Flood Monitoring backend's device-ingestion endpoint:
 *   POST /api/rivers/:id/device-readings
 *   header: x-device-token: <token from /provision-device>
 *   body:   { "water_level": <meters>, "flow_rate": null }
 *
 * Get a device token first:
 *   curl -X POST http://YOUR_SERVER:4000/api/rivers/STATION_ID/provision-device \
 *     -H "x-api-key: change_me_super_secret"
 */

#include <WiFi.h>
#include <HTTPClient.h>

// ---------- CONFIGURE THESE FOR YOUR DEPLOYMENT ----------
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* SERVER_BASE_URL = "http://YOUR_SERVER_IP:4000"; // e.g. http://203.0.113.5:4000
const int STATION_ID = 1;                                    // matches the id in your `stations` table
const char* DEVICE_TOKEN = "PASTE_TOKEN_FROM_PROVISION_DEVICE";

// Vertical distance (meters) from the sensor to your station's zero-level
// reference (e.g. riverbed or a fixed benchmark). Calibrate at install time.
const float STATION_REFERENCE_HEIGHT_M = 6.0;

const unsigned long READING_INTERVAL_MS = 5UL * 60UL * 1000UL; // every 5 minutes
// -----------------------------------------------------------

const int TRIG_PIN = 5;
const int ECHO_PIN = 18;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  connectWiFi();
}

void loop() {
  float distanceM = measureDistanceMeters();

  if (distanceM > 0) {
    float waterLevel = STATION_REFERENCE_HEIGHT_M - distanceM;
    if (waterLevel < 0) waterLevel = 0; // sensor above dry riverbed reads as 0, not negative

    Serial.printf("Distance: %.2f m | Computed water level: %.2f m\n", distanceM, waterLevel);
    postReading(waterLevel);
  } else {
    Serial.println("Sensor read failed (out of range / no echo) — skipping this cycle");
  }

  // For battery-powered deployments, replace this delay with esp_deep_sleep()
  // configured for READING_INTERVAL_MS instead, to save power between reads.
  delay(READING_INTERVAL_MS);
}

void connectWiFi() {
  Serial.printf("Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi connection failed — will retry on next loop via HTTP error handling");
  }
}

// Returns distance in meters, or -1.0 on failure.
float measureDistanceMeters() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long durationUs = pulseIn(ECHO_PIN, HIGH, 30000UL); // 30ms timeout ~= 5m max range safety
  if (durationUs == 0) return -1.0;

  // Speed of sound ~343 m/s -> distance(m) = duration(s) * 343 / 2
  float distanceM = (durationUs / 1000000.0) * 343.0 / 2.0;
  return distanceM;
}

void postReading(float waterLevel) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  HTTPClient http;
  String url = String(SERVER_BASE_URL) + "/api/rivers/" + String(STATION_ID) + "/device-readings";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);

  String body = "{\"water_level\":" + String(waterLevel, 2) + "}";
  int httpCode = http.POST(body);

  if (httpCode > 0) {
    Serial.printf("POST -> HTTP %d: %s\n", httpCode, http.getString().c_str());
  } else {
    Serial.printf("POST failed: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}
