/********************************************************************
 *  IO Builds — Sri Lanka
 *  Dhanushka Udaya Kumara
 *  Embedded Systems Engineer
 *
 *  ESP32-S3 Battery Voltage Read Test
 *  Battery is connected to GPIO36 (ADC1_CH5)
 *
 *  NOTE:
 *  - Make sure the battery line is divided (ex: 100k/100k divider)
 *    so ESP32-S3 ADC never sees more than 3.3V.
 ********************************************************************/

#include <Arduino.h>

// Battery sense pin
#define BATT_PIN 36          // GPIO36 (ADC1_CH5)

// Your divider ratio (edit if needed)
// Example: 100k / 100k → total divider = 2.0
#define DIVIDER_RATIO 2.0    

void setup() {
  Serial.begin(115200);
  delay(500);

  // Configure ADC
  pinMode(BATT_PIN, INPUT);
}

void loop() {
  // Read raw ADC value (12-bit: 0–4095)
  int raw = analogRead(BATT_PIN);

  // Convert raw value → voltage at ADC pin
  float adcVoltage = (raw / 4095.0) * 3.3; // ESP32-S3 ADC reference is 3.3V

  // Real battery voltage (after accounting for divider)
  float batteryVoltage = adcVoltage * DIVIDER_RATIO;

  Serial.print("Raw: ");
  Serial.print(raw);

  Serial.print("  | ADC Voltage: ");
  Serial.print(adcVoltage, 3);
  Serial.print(" V");

  Serial.print("  | Battery Voltage: ");
  Serial.print(batteryVoltage, 3);
  Serial.println(" V");

  delay(1000);
}