/********************************************************************
 *  IO Builds — Sri Lanka
 *  Dhanushka Udaya Kumara
 *  Embedded Systems Engineer
 *
 *  WS2812 / NeoPixel Test
 *  Data Pin: GPIO4
 *  LED Count: 1
 ********************************************************************/

#include <Adafruit_NeoPixel.h>

#define WS_PIN      4     // IO4
#define LED_COUNT   1     // change if more LEDs

Adafruit_NeoPixel strip(LED_COUNT, WS_PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  strip.begin();
  strip.show();           // clear
  delay(200);
}

void loop() {
  // RED
  strip.setPixelColor(0, strip.Color(255, 0, 0));
  strip.show();
  delay(500);

  // GREEN
  strip.setPixelColor(0, strip.Color(0, 255, 0));
  strip.show();
  delay(500);

  // BLUE
  strip.setPixelColor(0, strip.Color(0, 0, 255));
  strip.show();
  delay(500);

  // WHITE
  strip.setPixelColor(0, strip.Color(255, 255, 255));
  strip.show();
  delay(500);

  // OFF
  strip.setPixelColor(0, strip.Color(0, 0, 0));
  strip.show();
  delay(500);
}