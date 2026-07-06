# Release Walkthrough: Telemetry Gateway Firmware v4.0 & BLE-Assisted Wi-Fi Scanning

We have successfully implemented a BLE-assisted Wi-Fi site survey scanning flow and resolved the compilation memory constraints on the classic ESP32 hardware model.

---

## 📶 BLE-Assisted Wi-Fi Scanning Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant WebApp as Web App (Chrome/Edge)
    participant ESP32 as ESP32-S3 Gateway
    
    User->>WebApp: Clicks "Connect & Scan Wi-Fi via BLE"
    WebApp->>ESP32: Pair & GATT Connect
    ESP32-->>WebApp: Returns MAC address, I2C diagnostic status
    WebApp->>ESP32: Write "SCAN" to Characteristic
    Note over ESP32: Sets triggerScan = true
    ESP32->>ESP32: Runs WiFi.scanNetworks() in main STA mode
    loop Poll Scan Status (Every 1s)
        WebApp->>ESP32: Read Characteristic
        ESP32-->>WebApp: Returns "STATUS:scanning" (in progress)
    end
    ESP32-->>WebApp: Returns "NETWORKS:Office_AP,-65;Home_AP,-80"
    WebApp->>User: Renders networks dropdown selector + signal strength dBm
    User->>WebApp: Selects SSID, enters password, clicks "Provision & Add"
    WebApp->>ESP32: Write JSON {"ssid":"Office_AP","pass":"123","uuid":"...","api":"..."}
    ESP32->>ESP32: Save configuration to Preferences NVS & ESP.restart()
```

---

## 🏗️ Architectural Deliverables

### 1. Frontend Add Device Modal ([Devices.tsx](file:///Volumes/512SSD/Development/Web/BBJSENSE/src/pages/Devices.tsx))
*   Includes the **"Connect & Scan Wi-Fi via BLE"** action button.
*   Triggers loading loader panel during scan execution.
*   Renders a dropdown listing the scanned SSIDs and signal levels (RSSIs).
*   Supports entering custom SSIDs if the desired AP is hidden or not listed.
*   Retrieves the gateway's MAC address from BLE to register the device in the local server automatically on success.

### 2. ESP32 Gateway Firmware ([gateway_firmware_v1.ino](file:///Volumes/512SSD/Development/Web/BBJSENSE/hardware/gateway_firmware_v1/gateway_firmware_v1.ino))
*   **Write Command Listener**: Interprets `"SCAN"` commands, starts the background scan, and updates the characteristic value.
*   **Wi-Fi Site Survey**: Scans nearby access points, filters the top 12 networks, and serializes them to format: `NETWORKS:SSID,RSSI;SSID,RSSI`.
*   **IRAM Linker Optimization**: Removed the heavy `SPIMemory` library and replaced it with a direct, lightweight SPI driver for the W25Q64 Flash chip. This freed up over 8KB of instruction RAM, resolving the `iram0_0_seg` linker overflow on the classic ESP32 board.
*   **Hardware Pin Protection**: Added compile-time check safeguards to skip setting input-only pins (like GPIO 36 `RELAY1` on the classic ESP32 WROVER footprint) as outputs, which keeps the boot serial output warning-free.
