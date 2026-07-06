#include <Arduino.h>
#include <Wire.h>
#include "ADS1115.h"

ADS1115 adc(ADS1115::ADDR_GND);

void setup()
{
    Serial.begin(115200);
    delay(500);

    Serial.println();
    Serial.println("=== ADS1115 Test (ESP32) ===");

    // If you use custom pins for I2C, specify them here:
    // Wire.begin(SDA, SCL);
    Wire.begin(); // default ESP32 pins (21=SDA, 22=SCL)

    if (!adc.begin(Wire))
    {
        Serial.println("ADS1115 not found on I2C bus!");
        while (true)
        {
            delay(1000);
        }
    }

    // Configure gain and data rate to taste
    adc.setGain(ADS1115::GAIN_4V096);      // ±4.096V full-scale
    adc.setDataRate(ADS1115::SPS_128);     // 128 samples/s (single-shot)
    Serial.println("ADS1115 initialized.");
}

void loop()
{
    // Read channel 0 single-ended
    int16_t raw = adc.readRawSingleEnded(0);
    float   volts = adc.rawToVoltage(raw);

    Serial.print("CH0 raw: ");
    Serial.print(raw);
    Serial.print("  ->  ");
    Serial.print(volts, 6);
    Serial.println(" V");

    delay(500);
}