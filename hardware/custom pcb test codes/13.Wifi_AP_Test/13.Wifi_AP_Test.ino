/********************************************************************
 *  IO Builds — Sri Lanka
 *  Dhanushka Udaya Kumara
 *  Embedded Systems Engineer
 *
 *  WIFI AP MODE TEST (ESP32-S3)
 *  SSID: IO-Builds-AP
 *  PASS: 12345678
 ********************************************************************/

#include <Arduino.h>
#include <WiFi.h>

const char* AP_SSID = "IO-Builds-AP";
const char* AP_PASS = "12345678";

void setup() {
  Serial.begin(115200);
  delay(300);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);

  Serial.println("AP Mode Started");
  Serial.print("SSID: "); Serial.println(AP_SSID);
  Serial.print("PASS: "); Serial.println(AP_PASS);
  Serial.print("AP IP: "); Serial.println(WiFi.softAPIP());
}

void loop() {
  Serial.print("Connected Stations: ");
  Serial.println(WiFi.softAPgetStationNum());
  delay(2000);
}