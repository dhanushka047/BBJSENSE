/********************************************************************
 *  IO Builds — Sri Lanka
 *  FUNCTION BUTTON TEST SKETCH (GPIO 39)
 *  
 *  This sketch tests the function button pressed durations.
 *  - Active LOW logic is assumed.
 *  - Visual feedback is printed to the Serial Monitor.
 *  - Blinks/changes color of the WS2812 status LED (GPIO 4) to 
 *    confirm hold durations.
 ********************************************************************/

#include <Arduino.h>
#include <Adafruit_NeoPixel.h>

#define FUNC_BUTTON_PIN 39
#define WS_PIN 4
#define NUMPIXELS 1

Adafruit_NeoPixel statusLED(NUMPIXELS, WS_PIN, NEO_GRB + NEO_KHZ800);

void setLEDColor(uint8_t r, uint8_t g, uint8_t b) {
  statusLED.setPixelColor(0, statusLED.Color(r, g, b));
  statusLED.show();
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== BBJSENSE Function Button Test ===");
  Serial.printf("Configuring Pin %d as INPUT.\n", FUNC_BUTTON_PIN);
  
  // Note: GPIO 39 is input-only and lacks internal pullup. 
  // It relies on an external pullup resistor on the custom PCB.
  pinMode(FUNC_BUTTON_PIN, INPUT);

  statusLED.begin();
  statusLED.clear();
  setLEDColor(0, 0, 255); // Start with Blue LED
  Serial.println("System Ready. Press and hold the button connected to GPIO 39.");
}

void loop() {
  static unsigned long pressStartMs = 0;
  static bool wasPressed = false;
  static unsigned long lastPrintMs = 0;

  // Read button state (Assuming active-LOW configuration)
  bool isPressed = (digitalRead(FUNC_BUTTON_PIN) == LOW);

  if (isPressed) {
    if (!wasPressed) {
      pressStartMs = millis();
      wasPressed = true;
      Serial.println("\n[BUTTON] Pressed! Keep holding...");
      setLEDColor(255, 165, 0); // Orange when pressed
    } else {
      unsigned long holdDuration = millis() - pressStartMs;
      
      // Print hold duration every 1 second
      if (millis() - lastPrintMs >= 1000) {
        Serial.printf("[BUTTON] Holding... %lu ms (%lu seconds)\n", holdDuration, holdDuration / 1000);
        lastPrintMs = millis();
      }

      // Blink red while holding
      if ((holdDuration % 300) < 150) {
        setLEDColor(255, 0, 0); // Red ON
      } else {
        setLEDColor(0, 0, 0); // Red OFF
      }

      // 10 second hold threshold met
      if (holdDuration >= 10000) {
        Serial.println("\n[SUCCESS] 10-Second Hold Detected!");
        
        // Fast white blinking for success indication
        for (int i = 0; i < 15; i++) {
          setLEDColor(255, 255, 255);
          delay(60);
          setLEDColor(0, 0, 0);
          delay(60);
        }
        
        Serial.println("[SYSTEM] Reset trigger simulation successful! Release button to restart test.");
        
        // Block until button released to avoid repeat triggers
        while (digitalRead(FUNC_BUTTON_PIN) == LOW) {
          setLEDColor(0, 255, 0); // Solid green while waiting for release
          delay(10);
        }
        
        wasPressed = false;
        setLEDColor(0, 0, 255); // Reset back to Blue
        Serial.println("\n[RESET] Ready for next test.");
      }
    }
  } else {
    if (wasPressed) {
      unsigned long holdDuration = millis() - pressStartMs;
      Serial.printf("\n[BUTTON] Released. Total hold duration: %lu ms (%lu seconds)\n", holdDuration, holdDuration / 1000);
      if (holdDuration < 10000) {
        Serial.println("[INFO] Hold duration was less than 10 seconds. Reset was NOT triggered.");
      }
      wasPressed = false;
      setLEDColor(0, 0, 255); // Restore Blue LED
    }
  }
  delay(10); // Small debounce/polling delay
}
