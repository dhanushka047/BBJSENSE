/********************************************************************
 *  IO Builds — Sri Lanka
 *  Dhanushka Udaya Kumara
 *  Embedded Systems Engineer
 *
 *  RS485 TEST (ESP32-S3)
 *  TX = GPIO2
 *  RX = GPIO15
 *  DIR = GPIO33   (DE + /RE)
 ********************************************************************/

#include <Arduino.h>

#define RS485      Serial1
#define RS485_TX   2
#define RS485_RX   15
#define RS485_DIR  33   // Direction control pin

void rs485_send(const char* msg) {
  digitalWrite(RS485_DIR, HIGH);   // Enable transmit
  delayMicroseconds(20);           // Allow driver to switch

  RS485.print(msg);
  RS485.flush();                   // Wait until TX buffer empty

  delayMicroseconds(50);
  digitalWrite(RS485_DIR, LOW);    // Back to receive mode
}

void setup() {
  pinMode(RS485_DIR, OUTPUT);
  digitalWrite(RS485_DIR, LOW);    // Default: receive mode

  RS485.begin(9600, SERIAL_8N1, RS485_RX, RS485_TX);
  delay(300);
}

void loop() {
  rs485_send("IO Builds RS485 Test\n");
  delay(1000);

  // Optional: print any received data
  while (RS485.available()) {
    char c = RS485.read();
    Serial.print(c);
  }
}