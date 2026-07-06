// ADS1115.h
// Minimal ADS1115 driver for ESP32 (Arduino framework)
// Dhanushka / io builds.com style 😉 – single-shot, blocking read.

#pragma once

#include <Arduino.h>
#include <Wire.h>

class ADS1115
{
public:
    // I2C addresses depending on ADDR pin
    static constexpr uint8_t ADDR_GND = 0x48; // ADDR -> GND
    static constexpr uint8_t ADDR_VDD = 0x49; // ADDR -> VDD
    static constexpr uint8_t ADDR_SDA = 0x4A; // ADDR -> SDA
    static constexpr uint8_t ADDR_SCL = 0x4B; // ADDR -> SCL

    // PGA full-scale range settings (datasheet Table 7-1)
    enum Gain : uint8_t
    {
        GAIN_6V144 = 0, // ±6.144V
        GAIN_4V096 = 1, // ±4.096V
        GAIN_2V048 = 2, // ±2.048V (default)
        GAIN_1V024 = 3, // ±1.024V
        GAIN_0V512 = 4, // ±0.512V
        GAIN_0V256 = 5  // ±0.256V (also for 6 & 7)
    };

    // Data rate (samples per second) – datasheet DR bits
    enum DataRate : uint8_t
    {
        SPS_8   = 0,
        SPS_16  = 1,
        SPS_32  = 2,
        SPS_64  = 3,
        SPS_128 = 4, // default
        SPS_250 = 5,
        SPS_475 = 6,
        SPS_860 = 7
    };

    ADS1115(uint8_t i2cAddress = ADDR_GND);

    bool begin(TwoWire &wirePort = Wire);

    void setGain(Gain gain);
    Gain getGain() const { return _gain; }

    void setDataRate(DataRate dr);
    DataRate getDataRate() const { return _dataRate; }

    // Single-ended read: channel = 0..3
    int16_t readRawSingleEnded(uint8_t channel);
    float   readVoltageSingleEnded(uint8_t channel);

    // Differential reads (channel pairs per datasheet)
    int16_t readRawDifferential_0_1();
    int16_t readRawDifferential_2_3();

    float   rawToVoltage(int16_t raw) const;

private:
    // Register addresses
    static constexpr uint8_t REG_CONVERSION = 0x00;
    static constexpr uint8_t REG_CONFIG     = 0x01;
    static constexpr uint8_t REG_LO_THRESH  = 0x02;
    static constexpr uint8_t REG_HI_THRESH  = 0x03;

    TwoWire   *_wire;
    uint8_t    _addr;
    Gain       _gain;
    DataRate   _dataRate;

    uint16_t buildConfigWord(uint8_t muxBits) const;
    void     writeRegister(uint8_t reg, uint16_t value);
    uint16_t readRegister(uint8_t reg);

    float fullScaleVoltage() const;
};
