/********************************************************************
 *  IO Builds — Sri Lanka
 *  Dhanushka Udaya Kumara
 *  Embedded Systems Engineer
 *
 *  Minimal PCF8563 RTC Library for ESP32 / Arduino
 ********************************************************************/

#include "IO_PCF8563.h"

#define PCF8563_REG_CTRL1     0x00
#define PCF8563_REG_CTRL2     0x01
#define PCF8563_REG_SECONDS   0x02
#define PCF8563_REG_MINUTES   0x03
#define PCF8563_REG_HOURS     0x04
#define PCF8563_REG_DAYS      0x05
#define PCF8563_REG_WEEKDAYS  0x06
#define PCF8563_REG_MONTHS    0x07
#define PCF8563_REG_YEARS     0x08

IO_PCF8563::IO_PCF8563(uint8_t address)
: _addr(address), _wire(&Wire) {}

bool IO_PCF8563::begin(TwoWire &w, int sda, int scl) {
  _wire = &w;

  if (sda >= 0 && scl >= 0) {
    _wire->begin(sda, scl);
  } else {
    _wire->begin();
  }

  // Try a simple read to see if device ACKs
  _wire->beginTransmission(_addr);
  if (_wire->endTransmission() != 0) {
    return false;
  }

  // Normal mode, STOP=0, TEST bits=0
  _writeReg(PCF8563_REG_CTRL1, 0x00);
  _writeReg(PCF8563_REG_CTRL2, 0x00);

  return true;
}

uint8_t IO_PCF8563::_bcdEncode(uint8_t v) {
  return ((v / 10) << 4) | (v % 10);
}

uint8_t IO_PCF8563::_bcdDecode(uint8_t v) {
  return (v >> 4) * 10 + (v & 0x0F);
}

bool IO_PCF8563::_writeReg(uint8_t reg, uint8_t value) {
  _wire->beginTransmission(_addr);
  _wire->write(reg);
  _wire->write(value);
  return (_wire->endTransmission() == 0);
}

bool IO_PCF8563::_readRegs(uint8_t startReg, uint8_t *buf, uint8_t len) {
  _wire->beginTransmission(_addr);
  _wire->write(startReg);
  if (_wire->endTransmission(false) != 0) {
    return false;
  }

  uint8_t read = _wire->requestFrom((int)_addr, (int)len);
  if (read != len) return false;

  for (uint8_t i = 0; i < len; i++) {
    buf[i] = _wire->read();
  }
  return true;
}

bool IO_PCF8563::setDateTime(const IO_RTC_DateTime &dt) {
  uint8_t buf[7];

  // Seconds: clear VL bit
  buf[0] = _bcdEncode(dt.second) & 0x7F;
  buf[1] = _bcdEncode(dt.minute) & 0x7F;
  buf[2] = _bcdEncode(dt.hour)   & 0x3F;
  buf[3] = _bcdEncode(dt.day)    & 0x3F;
  buf[4] = (dt.weekday & 0x07);

  uint16_t year = dt.year;
  uint8_t year_bcd;
  uint8_t month_bcd = _bcdEncode(dt.month) & 0x1F;
  uint8_t century_bit = 0;

  if (year >= 2000) {
    year_bcd = _bcdEncode((uint8_t)(year - 2000));
    century_bit = 0x80; // C=1 → 20xx
  } else {
    year_bcd = _bcdEncode((uint8_t)(year - 1900));
    century_bit = 0x00; // C=0 → 19xx
  }

  buf[5] = month_bcd | century_bit;
  buf[6] = year_bcd;

  // Write starting at seconds register
  _wire->beginTransmission(_addr);
  _wire->write(PCF8563_REG_SECONDS);
  for (uint8_t i = 0; i < 7; i++) {
    _wire->write(buf[i]);
  }
  return (_wire->endTransmission() == 0);
}

bool IO_PCF8563::getDateTime(IO_RTC_DateTime &dt) {
  uint8_t buf[7];
  if (!_readRegs(PCF8563_REG_SECONDS, buf, 7)) {
    return false;
  }

  uint8_t sec_reg   = buf[0];
  uint8_t min_reg   = buf[1];
  uint8_t hour_reg  = buf[2];
  uint8_t day_reg   = buf[3];
  uint8_t wk_reg    = buf[4];
  uint8_t month_reg = buf[5];
  uint8_t year_reg  = buf[6];

  dt.second  = _bcdDecode(sec_reg & 0x7F);
  dt.minute  = _bcdDecode(min_reg & 0x7F);
  dt.hour    = _bcdDecode(hour_reg & 0x3F);
  dt.day     = _bcdDecode(day_reg & 0x3F);
  dt.weekday = wk_reg & 0x07;

  bool century_bit = (month_reg & 0x80) != 0;
  uint8_t month_bcd = month_reg & 0x1F;
  dt.month = _bcdDecode(month_bcd);

  uint8_t y = _bcdDecode(year_reg);
  dt.year = (century_bit ? 2000 : 1900) + y;

  return true;
}

bool IO_PCF8563::isRunning() {
  uint8_t v;
  if (!_readRegs(PCF8563_REG_CTRL1, &v, 1)) return false;
  // STOP bit (bit 5): 0 = running
  return ((v & 0x20) == 0);
}

bool IO_PCF8563::lostPower() {
  uint8_t sec;
  if (!_readRegs(PCF8563_REG_SECONDS, &sec, 1)) return true;
  // VL bit (bit 7): 1 = clock integrity not guaranteed
  return (sec & 0x80) != 0;
}