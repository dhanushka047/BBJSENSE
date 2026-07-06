/********************************************************************
 *  IO Builds — Sri Lanka
 *  Dhanushka Udaya Kumara
 *  Embedded Systems Engineer
 *
 *  WIFI SCAN + CONNECT TEST (ESP32-S3)
 *  - Scans WiFi networks
 *  - Finds your SSID
 *  - Connects automatically
 *  - Prints IP
 ********************************************************************/

#include <Arduino.h>
#include <WiFi.h>

const char* WIFI_SSID = "ESPTEST";
const char* WIFI_PSK  = "12345678";

void setup() {
  Serial.begin(115200);
  delay(500);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(200);

  Serial.println("\n=== WiFi Scan + Connect Test ===\n");

  // ---------- SCAN ----------
  Serial.println("Scanning WiFi...\n");

  int n = WiFi.scanNetworks();
  if (n <= 0) {
    Serial.println("No networks found");
  } else {
    for (int i = 0; i < n; i++) {
      Serial.print(i);
      Serial.print(": ");
      Serial.print(WiFi.SSID(i));
      Serial.print("  RSSI=");
      Serial.print(WiFi.RSSI(i));
      Serial.print("  CH=");
      Serial.println(WiFi.channel(i));
    }
  }

  Serial.println("\n--- Scan Complete ---\n");

  // ---------- CONNECT ----------
  Serial.print("Connecting to: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PSK);

  uint8_t retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi Connect FAILED!");
  }
}

void loop() {
  Serial.print("WiFi Status: ");
  Serial.println(WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DISCONNECTED");

  delay(2000);
}