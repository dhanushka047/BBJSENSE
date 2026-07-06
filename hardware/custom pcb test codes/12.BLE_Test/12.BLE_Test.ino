/********************************************************************
 *  IO Builds — Sri Lanka
 *  Dhanushka Udaya Kumara
 *  Embedded Systems Engineer
 *
 *  ESP32-S3 BLE TEST (Peripheral)
 *  - Advertises as: "IOBuilds-BLE"
 *  - Service UUID: 12345678-1234-1234-1234-1234567890ab
 *  - Char   UUID: 12345678-1234-1234-1234-1234567890ac
 *  - Sends a counter notification every 1s when connected
 ********************************************************************/

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define BLE_DEVICE_NAME "IOBuilds-BLE"

static BLEServer*       pServer      = nullptr;
static BLECharacteristic* pChar      = nullptr;
static bool             deviceConnected    = false;
static uint32_t         counter      = 0;

// Server connect / disconnect callbacks
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    deviceConnected = true;
  }
  void onDisconnect(BLEServer* pServer) override {
    deviceConnected = false;
    // Restart advertising so another device can connect
    pServer->getAdvertising()->start();
  }
};

void setup() {
  Serial.begin(115200);
  delay(300);

  // Init BLE
  BLEDevice::init(BLE_DEVICE_NAME);
 // BLEDevice::setPower(ESP_PWR_LVL_P7); // max TX power for testing

  // Create server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // Create service
  BLEService* pService = pServer->createService("12345678-1234-1234-1234-1234567890ab");

  // Create characteristic (READ + NOTIFY)
  pChar = pService->createCharacteristic(
    "12345678-1234-1234-1234-1234567890ac",
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_NOTIFY
  );

  // CCCD so phones can enable notifications
  pChar->addDescriptor(new BLE2902());

  // Initial value
  pChar->setValue("IO Builds BLE Test");

  // Start service
  pService->start();

  // Start advertising
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID("12345678-1234-1234-1234-1234567890ab");
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // fast connect
  pAdvertising->setMaxPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("BLE started. Advertised as: " BLE_DEVICE_NAME);
}

void loop() {
  if (deviceConnected) {
    // Build payload string
    String msg = "CNT=" + String(counter++);
    pChar->setValue(msg.c_str());
    pChar->notify();   // send notification

    Serial.print("Notify: ");
    Serial.println(msg);
  }

  delay(1000);
}