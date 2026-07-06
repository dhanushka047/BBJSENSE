/********************************************************************
 *  BBJSENSE Hardware & Chip Diagnostic Troubleshooting Tool
 *  Folder: hardware/custom pcb test codes/15.Chip_Detection_Test/
 *
 *  Upload this sketch to verify:
 *  1. If your Arduino IDE target architecture is correct (S3 vs Classic).
 *  2. If the 8MB PSRAM is successfully enabled and initialized.
 *  3. The sizes of your Internal and External Flash chips.
 *  4. Scan standard I2C lines to verify ADS1115 & PCF8563 response.
 *  5. WS2812 Status NeoPixel LED function.
 ********************************************************************/

#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <Adafruit_NeoPixel.h>

#define WS_PIN 4
#define SDA_PIN 22
#define SCL_PIN 21
#define FLASH_CS 5

Adafruit_NeoPixel statusLED(1, WS_PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  Serial.begin(115200);
  
  // Wait up to 3 seconds for Serial Monitor connection
  unsigned long start = millis();
  while (!Serial && millis() - start < 3000) {
    delay(10);
  }
  delay(500);

  Serial.println("\n\n========================================================");
  Serial.println("         BBJSENSE GATEWAY SYSTEM DIAGNOSTICS            ");
  Serial.println("========================================================");

  // 1. Compile-Time Architecture Verification
  Serial.println("\n[1. COMPILE-TIME IDE TARGET CONFIGURATION]");
#if defined(CONFIG_IDF_TARGET_ESP32S3)
  Serial.println("  ✓ Board target architecture: ESP32-S3 (CORRECT)");
#elif defined(CONFIG_IDF_TARGET_ESP32)
  Serial.println("  ✗ Board target architecture: Classic ESP32 (WARNING: INCORRECT!)");
  Serial.println("    --> Action: Change your board setting to 'ESP32S3 Dev Module'");
#else
  Serial.println("  ✗ Board target architecture: Unknown MCU variant!");
#endif

#if defined(ARDUINO_USB_CDC_ON_BOOT)
  Serial.printf("  ✓ USB CDC on Boot flag: %s\n", (ARDUINO_USB_CDC_ON_BOOT == 1) ? "Enabled" : "Disabled");
#endif

  // 2. Chip Identification Details
  Serial.println("\n[2. CHIP ARCHITECTURE]");
  Serial.printf("  Chip Model:      %s\n", ESP.getChipModel());
  Serial.printf("  Cores:           %d\n", ESP.getChipCores());
  Serial.printf("  Silicon Revision:%d\n", ESP.getChipRevision());
  Serial.printf("  CPU Speed:       %d MHz\n", ESP.getCpuFreqMHz());

  // 3. Memory & PSRAM Layout Verification
  Serial.println("\n[3. SYSTEM MEMORY LAYOUT]");
  Serial.printf("  Internal Free Heap: %d bytes\n", ESP.getFreeHeap());

#if defined(BOARD_HAS_PSRAM) || defined(CONFIG_SPIRAM_SUPPORT)
  Serial.println("  ✓ PSRAM support compile flag: Enabled");
  if (psramInit()) {
    Serial.printf("  ✓ Detected Total PSRAM Size: %d bytes (~%d MB)\n", 
                  ESP.getPsramSize(), ESP.getPsramSize() / (1024 * 1024));
    Serial.printf("    Free Allocatable PSRAM:   %d bytes\n", ESP.getFreePsram());
  } else {
    Serial.println("  ✗ PSRAM hardware status: Initialization FAILED.");
    Serial.println("    --> Action: Verify your Tools -> PSRAM setting is set to 'OPI PSRAM'");
  }
#else
  Serial.println("  ✗ PSRAM compile status: Disabled");
  Serial.println("    --> Action: Set your Tools -> PSRAM setting to 'OPI PSRAM' or 'Enabled'");
#endif

  // 4. Flash Chip Size Detection
  Serial.println("\n[4. FLASH STORAGE SIZE]");
  uint32_t flashSize = ESP.getFlashChipSize();
  Serial.printf("  Detected Internal Flash: %d MB (%d bytes)\n", 
                flashSize / (1024 * 1024), flashSize);
  Serial.printf("  Flash BUS Frequency:     %d MHz\n", ESP.getFlashChipSpeed() / 1000000);

  // 5. I2C Bus Scan
  Serial.println("\n[5. I2C SCAN SURVEY (GPIO 22/21)]");
  Wire.begin(SDA_PIN, SCL_PIN);
  byte error, address;
  int nDevices = 0;
  
  for (address = 1; address < 127; address++ ) {
    Wire.beginTransmission(address);
    error = Wire.endTransmission();
    if (error == 0) {
      Serial.printf("  ✓ Found peripheral responding at address 0x%02X", address);
      if (address == 0x48) Serial.print(" (ADS1115 High Precision ADC)");
      if (address == 0x51) Serial.print(" (PCF8563 Real-Time Clock)");
      Serial.println();
      nDevices++;
    }
  }
  if (nDevices == 0) {
    Serial.println("  ✗ No responsive devices found on the I2C bus.");
  } else {
    Serial.printf("  Survey Complete: Found %d responding I2C address(es)\n", nDevices);
  }

  // 6. WS2812 Status LED Check
  Serial.println("\n[6. NEOPIXEL WS2812 TEST]");
  statusLED.begin();
  statusLED.setBrightness(100);
  statusLED.setPixelColor(0, statusLED.Color(0, 150, 0)); // Set to solid green
  statusLED.show();
  Serial.println("  Status WS2812 LED configured. Verify if the board LED is now glowing Green!");

  Serial.println("\n========================================================");
  Serial.println("              HARDWARE DIAGNOSTIC REPORT END            ");
  Serial.println("========================================================");
}

void loop() {
  // Alternate status LED color between Green and Blue to confirm dynamic loop execution
  static bool state = false;
  state = !state;
  
  if (state) {
    statusLED.setPixelColor(0, statusLED.Color(0, 150, 0)); // Green
  } else {
    statusLED.setPixelColor(0, statusLED.Color(0, 0, 150)); // Blue
  }
  statusLED.show();
  delay(1000);
}
