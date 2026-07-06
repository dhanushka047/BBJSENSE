/********************************************************************
 *  IO Builds — Sri Lanka
 *  Dhanushka Udaya Kumara
 *  Embedded Systems Engineer
 *
 *  Simple ESP32-S3 Test Code
 *  Prints "Hello from ESP32-S3" continuously
 ********************************************************************/

#include <Arduino.h>

void setup() {
  // Initialize serial communication
  Serial.begin(115200);

  // Short delay for serial monitor to open cleanly
  delay(500);

  // Initial message
  Serial.println("ESP32-S3 Started");
}

void loop() {
  // Print hello message repeatedly
  Serial.println("Hello from ESP32-S3");

  // Delay 1 second
  delay(1000);
}