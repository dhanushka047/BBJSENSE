/********************************************************************
 *  IO Builds — Sri Lanka
 *  Dhanushka Udaya Kumara
 *  Embedded Systems Engineer
 *
 *  LED TEST (GPIO13)
 ********************************************************************/

#include <Arduino.h>

#define LED_PIN 13   // LED connected to GPIO13

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);   // LED OFF at start
}

void loop() {
  digitalWrite(LED_PIN, HIGH);  // LED ON
  delay(500);

  digitalWrite(LED_PIN, LOW);   // LED OFF
  delay(500);
}