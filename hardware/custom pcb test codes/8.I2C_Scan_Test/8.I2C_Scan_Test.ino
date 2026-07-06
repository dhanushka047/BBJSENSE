/********************************************************************
 *  IO Builds — Sri Lanka
 *  Dhanushka Udaya Kumara
 *  Embedded Systems Engineer
 *
 *  I2C SCAN TEST
 *  SDA = GPIO22
 *  SCL = GPIO21
 ********************************************************************/

#include <Arduino.h>
#include <Wire.h>

#define SDA_PIN 21
#define SCL_PIN 22

void setup() {
  Serial.begin(115200);
  delay(300);

  Wire.begin(SDA_PIN, SCL_PIN);
}

void loop() {
  Serial.println("Scanning I2C...");

  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print("Found device at 0x");
      Serial.println(addr, HEX);
      delay(5);
    }
  }

  Serial.println("Scan done.\n");
  delay(2000);
}