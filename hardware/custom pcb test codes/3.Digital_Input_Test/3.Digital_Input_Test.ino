/********************************************************************
 *  IO Builds — Sri Lanka
 *  Dhanushka Udaya Kumara
 *  Embedded Systems Engineer
 *
 *  DIGITAL INPUT TEST (Optocoupler PC817 Logic)
 *  Logic:
 *      HIGH → No signal
 *      LOW  → Signal ACTIVE
 ********************************************************************/

#include <Arduino.h>

// Input pins
#define DIN1 34
#define DIN2 35
#define DIN3 14
#define DIN4 12

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(DIN1, INPUT);
  pinMode(DIN2, INPUT);
  pinMode(DIN3, INPUT);
  pinMode(DIN4, INPUT);
}

void loop() {
  int d1 = digitalRead(DIN1);
  int d2 = digitalRead(DIN2);
  int d3 = digitalRead(DIN3);
  int d4 = digitalRead(DIN4);

  Serial.print("IN1: "); Serial.print(d1 ? "HIGH" : "LOW ");
  Serial.print(" | IN2: "); Serial.print(d2 ? "HIGH" : "LOW ");
  Serial.print(" | IN3: "); Serial.print(d3 ? "HIGH" : "LOW ");
  Serial.print(" | IN4: "); Serial.println(d4 ? "HIGH" : "LOW ");

  delay(300);
}