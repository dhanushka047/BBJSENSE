// ADS1115.cpp

#include "ADS1115.h"

// ---- Helper: full-scale voltage per gain setting ----
float ADS1115::fullScaleVoltage() const
{
    switch (_gain)
    {
    case GAIN_6V144: return 6.144f;
    case GAIN_4V096: return 4.096f;
    case GAIN_2V048: return 2.048f;
    case GAIN_1V024: return 1.024f;
    case GAIN_0V512: return 0.512f;
    case GAIN_0V256: return 0.256f;
    default:         return 2.048f;
    }
}

// ---- Constructor ----
ADS1115::ADS1115(uint8_t i2cAddress)
: _wire(&Wire),
  _addr(i2cAddress),
  _gain(GAIN_2V048),
  _dataRate(SPS_128)
{
}

// ---- Public API ----
bool ADS1115::begin(TwoWire &wirePort)
{
    _wire = &wirePort;
    _wire->begin();

    // Simple presence check: try to read config register
    _wire->beginTransmission(_addr);
    _wire->write(REG_CONFIG);
    uint8_t err = _wire->endTransmission();
    if (err != 0)
    {
        return false;
    }

    // Optional: set comparator to disabled (ALERT/RDY high-Z)
    uint16_t cfg = buildConfigWord(0b100); // default to AIN0 single-ended
    writeRegister(REG_CONFIG, cfg);

    return true;
}

void ADS1115::setGain(ADS1115::Gain gain)
{
    _gain = gain;
}

void ADS1115::setDataRate(ADS1115::DataRate dr)
{
    _dataRate = dr;
}

// ---- Low-level register access ----
void ADS1115::writeRegister(uint8_t reg, uint16_t value)
{
    _wire->beginTransmission(_addr);
    _wire->write(reg);
    _wire->write(static_cast<uint8_t>(value >> 8)); // MSB
    _wire->write(static_cast<uint8_t>(value & 0xFF)); // LSB
    _wire->endTransmission();
}

uint16_t ADS1115::readRegister(uint8_t reg)
{
    _wire->beginTransmission(_addr);
    _wire->write(reg);
    _wire->endTransmission();

    _wire->requestFrom(static_cast<int>(_addr), 2);
    while (_wire->available() < 2)
    {
        // wait
    }

    uint8_t msb = _wire->read();
    uint8_t lsb = _wire->read();
    return (static_cast<uint16_t>(msb) << 8) | lsb;
}

// ---- Config word builder ----
// muxBits: MUX[2:0] (datasheet Table 8-3)
uint16_t ADS1115::buildConfigWord(uint8_t muxBits) const
{
    uint16_t config = 0;

    // Bit 15: OS = 1 (start single conversion)
    config |= (1u << 15);

    // Bits 14:12 – MUX
    config |= (static_cast<uint16_t>(muxBits & 0x07) << 12);

    // Bits 11:9 – PGA (gain)
    config |= (static_cast<uint16_t>(_gain & 0x07) << 9);

    // Bit 8 – MODE: 1 = single-shot
    config |= (1u << 8);

    // Bits 7:5 – DR (data rate)
    config |= (static_cast<uint16_t>(_dataRate & 0x07) << 5);

    // Bit 4 – COMP_MODE: 0 = traditional (don’t care here)
    // Bit 3 – COMP_POL:  0 = active low
    // Bit 2 – COMP_LAT:  0 = non-latching
    // Bits 1:0 – COMP_QUE: 11 = disable comparator, ALERT/RDY high-Z
    config |= 0x0003;

    return config;
}

// ---- Conversion helper: raw -> volts ----
float ADS1115::rawToVoltage(int16_t raw) const
{
    float fs = fullScaleVoltage();
    // 16-bit two’s complement, but range is ±FS mapped to ±32768
    return (fs / 32768.0f) * static_cast<float>(raw);
}

// ---- Single-ended reads ----
int16_t ADS1115::readRawSingleEnded(uint8_t channel)
{
    if (channel > 3) channel = 3;

    // MUX mapping for single-ended (Table 8-3)
    // 100: AIN0-GND, 101: AIN1-GND, 110: AIN2-GND, 111: AIN3-GND
    uint8_t muxBits = 0b100 + channel;

    uint16_t config = buildConfigWord(muxBits);
    writeRegister(REG_CONFIG, config);

    // Wait for conversion complete by polling OS bit (bit 15)
    const uint16_t timeoutMs = 20; // plenty for any DR here
    uint16_t wait = 0;
    while (wait < timeoutMs)
    {
        uint16_t cfgNow = readRegister(REG_CONFIG);
        if (cfgNow & 0x8000)
        {
            break; // conversion ready
        }
        delay(1);
        ++wait;
    }

    uint16_t raw = readRegister(REG_CONVERSION);
    return static_cast<int16_t>(raw);
}

float ADS1115::readVoltageSingleEnded(uint8_t channel)
{
    int16_t raw = readRawSingleEnded(channel);
    return rawToVoltage(raw);
}

// ---- Differential reads ----
// MUX: 000 = AIN0-AIN1, 011 = AIN2-AIN3
int16_t ADS1115::readRawDifferential_0_1()
{
    uint16_t config = buildConfigWord(0b000);
    writeRegister(REG_CONFIG, config);

    const uint16_t timeoutMs = 20;
    uint16_t wait = 0;
    while (wait < timeoutMs)
    {
        uint16_t cfgNow = readRegister(REG_CONFIG);
        if (cfgNow & 0x8000)
            break;
        delay(1);
        ++wait;
    }

    uint16_t raw = readRegister(REG_CONVERSION);
    return static_cast<int16_t>(raw);
}

int16_t ADS1115::readRawDifferential_2_3()
{
    uint16_t config = buildConfigWord(0b011);
    writeRegister(REG_CONFIG, config);

    const uint16_t timeoutMs = 20;
    uint16_t wait = 0;
    while (wait < timeoutMs)
    {
        uint16_t cfgNow = readRegister(REG_CONFIG);
        if (cfgNow & 0x8000)
            break;
        delay(1);
        ++wait;
    }

    uint16_t raw = readRegister(REG_CONVERSION);
    return static_cast<int16_t>(raw);
}