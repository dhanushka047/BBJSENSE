/********************************************************************
 *  IO Builds — Sri Lanka
 *  Dhanushka Udaya Kumara
 *  Embedded Systems Engineer
 *
 *  PCF8563 RTC Test using IO_PCF8563 library
 *  SDA = GPIO22, SCL = GPIO21 (ESP32-S3)
 ********************************************************************/

#include <Arduino.h>
#include <Wire.h>
#include "IO_PCF8563.h"

#define SDA_PIN 22
#define SCL_PIN 21

IO_PCF8563 rtc;

void setup() {
  Serial.begin(115200);
  delay(300);

  if (!rtc.begin(Wire, SDA_PIN, SCL_PIN)) {
    Serial.println("RTC init FAILED");
    while (1) delay(100);
  }

  if (rtc.lostPower()) {
    Serial.println("RTC lost power, setting default time...");
    IO_RTC_DateTime setTime;
    setTime.year    = 2025;
    setTime.month   = 1;
    setTime.day     = 1;
    setTime.weekday = 0;
    setTime.hour    = 0;
    setTime.minute  = 0;
    setTime.second  = 0;
    rtc.setDateTime(setTime);
  }
}

void loop() {
  IO_RTC_DateTime now;
  if (rtc.getDateTime(now)) {
    Serial.print(now.year);   Serial.print("-");
    Serial.print(now.month);  Serial.print("-");
    Serial.print(now.day);    Serial.print(" ");

    Serial.print(now.hour);   Serial.print(":");
    Serial.print(now.minute); Serial.print(":");
    Serial.print(now.second); Serial.print("  W=");
    Serial.println(now.weekday);
  } else {
    Serial.println("RTC read error");
  }

  delay(1000);
}