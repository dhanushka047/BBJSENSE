/********************************************************************
 *  IO Builds — Sri Lanka
 *  Dhanushka Udaya Kumara
 *  Embedded Systems Engineer
 *
 *  Minimal PCF8563 RTC Library for ESP32 / Arduino
 ********************************************************************/

#pragma once
#include <Arduino.h>
#include <Wire.h>

struct IO_RTC_DateTime {
  uint16_t year;   // e.g. 2025
  uint8_t  month;  // 1-12
  uint8_t  day;    // 1-31
  uint8_t  weekday;// 0-6 (user mapping)
  uint8_t  hour;   // 0-23
  uint8_t  minute; // 0-59
  uint8_t  second; // 0-59
};

class IO_PCF8563 {
 public:
  IO_PCF8563(uint8_t address = 0x51);

  bool begin(TwoWire &w = Wire, int sda = -1, int scl = -1);
  bool setDateTime(const IO_RTC_DateTime &dt);
  bool getDateTime(IO_RTC_DateTime &dt);

  bool isRunning();      // true if STOP bit = 0
  bool lostPower();      // true if VL bit set

 private:
  uint8_t _addr;
  TwoWire *_wire;

  uint8_t _bcdEncode(uint8_t v);
  uint8_t _bcdDecode(uint8_t v);

  bool _writeReg(uint8_t reg, uint8_t value);
  bool _readRegs(uint8_t startReg, uint8_t *buf, uint8_t len);
};