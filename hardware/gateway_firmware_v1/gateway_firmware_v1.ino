/********************************************************************
 *  BBJSENSE Telemetry Gateway & Control Firmware v4.0
 *  Hardware: ESP32 Custom PCB (ESP32-D0WD-V3)
 *  Developed by Dhanushka Udaya Kumara
 *
 *  Pinout Mapping:
 *  - I2C: SDA=GPIO22, SCL=GPIO21 (ADS1115 & PCF8563)
 *  - Digital Inputs (Optocouplers): DIN1=34, DIN2=35, DIN3=14, DIN4=12 (Active LOW)
 *  - Relay Outputs (Digital Out): RELAY1=36, RELAY2=32, RELAY3=27, RELAY4=25 (Active HIGH)
 *  - WS2812 RGB LED (NeoPixel): Pin 4 (State Indicator / Dashboard controllable)
 *  - TX Status LED: Pin 13
 *  - RS485 (Serial1): TX=2, RX=15, DIR=33 (DE + /RE direction)
 *  - SPI Flash (W25Q64JV): CS=5, CLK=18, MISO=19, MOSI=23
 ********************************************************************/

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_NeoPixel.h>
#include <Wire.h>
#include <SPI.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Preferences.h>
#include <time.h>

#include "ADS1115.h"
#include "IO_PCF8563.h"

// Pin Definitions
#define DIN1 34
#define DIN2 35
#define DIN3 14
#define DIN4 12

#define RELAY1 36
#define RELAY2 32
#define RELAY3 27
#define RELAY4 25

#define WS_PIN 4
#define LED_TX_PIN 13

#define RS485_TX 2
#define RS485_RX 15
#define RS485_DIR 33

#define SDA_PIN 21
#define SCL_PIN 22

#define FLASH_CS   5
#define FLASH_CLK  18
#define FLASH_MISO 19
#define FLASH_MOSI 23

// Size limit for flash logging (use first 4MB of the 8MB flash)
const uint32_t FLASH_MAX_SIZE = 4 * 1024 * 1024;

// LED states
enum LedState {
  LED_OFF,
  LED_WIFI_CONNECTING, // blinking blue
  LED_BLE_MODE,        // blinking yellow
  LED_OPERATIONAL,     // solid green
  LED_HTTP_ERROR,      // blinking red
  LED_I2C_ERROR,       // blinking magenta
  LED_OFFLINE_LOGGING  // solid orange/yellow
};

// Lightweight Custom SPI Flash Driver to prevent IRAM overflow issues on ESP32
class CustomSPIFlash {
private:
  uint8_t _csPin;
  SPIClass* _spi;

  void writeEnable() {
    digitalWrite(_csPin, LOW);
    _spi->transfer(0x06); // Write Enable
    digitalWrite(_csPin, HIGH);
  }

  void waitBusy() {
    uint8_t status = 0;
    do {
      digitalWrite(_csPin, LOW);
      _spi->transfer(0x05); // Read Status Register-1
      status = _spi->transfer(0x00);
      digitalWrite(_csPin, HIGH);
      delayMicroseconds(50);
    } while (status & 0x01); // BUSY bit is bit 0
  }

public:
  CustomSPIFlash(uint8_t csPin, SPIClass* spiBus) : _csPin(csPin), _spi(spiBus) {}

  bool begin() {
    pinMode(_csPin, OUTPUT);
    digitalWrite(_csPin, HIGH);
    
    // Read JEDEC ID to confirm SPI communication
    uint32_t jedec = getJEDECID();
    return ((jedec & 0xFF0000) >> 16) == 0xEF || jedec != 0;
  }

  uint32_t getJEDECID() {
    digitalWrite(_csPin, LOW);
    _spi->transfer(0x9F); // Read JEDEC ID command
    uint8_t mfg = _spi->transfer(0x00);
    uint8_t memType = _spi->transfer(0x00);
    uint8_t cap = _spi->transfer(0x00);
    digitalWrite(_csPin, HIGH);
    return ((uint32_t)mfg << 16) | ((uint32_t)memType << 8) | cap;
  }

  bool eraseSector(uint32_t addr) {
    waitBusy();
    writeEnable();
    
    digitalWrite(_csPin, LOW);
    _spi->transfer(0x20); // Sector Erase (4KB)
    _spi->transfer((addr >> 16) & 0xFF);
    _spi->transfer((addr >> 8) & 0xFF);
    _spi->transfer(addr & 0xFF);
    digitalWrite(_csPin, HIGH);
    
    waitBusy();
    return true;
  }

  bool writeBytes(uint32_t addr, const uint8_t* data, uint32_t len) {
    uint32_t written = 0;
    while (written < len) {
      uint32_t pageOffset = (addr + written) % 256;
      uint32_t maxWrite = 256 - pageOffset;
      uint32_t chunk = (maxWrite < (len - written)) ? maxWrite : (len - written);
      
      waitBusy();
      writeEnable();
      
      digitalWrite(_csPin, LOW);
      _spi->transfer(0x02); // Page Program
      uint32_t currentAddr = addr + written;
      _spi->transfer((currentAddr >> 16) & 0xFF);
      _spi->transfer((currentAddr >> 8) & 0xFF);
      _spi->transfer(currentAddr & 0xFF);
      
      for (uint32_t i = 0; i < chunk; i++) {
        _spi->transfer(data[written + i]);
      }
      digitalWrite(_csPin, HIGH);
      
      written += chunk;
    }
    waitBusy();
    return true;
  }

  bool writeStr(uint32_t addr, const String& str) {
    return writeBytes(addr, (const uint8_t*)str.c_str(), str.length() + 1); // Write string with null-terminator
  }

  bool readStr(uint32_t addr, String& outStr) {
    outStr = "";
    waitBusy();
    digitalWrite(_csPin, LOW);
    _spi->transfer(0x03); // Read Data command
    _spi->transfer((addr >> 16) & 0xFF);
    _spi->transfer((addr >> 8) & 0xFF);
    _spi->transfer(addr & 0xFF);
    
    const uint32_t maxLimit = 2048; 
    for (uint32_t i = 0; i < maxLimit; i++) {
      char c = (char)_spi->transfer(0x00);
      if (c == '\0') {
        break;
      }
      outStr += c;
    }
    digitalWrite(_csPin, HIGH);
    return true;
  }
};

// Hardware Instances
Adafruit_NeoPixel statusLED(1, WS_PIN, NEO_GRB + NEO_KHZ800);
ADS1115 adc(ADS1115::ADDR_GND);
IO_PCF8563 rtc;
CustomSPIFlash flash(FLASH_CS, &SPI);
Preferences prefs;

// BLE Server Instances
BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;

// Settings & Config State
String wifiSSID = "";
String wifiPass = "";
String deviceUUID = "";
String apiBaseUrl = "http://192.168.1.100:5001/api"; // Default fallback
uint32_t wifiMaxDisconnectTime = 900; // Default 15 mins (900 seconds)
bool ledDisabled = false;

// Flash Circular Buffer Pointers
uint32_t flashWritePtr = 0;
uint32_t flashReadPtr = 0;

// State Flags
bool i2cError = false;
bool i2cEventSent = false;
bool isBleMode = false;
bool bleConnected = false;
LedState currentLedState = LED_OFF;

// Wi-Fi BLE Assisted Scanning Variables
bool triggerScan = false;
String scanStatus = "idle";
String scanResults = "";

// Timing Monitors
unsigned long lastTelemetryMs = 0;
unsigned long lastModbusMs = 0;
unsigned long lastConfigSyncMs = 0;
unsigned long disconnectStartMs = 0;

const unsigned long TELEMETRY_INTERVAL = 15000;   // 15 seconds
const unsigned long MODBUS_INTERVAL = 30000;      // 30 seconds
const unsigned long CONFIG_SYNC_INTERVAL = 60000;  // 1 minute

// Local Channel Configs
struct ChannelConfig {
  String mode = "0-10V";
  float minValue = 0.0;
  float maxValue = 10.0;
};
ChannelConfig analogConfigs[4];
bool relayStates[4] = {false, false, false, false};

// Function declarations
void startBLEConfig();
void loadConfig();
void saveConfig(String ssid, String pass, String uuid, String url);
void syncConfiguration();
void processTelemetry();
void processModbus();
void syncOfflineFlashLogs();
void writeLogToFlash(String logJson);
String readLogFromFlash();
void advanceReadPointer(uint32_t recordLen);
uint16_t calculateCRC(const uint8_t *buf, int len);
bool readModbusRegister(uint8_t slaveId, uint16_t address, uint8_t fc, uint8_t *respData, int byteCount);
float parseModbusValue(uint8_t *data, String dataType);
void initTimeTime();
String getISOTime();
void checkI2CBus();
void logI2CErrorEvent();
void handleLEDAnimations();
void setLEDColor(uint8_t r, uint8_t g, uint8_t b);

// BLE Callbacks
class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    bleConnected = true;
    Serial.println("[BLE] Client connected.");
  }
  void onDisconnect(BLEServer* pServer) override {
    bleConnected = false;
    Serial.println("[BLE] Client disconnected. Restarting advertising...");
    pServer->getAdvertising()->start();
  }
};

class MyCharacteristicCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) override {
    String value = pChar->getValue();
    if (value.length() > 0) {
      if (value == "SCAN") {
        Serial.println("[BLE] Received Wi-Fi scan trigger request command.");
        triggerScan = true;
        scanStatus = "scanning";
        scanResults = "";
        pChar->setValue("STATUS:scanning");
        return;
      }

      Serial.print("[BLE] Received configuration JSON: ");
      Serial.println(value);
      
      DynamicJsonDocument doc(1024);
      DeserializationError err = deserializeJson(doc, value);
      if (!err) {
        String ssid = doc["ssid"].as<String>();
        String pass = doc["pass"].as<String>();
        String uuid = doc["uuid"].as<String>();
        String api = doc["api"].as<String>();
        
        if (ssid.length() > 0 && uuid.length() > 0) {
          saveConfig(ssid, pass, uuid, api);
          Serial.println("[BLE] Config saved. Restarting gateway...");
          delay(1000);
          ESP.restart();
        }
      } else {
        Serial.printf("[BLE] JSON Parse failed: %s\n", err.c_str());
      }
    }
  }

  void onRead(BLECharacteristic *pChar) override {
    if (scanStatus == "scanning") {
      pChar->setValue("STATUS:scanning");
      Serial.println("[BLE] Read Request during scan -> STATUS:scanning");
      return;
    }
    
    if (scanResults.length() > 0) {
      pChar->setValue(scanResults.c_str());
      Serial.printf("[BLE] Read Request survey results -> %s\n", scanResults.c_str());
      return;
    }

    String mac = WiFi.macAddress();
    String wifiStatus = (WiFi.status() == WL_CONNECTED) ? "connected" : "disconnected";
    String i2cStatus = i2cError ? "fail" : "ok";
    
    String statusStr = "MAC=" + mac + ";WIFI=" + wifiStatus + ";I2C=" + i2cStatus + ";";
    pChar->setValue(statusStr.c_str());
    Serial.printf("[BLE] Read Status request -> %s\n", statusStr.c_str());
  }
};

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== BBJSENSE Gateway Booting ===");

  // TX Indicator LED
  pinMode(LED_TX_PIN, OUTPUT);
  digitalWrite(LED_TX_PIN, LOW);

  // Digital Inputs
  pinMode(DIN1, INPUT);
  pinMode(DIN2, INPUT);
  pinMode(DIN3, INPUT);
  pinMode(DIN4, INPUT);

  // Relay Outputs
#if !defined(CONFIG_IDF_TARGET_ESP32S3)
  if (RELAY1 != 34 && RELAY1 != 35 && RELAY1 != 36 && RELAY1 != 39) {
    pinMode(RELAY1, OUTPUT);
    digitalWrite(RELAY1, LOW);
  }
#else
  pinMode(RELAY1, OUTPUT);
  digitalWrite(RELAY1, LOW);
#endif
  pinMode(RELAY2, OUTPUT);
  pinMode(RELAY3, OUTPUT);
  pinMode(RELAY4, OUTPUT);
  digitalWrite(RELAY2, LOW);
  digitalWrite(RELAY3, LOW);
  digitalWrite(RELAY4, LOW);

  pinMode(RS485_DIR, OUTPUT);
  digitalWrite(RS485_DIR, LOW);

  // WS2812 status LED
  statusLED.begin();
  statusLED.setBrightness(150);
  statusLED.clear();
  statusLED.show();

  // Test and Initialize I2C peripherals
  checkI2CBus();

  // Initialize external W25Q64 SPI Flash
  SPI.begin(FLASH_CLK, FLASH_MISO, FLASH_MOSI, FLASH_CS);
  if (!flash.begin()) {
    Serial.println("[ERROR] External SPI Flash W25Q64 not found!");
  } else {
    Serial.printf("[OK] SPI Flash W25Q64 Initialized. JEDEC ID: 0x%X\n", flash.getJEDECID());
  }

  // RS485 Modbus Serial
  Serial1.begin(9600, SERIAL_8N1, RS485_RX, RS485_TX);

  // Load configuration and flash pointers from Preferences NVS
  loadConfig();

  // Wi-Fi / BLE Provisioning Selector
  if (wifiSSID.length() > 0) {
    Serial.print("Connecting to Wi-Fi SSID: ");
    Serial.println(wifiSSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSSID.c_str(), wifiPass.c_str());

    currentLedState = LED_WIFI_CONNECTING;
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 30) {
      handleLEDAnimations();
      delay(500);
      Serial.print(".");
      retries++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n[OK] Wi-Fi Connected!");
      Serial.print("IP Address: ");
      Serial.println(WiFi.localIP());
      
      currentLedState = LED_OPERATIONAL;
      handleLEDAnimations();

      initTimeTime();
      syncConfiguration();
      
      if (i2cError) {
        logI2CErrorEvent();
      }
    } else {
      Serial.println("\n[FAIL] Wi-Fi connection timed out. Falling back to BLE Configuration Mode.");
      startBLEConfig();
    }
  } else {
    Serial.println("No Wi-Fi credentials found. Starting BLE Configuration Mode.");
    startBLEConfig();
  }
}

void loop() {
  // Update LED continuous animations
  handleLEDAnimations();

  if (isBleMode) {
    // BLE Wi-Fi Site Survey trigger execution
    if (triggerScan) {
      Serial.println("[WIFI] BLE site survey requested. Scanning networks...");
      WiFi.mode(WIFI_STA);
      WiFi.disconnect();
      
      int n = WiFi.scanNetworks();
      Serial.printf("[WIFI] Scanned %d networks\n", n);

      String results = "NETWORKS:";
      int limit = (n < 12) ? n : 12;
      for (int i = 0; i < limit; i++) {
        if (i > 0) results += ";";
        results += WiFi.SSID(i) + "," + String(WiFi.RSSI(i));
      }
      
      scanResults = results;
      pCharacteristic->setValue(scanResults.c_str());
      pCharacteristic->notify();
      
      scanStatus = "idle";
      triggerScan = false;
      Serial.println("[WIFI] Scan complete. BLE Characteristic loaded.");
    }
    
    delay(20);
    return;
  }

  // Normal Operations Loop
  unsigned long currentMs = millis();

  if (WiFi.status() == WL_CONNECTED) {
    // Reset disconnect monitor
    disconnectStartMs = 0;

    // Normal state is operational unless override by I2C fail-safe check
    if (!i2cError) {
      currentLedState = LED_OPERATIONAL;
    }

    // 1. Sync any telemetry records logged offline to flash
    syncOfflineFlashLogs();

    // 2. Periodic config updates
    if (currentMs - lastConfigSyncMs >= CONFIG_SYNC_INTERVAL) {
      lastConfigSyncMs = currentMs;
      syncConfiguration();
    }

    // 3. Telemetry log push
    if (currentMs - lastTelemetryMs >= TELEMETRY_INTERVAL) {
      lastTelemetryMs = currentMs;
      processTelemetry();
    }

    // 4. Modbus RTU Polls
    if (currentMs - lastModbusMs >= MODBUS_INTERVAL) {
      lastModbusMs = currentMs;
      processModbus();
    }
  } else {
    // Wi-Fi Disconnected State
    currentLedState = LED_OFFLINE_LOGGING;

    if (disconnectStartMs == 0) {
      disconnectStartMs = currentMs;
      Serial.println("[WARN] Wi-Fi link lost. Monitoring timeout...");
    }

    unsigned long disconnectSec = (currentMs - disconnectStartMs) / 1000;
    
    // Check if disconnect time exceeds Max Disconnect Time limit
    if (disconnectSec >= wifiMaxDisconnectTime) {
      Serial.printf("[FAIL] Wi-Fi disconnected for %d seconds. Limit: %d. Transitioning to BLE Config Mode.\n", 
                    disconnectSec, wifiMaxDisconnectTime);
      startBLEConfig();
      return;
    }

    // Offline Telemetry push: write telemetry directly to W25Q64 SPI Flash
    if (currentMs - lastTelemetryMs >= TELEMETRY_INTERVAL) {
      lastTelemetryMs = currentMs;
      
      // Read values locally
      float scaledVal[4] = {0};
      for (int i = 0; i < 4; i++) {
        float rawV = adc.readVoltageSingleEnded(i);
        if (analogConfigs[i].mode == "4-20mA") {
          float current_mA = rawV / 0.15f;
          if (current_mA < 4.0) current_mA = 4.0;
          if (current_mA > 20.0) current_mA = 20.0;
          scaledVal[i] = analogConfigs[i].minValue + ((current_mA - 4.0f) / 16.0f) * (analogConfigs[i].maxValue - analogConfigs[i].minValue);
        } else {
          float inputV = rawV * 3.03f;
          if (inputV < 0.0) inputV = 0.0;
          if (inputV > 10.0) inputV = 10.0;
          scaledVal[i] = analogConfigs[i].minValue + (inputV / 10.0f) * (analogConfigs[i].maxValue - analogConfigs[i].minValue);
        }
      }

      DynamicJsonDocument offlineDoc(1024);
      offlineDoc["device_id"] = deviceUUID;
      offlineDoc["analog_ch1"] = scaledVal[0];
      offlineDoc["analog_ch1_mode"] = analogConfigs[0].mode;
      offlineDoc["analog_ch2"] = scaledVal[1];
      offlineDoc["analog_ch2_mode"] = analogConfigs[1].mode;
      offlineDoc["analog_ch3"] = scaledVal[2];
      offlineDoc["analog_ch3_mode"] = analogConfigs[2].mode;
      offlineDoc["analog_ch4"] = scaledVal[3];
      offlineDoc["analog_ch4_mode"] = analogConfigs[3].mode;

      offlineDoc["digital_in1"] = (digitalRead(DIN1) == LOW);
      offlineDoc["digital_in2"] = (digitalRead(DIN2) == LOW);
      offlineDoc["digital_in3"] = (digitalRead(DIN3) == LOW);
      offlineDoc["digital_in4"] = (digitalRead(DIN4) == LOW);

      offlineDoc["digital_out1"] = relayStates[0];
      offlineDoc["digital_out2"] = relayStates[1];
      offlineDoc["digital_out3"] = relayStates[2];
      offlineDoc["digital_out4"] = relayStates[3];

      offlineDoc["rtc_time"] = getISOTime();

      String serializedLog;
      serializeJson(offlineDoc, serializedLog);

      Serial.println("[OFFLINE] Wi-Fi down. Logging telemetry string to flash...");
      writeLogToFlash(serializedLog);
    }
  }
}

void setLEDColor(uint8_t r, uint8_t g, uint8_t b) {
  statusLED.setPixelColor(0, statusLED.Color(r, g, b));
  statusLED.show();
}

void handleLEDAnimations() {
  if (ledDisabled) {
    statusLED.clear();
    statusLED.show();
    return;
  }

  static unsigned long lastBlinkMs = 0;
  static bool blinkOn = false;
  unsigned long now = millis();

  // Highlight critical I2C sensor bus errors first
  if (i2cError && !isBleMode) {
    currentLedState = LED_I2C_ERROR;
  }

  if (now - lastBlinkMs >= 500) {
    lastBlinkMs = now;
    blinkOn = !blinkOn;
  }

  switch (currentLedState) {
    case LED_OFF:
      statusLED.clear();
      statusLED.show();
      break;

    case LED_WIFI_CONNECTING:
      if (blinkOn) {
        setLEDColor(0, 0, 150); // Blue
      } else {
        statusLED.clear();
        statusLED.show();
      }
      break;

    case LED_BLE_MODE:
      if (blinkOn) {
        setLEDColor(120, 100, 0); // Yellow
      } else {
        statusLED.clear();
        statusLED.show();
      }
      break;

    case LED_OPERATIONAL:
      setLEDColor(0, 120, 0); // Green
      break;

    case LED_HTTP_ERROR:
      if (blinkOn) {
        setLEDColor(150, 0, 0); // Red
      } else {
        statusLED.clear();
        statusLED.show();
      }
      break;

    case LED_I2C_ERROR:
      if (blinkOn) {
        setLEDColor(120, 0, 120); // Magenta (Purple)
      } else {
        statusLED.clear();
        statusLED.show();
      }
      break;

    case LED_OFFLINE_LOGGING:
      setLEDColor(150, 60, 0); // Orange / Yellow
      break;
  }
}

// Start BLE Provisioning Server
void startBLEConfig() {
  isBleMode = true;
  currentLedState = LED_BLE_MODE;
  
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  
  Serial.println("[BLE] Initializing BLE Server (Service: 12345678-1234-1234-1234-1234567890ab)...");
  BLEDevice::init("IOBuilds-BLE");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService* pService = pServer->createService("12345678-1234-1234-1234-1234567890ab");
  pCharacteristic = pService->createCharacteristic(
    "12345678-1234-1234-1234-1234567890ac",
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_NOTIFY
  );

  pCharacteristic->setCallbacks(new MyCharacteristicCallbacks());
  pCharacteristic->addDescriptor(new BLE2902());

  // Setup initial response
  String mac = WiFi.macAddress();
  String i2cStatus = i2cError ? "fail" : "ok";
  String statusStr = "MAC=" + mac + ";WIFI=disconnected;I2C=" + i2cStatus + ";";
  pCharacteristic->setValue(statusStr.c_str());

  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID("12345678-1234-1234-1234-1234567890ab");
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMaxPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("[BLE] Advertising active. Awaiting configuration connection from Web Console...");
}

void loadConfig() {
  prefs.begin("gateway", true);
  wifiSSID = prefs.getString("ssid", "");
  wifiPass = prefs.getString("pass", "");
  deviceUUID = prefs.getString("uuid", "");
  apiBaseUrl = prefs.getString("api", "http://192.168.1.100:5001/api");
  wifiMaxDisconnectTime = prefs.getUInt("wifiTimeout", 900);
  ledDisabled = prefs.getBool("ledDisable", false);
  
  // Flash circular logging pointers
  flashWritePtr = prefs.getUInt("flashWrite", 0);
  flashReadPtr = prefs.getUInt("flashRead", 0);
  prefs.end();

  Serial.println("[NVS] Loaded configurations:");
  Serial.print("  SSID: "); Serial.println(wifiSSID);
  Serial.print("  Device UUID: "); Serial.println(deviceUUID);
  Serial.print("  API Base: "); Serial.println(apiBaseUrl);
  Serial.printf("  Max Disconnect Timeout: %d seconds\n", wifiMaxDisconnectTime);
  Serial.printf("  Status LED Disabled: %s\n", ledDisabled ? "true" : "false");
  Serial.printf("  Flash Pointers -> Write: %d, Read: %d\n", flashWritePtr, flashReadPtr);
}

void saveConfig(String ssid, String pass, String uuid, String url) {
  prefs.begin("gateway", false);
  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);
  prefs.putString("uuid", uuid);
  prefs.putString("api", url);
  prefs.end();
  Serial.println("[NVS] Wi-Fi and core settings saved to NVS storage.");
}

void checkI2CBus() {
  Wire.begin(SDA_PIN, SCL_PIN);
  
  // Check ADS1115
  Wire.beginTransmission(0x48);
  if (Wire.endTransmission() != 0) {
    Serial.println("[WARN] ADS1115 ADC not responding on I2C address 0x48!");
    i2cError = true;
  } else {
    if (!adc.begin(Wire)) {
      i2cError = true;
    } else {
      adc.setGain(ADS1115::GAIN_4V096);
      adc.setDataRate(ADS1115::SPS_128);
    }
  }

  // Check PCF8563
  Wire.beginTransmission(0x51);
  if (Wire.endTransmission() != 0) {
    Serial.println("[WARN] PCF8563 RTC not responding on I2C address 0x51!");
    i2cError = true;
  } else {
    if (!rtc.begin(Wire, SDA_PIN, SCL_PIN)) {
      i2cError = true;
    }
  }

  if (i2cError) {
    Serial.println("[WARN] I2C initialization issues detected. Gateway boot bypassed hold to prevent crash/loop.");
  } else {
    Serial.println("[OK] I2C Bus responding normally.");
  }
}

void logI2CErrorEvent() {
  if (WiFi.status() != WL_CONNECTED || deviceUUID.length() == 0 || i2cEventSent) return;

  HTTPClient http;
  String eventUrl = apiBaseUrl + "/device-events";
  http.begin(eventUrl);
  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument doc(512);
  doc["device_id"] = deviceUUID;
  doc["event_type"] = "critical";
  doc["message"] = "I2C Sensor Bus Initialization Failed (ADS1115 or PCF8563 unresponsive on standard I2C channels)";

  String output;
  serializeJson(doc, output);
  int httpCode = http.POST(output);
  http.end();

  if (httpCode == 201) {
    i2cEventSent = true;
    Serial.println("[OK] Critical I2C failure reported to local console event log.");
  }
}

// Time configurations
void initTimeTime() {
  configTime(5.5 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Syncing time with NTP...");
  time_t now = time(nullptr);
  int r = 0;
  while (now < 8 * 3600 * 2 && r < 15) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
    r++;
  }
  
  if (now > 8 * 3600 * 2) {
    Serial.println("\n[OK] NTP time obtained.");
    struct tm timeinfo;
    gmtime_r(&now, &timeinfo);

    IO_RTC_DateTime rtcTime;
    rtcTime.year    = timeinfo.tm_year + 1900;
    rtcTime.month   = timeinfo.tm_mon + 1;
    rtcTime.day     = timeinfo.tm_mday;
    rtcTime.weekday = timeinfo.tm_wday;
    rtcTime.hour    = timeinfo.tm_hour;
    rtcTime.minute  = timeinfo.tm_min;
    rtcTime.second  = timeinfo.tm_sec;
    
    rtc.setDateTime(rtcTime);
  } else {
    Serial.println("\n[WARN] NTP Timeout. Relying on PCF8563 clock.");
  }
}

String getISOTime() {
  IO_RTC_DateTime dt;
  char buf[30];
  if (!i2cError && rtc.getDateTime(dt)) {
    sprintf(buf, "%04d-%02d-%02dT%02d:%02d:%02dZ", dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second);
    return String(buf);
  }
  time_t t = time(nullptr);
  struct tm *tm_info = gmtime(&t);
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", tm_info);
  return String(buf);
}

// Fetch dynamic analog configurations from dashboard
void syncConfiguration() {
  if (WiFi.status() != WL_CONNECTED || deviceUUID.length() == 0) return;

  HTTPClient http;
  String syncUrl = apiBaseUrl + "/device-channel-config?device_id=" + deviceUUID;
  http.begin(syncUrl);

  int httpCode = http.GET();
  if (httpCode == 200) {
    String payload = http.getString();
    DynamicJsonDocument doc(4096);
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      JsonArray arr = doc.as<JsonArray>();
      for (JsonObject obj : arr) {
        String type = obj["channel_type"].as<String>();
        int num = obj["channel_number"].as<int>();
        
        if (type == "analog" && num >= 1 && num <= 4) {
          analogConfigs[num - 1].mode = obj["data_mode"].as<String>();
          analogConfigs[num - 1].minValue = obj["min_value"].as<float>();
          analogConfigs[num - 1].maxValue = obj["max_value"].as<float>();
        }
      }
    }
  }
  http.end();
}

// Offline Logging logic
void writeLogToFlash(String logJson) {
  // Erase next sector ahead of time if boundary crossed
  uint32_t currentSector = flashWritePtr / 4096;
  uint32_t nextSector = (flashWritePtr + logJson.length() + 10) / 4096;

  if (currentSector != nextSector || flashWritePtr == 0) {
    uint32_t eraseAddr = nextSector * 4096;
    if (eraseAddr >= FLASH_MAX_SIZE) eraseAddr = 0;
    flash.eraseSector(eraseAddr);
    Serial.printf("[FLASH] Sector erased at %d\n", eraseAddr);
  }

  if (flash.writeStr(flashWritePtr, logJson)) {
    flashWritePtr += logJson.length() + 1; // plus null terminator
    if (flashWritePtr >= FLASH_MAX_SIZE) {
      flashWritePtr = 0;
    }
    
    prefs.begin("gateway", false);
    prefs.putUInt("flashWrite", flashWritePtr);
    prefs.end();
  }
}

String readLogFromFlash() {
  if (flashReadPtr == flashWritePtr) return "";
  
  String readBack = "";
  if (flash.readStr(flashReadPtr, readBack)) {
    return readBack;
  }
  return "";
}

void advanceReadPointer(uint32_t recordLen) {
  flashReadPtr += recordLen + 1;
  if (flashReadPtr >= FLASH_MAX_SIZE) {
    flashReadPtr = 0;
  }
  
  prefs.begin("gateway", false);
  prefs.putUInt("flashRead", flashReadPtr);
  prefs.end();
}

// Sync back offline logs when Wi-Fi recovers
void syncOfflineFlashLogs() {
  if (flashReadPtr == flashWritePtr) return; // No logs to sync

  Serial.println("[OFFLINE] Syncing logged flash telemetry to backend server...");

  while (flashReadPtr != flashWritePtr) {
    String logPayload = readLogFromFlash();
    if (logPayload.length() == 0) {
      // Corrupt or empty log string, advance pointer to sync write pointer
      flashReadPtr = flashWritePtr;
      prefs.begin("gateway", false);
      prefs.putUInt("flashRead", flashReadPtr);
      prefs.end();
      break;
    }

    HTTPClient http;
    http.begin(apiBaseUrl + "/device-readings");
    http.addHeader("Content-Type", "application/json");

    int httpCode = http.POST(logPayload);
    http.end();

    if (httpCode == 201) {
      Serial.printf("[OFFLINE] Log record synced successfully from address %d\n", flashReadPtr);
      advanceReadPointer(logPayload.length());
    } else {
      Serial.printf("[OFFLINE] Post sync failed (HTTP Code: %d). Awaiting next pass.\n", httpCode);
      break; // Pause syncing if backend is unreachable
    }
    delay(200); // small delay to prevent flooding
  }
}

// Send standard telemetry payload
void processTelemetry() {
  if (WiFi.status() != WL_CONNECTED || deviceUUID.length() == 0) return;

  digitalWrite(LED_TX_PIN, HIGH);

  float scaledVal[4] = {0, 0, 0, 0};
  for (int i = 0; i < 4; i++) {
    float rawV = adc.readVoltageSingleEnded(i);

    if (analogConfigs[i].mode == "4-20mA") {
      float current_mA = rawV / 0.15f;
      if (current_mA < 4.0) current_mA = 4.0;
      if (current_mA > 20.0) current_mA = 20.0;
      scaledVal[i] = analogConfigs[i].minValue + 
                     ((current_mA - 4.0f) / 16.0f) * (analogConfigs[i].maxValue - analogConfigs[i].minValue);
    } else {
      float inputV = rawV * 3.03f;
      if (inputV < 0.0) inputV = 0.0;
      if (inputV > 10.0) inputV = 10.0;
      scaledVal[i] = analogConfigs[i].minValue + 
                     (inputV / 10.0f) * (analogConfigs[i].maxValue - analogConfigs[i].minValue);
    }
  }

  // Active Low inputs
  bool dIn1 = (digitalRead(DIN1) == LOW);
  bool dIn2 = (digitalRead(DIN2) == LOW);
  bool dIn3 = (digitalRead(DIN3) == LOW);
  bool dIn4 = (digitalRead(DIN4) == LOW);

  DynamicJsonDocument txDoc(2048);
  txDoc["device_id"] = deviceUUID;
  txDoc["analog_ch1"] = scaledVal[0];
  txDoc["analog_ch1_mode"] = analogConfigs[0].mode;
  txDoc["analog_ch2"] = scaledVal[1];
  txDoc["analog_ch2_mode"] = analogConfigs[1].mode;
  txDoc["analog_ch3"] = scaledVal[2];
  txDoc["analog_ch3_mode"] = analogConfigs[2].mode;
  txDoc["analog_ch4"] = scaledVal[3];
  txDoc["analog_ch4_mode"] = analogConfigs[3].mode;

  txDoc["digital_in1"] = dIn1;
  txDoc["digital_in2"] = dIn2;
  txDoc["digital_in3"] = dIn3;
  txDoc["digital_in4"] = dIn4;

  txDoc["digital_out1"] = relayStates[0];
  txDoc["digital_out2"] = relayStates[1];
  txDoc["digital_out3"] = relayStates[2];
  txDoc["digital_out4"] = relayStates[3];

  txDoc["rtc_time"] = getISOTime();

  HTTPClient http;
  String telemetryUrl = apiBaseUrl + "/device-readings";
  http.begin(telemetryUrl);
  http.addHeader("Content-Type", "application/json");

  String jsonOutput;
  serializeJson(txDoc, jsonOutput);

  int httpCode = http.POST(jsonOutput);
  if (httpCode == 201) {
    // Normal operation
    if (!i2cError) {
      currentLedState = LED_OPERATIONAL;
    }
    
    String payload = http.getString();
    DynamicJsonDocument rxDoc(2048);
    DeserializationError error = deserializeJson(rxDoc, payload);
    if (!error) {
      if (rxDoc.containsKey("digital_out1")) {
        relayStates[0] = rxDoc["digital_out1"].as<bool>();
#if !defined(CONFIG_IDF_TARGET_ESP32S3)
        if (RELAY1 != 34 && RELAY1 != 35 && RELAY1 != 36 && RELAY1 != 39) {
          digitalWrite(RELAY1, relayStates[0] ? HIGH : LOW);
        }
#else
        digitalWrite(RELAY1, relayStates[0] ? HIGH : LOW);
#endif
      }
      if (rxDoc.containsKey("digital_out2")) {
        relayStates[1] = rxDoc["digital_out2"].as<bool>();
        digitalWrite(RELAY2, relayStates[1] ? HIGH : LOW);
      }
      if (rxDoc.containsKey("digital_out3")) {
        relayStates[2] = rxDoc["digital_out3"].as<bool>();
        digitalWrite(RELAY3, relayStates[2] ? HIGH : LOW);
      }
      if (rxDoc.containsKey("digital_out4")) {
        relayStates[3] = rxDoc["digital_out4"].as<bool>();
        digitalWrite(RELAY4, relayStates[3] ? HIGH : LOW);
      }

      // Sync Max Disconnect Timeout setting
      if (rxDoc.containsKey("wifi_max_disconnect_time")) {
        uint32_t newTimeout = rxDoc["wifi_max_disconnect_time"].as<uint32_t>();
        if (newTimeout != wifiMaxDisconnectTime && newTimeout >= 10) {
          wifiMaxDisconnectTime = newTimeout;
          prefs.begin("gateway", false);
          prefs.putUInt("wifiTimeout", wifiMaxDisconnectTime);
          prefs.end();
          Serial.printf("[CONFIG] Updated max Wi-Fi disconnect timeout to %d seconds.\n", wifiMaxDisconnectTime);
        }
      }

      // Sync LED disabled override
      if (rxDoc.containsKey("led_disabled")) {
        bool serverLedDisabled = rxDoc["led_disabled"].as<bool>();
        if (serverLedDisabled != ledDisabled) {
          ledDisabled = serverLedDisabled;
          prefs.begin("gateway", false);
          prefs.putBool("ledDisable", ledDisabled);
          prefs.end();
          Serial.printf("[CONFIG] Updated ledDisabled state to %s.\n", ledDisabled ? "true" : "false");
        }
      }
    }
  } else {
    Serial.printf("[ERROR] Telemetry push HTTP error: %d\n", httpCode);
    currentLedState = LED_HTTP_ERROR;
  }
  http.end();

  digitalWrite(LED_TX_PIN, LOW);
}

// Modbus Polling Logic
void processModbus() {
  if (WiFi.status() != WL_CONNECTED || deviceUUID.length() == 0) return;

  HTTPClient http;
  
  String devicesUrl = apiBaseUrl + "/modbus/devices?device_id=" + deviceUUID;
  http.begin(devicesUrl);
  
  int devicesHttpCode = http.GET();
  if (devicesHttpCode != 200) {
    http.end();
    return;
  }
  
  String devicesPayload = http.getString();
  http.end();

  DynamicJsonDocument devDoc(8192);
  DeserializationError errDev = deserializeJson(devDoc, devicesPayload);
  if (errDev) return;

  JsonArray devices = devDoc.as<JsonArray>();
  for (JsonObject device : devices) {
    String slaveUUID = device["id"].as<String>();
    uint8_t slaveId = device["slave_id"].as<int>();
    uint32_t baudRate = device["baud_rate"].as<uint32_t>();
    String parityStr = device["parity"].as<String>();
    int stopBits = device["stop_bits"].as<int>();

    uint32_t serialConfig = SERIAL_8N1;
    if (parityStr == "even") {
      serialConfig = (stopBits == 2) ? SERIAL_8E2 : SERIAL_8E1;
    } else if (parityStr == "odd") {
      serialConfig = (stopBits == 2) ? SERIAL_8O2 : SERIAL_8O1;
    } else { // "none"
      serialConfig = (stopBits == 2) ? SERIAL_8N2 : SERIAL_8N1;
    }
    
    Serial1.begin(baudRate, serialConfig, RS485_RX, RS485_TX);
    delay(50);

    String regUrl = apiBaseUrl + "/modbus/registers?modbus_device_id=" + slaveUUID;
    http.begin(regUrl);
    int regHttpCode = http.GET();
    if (regHttpCode != 200) {
      http.end();
      continue;
    }

    String regPayload = http.getString();
    http.end();

    DynamicJsonDocument regDoc(8192);
    DeserializationError errReg = deserializeJson(regDoc, regPayload);
    if (errReg) continue;

    JsonArray registers = regDoc.as<JsonArray>();
    for (JsonObject reg : registers) {
      String registerUUID = reg["id"].as<String>();
      uint16_t address = reg["address"].as<uint16_t>();
      uint8_t fc = reg["function_code"].as<uint8_t>();
      String dataType = reg["data_type"].as<String>();
      float scale = reg["scale"].as<float>();

      int qty = (dataType.indexOf("32") != -1) ? 2 : 1;
      int byteCount = qty * 2;
      uint8_t responseBuffer[10] = {0};

      if (readModbusRegister(slaveId, address, fc, responseBuffer, byteCount)) {
        float rawVal = parseModbusValue(responseBuffer, dataType);
        float scaledVal = rawVal * scale;

        HTTPClient postHttp;
        postHttp.begin(apiBaseUrl + "/modbus/readings");
        postHttp.addHeader("Content-Type", "application/json");

        DynamicJsonDocument modbusTx(1024);
        modbusTx["modbus_device_id"] = slaveUUID;
        modbusTx["register_id"] = registerUUID;
        
        String rawHex = "";
        for (int b = 0; b < byteCount; b++) {
          if (responseBuffer[b] < 0x10) rawHex += "0";
          rawHex += String(responseBuffer[b], HEX);
        }
        modbusTx["raw_value"] = rawHex;
        modbusTx["scaled_value"] = scaledVal;

        String txPayload;
        serializeJson(modbusTx, txPayload);
        postHttp.POST(txPayload);
        postHttp.end();
      }
    }
  }
}

// Low level RS485 read
bool readModbusRegister(uint8_t slaveId, uint16_t address, uint8_t fc, uint8_t *respData, int byteCount) {
  uint8_t frame[8];
  frame[0] = slaveId;
  frame[1] = fc;
  frame[2] = (address >> 8) & 0xFF;
  frame[3] = address & 0xFF;
  
  int qty = byteCount / 2;
  frame[4] = (qty >> 8) & 0xFF;
  frame[5] = qty & 0xFF;

  uint16_t crc = calculateCRC(frame, 6);
  frame[6] = crc & 0xFF;
  frame[7] = (crc >> 8) & 0xFF;

  while (Serial1.available()) Serial1.read();

  digitalWrite(RS485_DIR, HIGH);
  delayMicroseconds(20);
  Serial1.write(frame, 8);
  Serial1.flush();
  delayMicroseconds(50);
  digitalWrite(RS485_DIR, LOW);

  unsigned long start = millis();
  int bytesRead = 0;
  uint8_t response[30] = {0};
  int expectedLength = 5 + byteCount;

  while (millis() - start < 300) {
    if (Serial1.available()) {
      response[bytesRead++] = Serial1.read();
      if (bytesRead >= expectedLength) break;
    }
  }

  if (bytesRead < expectedLength) return false;

  uint16_t calcCrc = calculateCRC(response, expectedLength - 2);
  uint16_t respCrc = response[expectedLength - 2] | (response[expectedLength - 1] << 8);

  if (calcCrc != respCrc) return false;
  if (response[0] != slaveId || response[1] != fc || response[2] != byteCount) return false;

  for (int i = 0; i < byteCount; i++) {
    respData[i] = response[3 + i];
  }
  return true;
}

uint16_t calculateCRC(const uint8_t *buf, int len) {
  uint16_t crc = 0xFFFF;
  for (int pos = 0; pos < len; pos++) {
    crc ^= (uint16_t)buf[pos];
    for (int i = 8; i != 0; i--) {
      if ((crc & 0x0001) != 0) {
        crc >>= 1;
        crc ^= 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

float parseModbusValue(uint8_t *data, String dataType) {
  union {
    float f;
    uint32_t u32;
    int32_t i32;
    uint16_t u16;
    int16_t i16;
    uint8_t bytes[4];
  } converter;

  if (dataType == "float32_be") {
    converter.bytes[3] = data[0];
    converter.bytes[2] = data[1];
    converter.bytes[1] = data[2];
    converter.bytes[0] = data[3];
    return converter.f;
  }
  else if (dataType == "float32_le") {
    converter.bytes[0] = data[0];
    converter.bytes[1] = data[1];
    converter.bytes[2] = data[2];
    converter.bytes[3] = data[3];
    return converter.f;
  }
  else if (dataType == "uint32_be") {
    uint32_t raw = ((uint32_t)data[0] << 24) | ((uint32_t)data[1] << 16) | ((uint32_t)data[2] << 8) | data[3];
    return (float)raw;
  }
  else if (dataType == "uint32_le") {
    uint32_t raw = ((uint32_t)data[3] << 24) | ((uint32_t)data[2] << 16) | ((uint32_t)data[1] << 8) | data[0];
    return (float)raw;
  }
  else if (dataType == "int32_be") {
    int32_t raw = ((int32_t)data[0] << 24) | ((int32_t)data[1] << 16) | ((int32_t)data[2] << 8) | data[3];
    return (float)raw;
  }
  else if (dataType == "int32_le") {
    int32_t raw = ((int32_t)data[3] << 24) | ((int32_t)data[2] << 16) | ((int32_t)data[1] << 8) | data[0];
    return (float)raw;
  }
  else if (dataType == "uint16") {
    uint16_t raw = ((uint16_t)data[0] << 8) | data[1];
    return (float)raw;
  }
  else if (dataType == "int16") {
    int16_t raw = ((int16_t)data[0] << 8) | data[1];
    return (float)raw;
  }
  return (float)(((uint16_t)data[0] << 8) | data[1]);
}
