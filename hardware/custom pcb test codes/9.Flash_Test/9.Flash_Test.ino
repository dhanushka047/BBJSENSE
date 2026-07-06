/********************************************************************
 *  IO Builds — Sri Lanka
 *  Dhanushka Udaya Kumara
 *  Embedded Systems Engineer
 *
 *  W25Q64JVSSIQ SPI Flash Test
 *  CS  = GPIO5
 *  CLK = GPIO18
 *  MISO= GPIO19
 *  MOSI= GPIO23
 ********************************************************************/

#include <Arduino.h>
#include <SPI.h>
#include <SPIMemory.h>

#define FLASH_CS   5
#define FLASH_CLK  18
#define FLASH_MISO 19
#define FLASH_MOSI 23

// Use default SPI interface
SPIFlash flash(FLASH_CS, &SPI);

void setup() {
  Serial.begin(115200);
  delay(500);

  // Init SPI bus
  SPI.begin(FLASH_CLK, FLASH_MISO, FLASH_MOSI, FLASH_CS);

  Serial.println("\nInitializing W25Q64...");

  if (flash.begin()) {
    Serial.println("Flash Initialized OK");
  } else {
    Serial.println("Flash Initialization FAILED!");
    return;
  }

  // Read JEDEC ID
  uint32_t id = flash.getJEDECID();
  Serial.print("JEDEC ID: 0x");
  Serial.println(id, HEX);

  // ---- WRITE TEST ----
  String msg = "IO Builds Sri Lanka - Flash Test OK";

  Serial.println("Writing test data...");
  if (flash.writeStr(0, msg)) {
    Serial.println("Write OK");
  } else {
    Serial.println("Write FAILED");
  }

  delay(200);

  // ---- READ TEST ----
  String readBack;
  if (flash.readStr(0, readBack)) {
    Serial.print("Read Data: ");
    Serial.println(readBack);
  } else {
    Serial.println("Read FAILED");
  }
}

void loop() {
}