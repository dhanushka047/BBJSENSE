/********************************************************************
 *  IO Builds — Sri Lanka
 *  Dhanushka Udaya Kumara
 *  Embedded Systems Engineer
 *
 *  RELAY OUTPUT TEST
 *  Pins:
 *      GPIO36
 *      GPIO32
 *      GPIO27
 *      GPIO25
 *
 *  Logic:
 *      HIGH → Relay ON
 *      LOW  → Relay OFF
 ********************************************************************/

#include <Arduino.h>

// Relay output pins
#define RELAY1 36
#define RELAY2 32
#define RELAY3 27
#define RELAY4 25

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(RELAY1, OUTPUT);
  pinMode(RELAY2, OUTPUT);
  pinMode(RELAY3, OUTPUT);
  pinMode(RELAY4, OUTPUT);

  // Make sure all relays are OFF at start
  digitalWrite(RELAY1, LOW);
  digitalWrite(RELAY2, LOW);
  digitalWrite(RELAY3, LOW);
  digitalWrite(RELAY4, LOW);
}

void loop() {
  // Relay ON sequence
  Serial.println("Relay 1 ON");
  digitalWrite(RELAY1, HIGH);
  delay(1000);

  Serial.println("Relay 2 ON");
  digitalWrite(RELAY2, HIGH);
  delay(1000);

  Serial.println("Relay 3 ON");
  digitalWrite(RELAY3, HIGH);
  delay(1000);

  Serial.println("Relay 4 ON");
  digitalWrite(RELAY4, HIGH);
  delay(1000);

  // Turn all OFF
  Serial.println("All Relays OFF");
  digitalWrite(RELAY1, LOW);
  digitalWrite(RELAY2, LOW);
  digitalWrite(RELAY3, LOW);
  digitalWrite(RELAY4, LOW);
  delay(2000);
}