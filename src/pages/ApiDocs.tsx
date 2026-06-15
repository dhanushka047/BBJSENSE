import { motion } from "framer-motion";
import { Copy, Check, Code, Database, Wifi, Send, Shield, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import AppLayout from "@/components/AppLayout";
import { useState } from "react";

function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm font-mono text-foreground border border-border">
        <code>{code}</code>
      </pre>
      <button onClick={handleCopy} className="absolute top-2 right-2 p-1.5 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function EndpointCard({ method, path, description, requestBody, responseBody, auth = true }: {
  method: "POST" | "GET" | "PUT" | "DELETE";
  path: string;
  description: string;
  requestBody?: string;
  responseBody?: string;
  auth?: boolean;
}) {
  const methodColors: Record<string, string> = {
    POST: "bg-success/10 text-success",
    GET: "bg-info/10 text-info",
    PUT: "bg-warning/10 text-warning",
    DELETE: "bg-destructive/10 text-destructive",
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge className={`${methodColors[method]} font-mono text-xs font-bold border-0`}>{method}</Badge>
          <code className="text-sm font-mono text-foreground">{path}</code>
          {auth && <Badge variant="outline" className="text-xs gap-1"><Shield size={10} /> Auth Required</Badge>}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {requestBody && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Request Body</p>
            <CodeBlock code={requestBody} />
          </div>
        )}
        {responseBody && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Response</p>
            <CodeBlock code={responseBody} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ApiDocs = () => {
  const baseUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Code size={24} className="text-primary" /> API Documentation
          </h1>
          <p className="text-sm text-muted-foreground">ESP32 device integration endpoints and data formats</p>
        </div>

        {/* Base URL */}
        <Card className="gradient-card border-primary/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Base URL</p>
            <CodeBlock code={`${baseUrl}/functions/v1`} language="text" />
          </CardContent>
        </Card>

        <Tabs defaultValue="ingestion" className="space-y-4">
          <TabsList className="bg-muted flex-wrap">
            <TabsTrigger value="ingestion"><Send size={14} className="mr-1.5" /> Data Ingestion</TabsTrigger>
            <TabsTrigger value="config"><Settings size={14} className="mr-1.5" /> Device Config Sync</TabsTrigger>
            <TabsTrigger value="schema"><Database size={14} className="mr-1.5" /> Data Schema</TabsTrigger>
            <TabsTrigger value="packet"><Code size={14} className="mr-1.5" /> Packet Format</TabsTrigger>
            <TabsTrigger value="esp32"><Wifi size={14} className="mr-1.5" /> ESP32 Example</TabsTrigger>
          </TabsList>

          <TabsContent value="ingestion" className="space-y-4">
            <EndpointCard
              method="POST"
              path="/device-data"
              description="Submit device sensor readings. Called by the ESP32 board. Mode is auto-detected if not provided (values >10 = 4-20mA, ≤10 = 0-10V)."
              auth={false}
              requestBody={`{
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "analog": {
    "ch1": { "value": 4.25, "mode": "0-10V" },
    "ch2": { "value": 12.5, "mode": "4-20mA" },
    "ch3": { "value": 7.80 },
    "ch4": { "value": 18.2 }
  },
  "digital_in": {
    "di1": true,
    "di2": false,
    "di3": true,
    "di4": false
  },
  "digital_out": {
    "do1": true,
    "do2": false,
    "do3": true,
    "do4": false
  },
  "rtc_time": "2026-02-23T14:32:05Z"
}

// NOTE: "mode" field is optional.
// Auto-detection: value > 10 → "4-20mA", value ≤ 10 → "0-10V"`}
              responseBody={`{
  "success": true,
  "device_id": "uuid-of-device",
  "reading_id": "uuid-of-reading"
}`}
            />
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <EndpointCard
              method="GET"
              path="/device-data?mac=AA:BB:CC:DD:EE:FF"
              description="Get device channel configuration and pending digital output states. Polled by ESP32 to sync settings from the cloud."
              auth={false}
              responseBody={`{
  "device_id": "uuid",
  "modbus_address": "0x01",
  "channel_config": [
    {
      "channel_type": "analog",
      "channel_number": 1,
      "label": "Pressure",
      "data_mode": "4-20mA",
      "unit": "mA",
      "min_value": 4,
      "max_value": 20
    },
    {
      "channel_type": "digital_in",
      "channel_number": 1,
      "label": "Door Sensor",
      "data_mode": "binary",
      "unit": "",
      "min_value": 0,
      "max_value": 1
    }
  ],
  "digital_out": {
    "do1": true,
    "do2": false,
    "do3": true,
    "do4": false
  }
}

// ESP32 polls this endpoint periodically to:
// 1. Get latest channel labels and modes
// 2. Get pending digital output commands
// 3. Get modbus address updates`}
            />

            <Card className="border-primary/20">
              <CardContent className="p-4 text-sm text-muted-foreground space-y-2">
                <p><strong className="text-foreground">Sync Flow:</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>User configures channel labels, modes, modbus address in the web UI</li>
                  <li>Configuration is saved to the cloud database</li>
                  <li>ESP32 polls <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded text-foreground">GET /device-data?mac=...</code> every 30s</li>
                  <li>ESP32 applies received config (channel modes, DO states, modbus addr)</li>
                  <li>ESP32 sends data back with <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded text-foreground">POST /device-data</code> using the updated modes</li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schema" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Device Readings Schema</CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock code={`device_readings {
  id            UUID        PRIMARY KEY
  device_id     UUID        REFERENCES devices(id)
  
  // Analog Channels (4x)
  analog_ch1       REAL     // raw sensor value
  analog_ch1_mode  TEXT     // "0-10V" | "4-20mA" (auto-detected)
  analog_ch2       REAL
  analog_ch2_mode  TEXT
  analog_ch3       REAL
  analog_ch3_mode  TEXT
  analog_ch4       REAL
  analog_ch4_mode  TEXT
  
  // Digital Inputs (4x)
  digital_in1      BOOLEAN
  digital_in2      BOOLEAN
  digital_in3      BOOLEAN
  digital_in4      BOOLEAN
  
  // Digital Outputs (4x)
  digital_out1     BOOLEAN
  digital_out2     BOOLEAN
  digital_out3     BOOLEAN
  digital_out4     BOOLEAN
  
  // Timestamps
  rtc_time         TIMESTAMPTZ
  created_at       TIMESTAMPTZ
}`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Channel Configuration Schema</CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock code={`device_channel_config {
  id              UUID     PRIMARY KEY
  device_id       UUID     REFERENCES devices(id) ON DELETE CASCADE
  channel_type    TEXT     "analog" | "digital_in" | "digital_out"
  channel_number  INT      1-4
  label           TEXT     user-defined label
  data_mode       TEXT     "0-10V" | "4-20mA" | "binary"
  unit            TEXT     "V" | "mA" | ""
  min_value       REAL     minimum range
  max_value       REAL     maximum range
  
  UNIQUE(device_id, channel_type, channel_number)
}`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Devices Schema</CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock code={`devices {
  id               UUID        PRIMARY KEY
  mac_address      TEXT        UNIQUE NOT NULL
  name             TEXT
  nickname         TEXT
  owner_id         UUID
  approval_status  ENUM        "pending" | "approved" | "rejected"
  approved_by      UUID
  is_online        BOOLEAN
  last_seen_at     TIMESTAMPTZ
  modbus_address   TEXT
  created_at       TIMESTAMPTZ
  updated_at       TIMESTAMPTZ
}`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Value Ranges</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 px-3 font-medium">Channel Type</th>
                        <th className="text-left py-2 px-3 font-medium">Mode</th>
                        <th className="text-left py-2 px-3 font-medium">Range</th>
                        <th className="text-left py-2 px-3 font-medium">Unit</th>
                        <th className="text-left py-2 px-3 font-medium">Auto-Detect</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-xs">
                      <tr className="border-b border-border/50"><td className="py-2 px-3">Analog</td><td className="py-2 px-3">Voltage</td><td className="py-2 px-3">0.00 - 10.00</td><td className="py-2 px-3">V</td><td className="py-2 px-3">value ≤ 10</td></tr>
                      <tr className="border-b border-border/50"><td className="py-2 px-3">Analog</td><td className="py-2 px-3">Current</td><td className="py-2 px-3">4.00 - 20.00</td><td className="py-2 px-3">mA</td><td className="py-2 px-3">value &gt; 10</td></tr>
                      <tr className="border-b border-border/50"><td className="py-2 px-3">Digital In</td><td className="py-2 px-3">Binary</td><td className="py-2 px-3">true / false</td><td className="py-2 px-3">-</td><td className="py-2 px-3">-</td></tr>
                      <tr><td className="py-2 px-3">Digital Out</td><td className="py-2 px-3">Binary</td><td className="py-2 px-3">true / false</td><td className="py-2 px-3">-</td><td className="py-2 px-3">-</td></tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="packet" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Complete JSON Packet Format</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Full packet specification for ESP32 → Cloud communication. Save this as a reference JSON file.
                </p>
                <CodeBlock code={`{
  "$schema": "BBJSENSE Data Packet v1.0",
  
  "mac_address": "AA:BB:CC:DD:EE:FF",
  
  "analog": {
    "ch1": {
      "value": 4.25,
      "mode": "0-10V"
    },
    "ch2": {
      "value": 12.5,
      "mode": "4-20mA"
    },
    "ch3": {
      "value": 7.80,
      "mode": "0-10V"
    },
    "ch4": {
      "value": 18.2,
      "mode": "4-20mA"
    }
  },
  
  "digital_in": {
    "di1": true,
    "di2": false,
    "di3": true,
    "di4": false
  },
  
  "digital_out": {
    "do1": true,
    "do2": false,
    "do3": true,
    "do4": false
  },
  
  "rtc_time": "2026-02-23T14:32:05Z"
}

// FIELD REFERENCE:
// ─────────────────────────────────────────
// mac_address  (required) Device MAC, uppercase, colon-separated
// analog.chN   (optional) Analog channel 1-4
//   .value     (required) Float, raw sensor reading
//   .mode      (optional) "0-10V" or "4-20mA"
//              Auto-detected if omitted: >10 → 4-20mA, ≤10 → 0-10V
// digital_in   (optional) Digital inputs 1-4, boolean
// digital_out  (optional) Digital outputs 1-4, boolean
// rtc_time     (optional) ISO 8601 timestamp from device RTC`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Config Sync Response Format</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Response from <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded text-foreground">GET /device-data?mac=...</code> — used by ESP32 to sync configuration.
                </p>
                <CodeBlock code={`{
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "modbus_address": "0x01",
  
  "channel_config": [
    {
      "channel_type": "analog",
      "channel_number": 1,
      "label": "Pressure",
      "data_mode": "4-20mA",
      "unit": "mA",
      "min_value": 4.0,
      "max_value": 20.0
    },
    {
      "channel_type": "analog",
      "channel_number": 2,
      "label": "Flow Rate",
      "data_mode": "0-10V",
      "unit": "V",
      "min_value": 0.0,
      "max_value": 10.0
    },
    {
      "channel_type": "digital_in",
      "channel_number": 1,
      "label": "Door Sensor",
      "data_mode": "binary",
      "unit": "",
      "min_value": 0,
      "max_value": 1
    },
    {
      "channel_type": "digital_out",
      "channel_number": 1,
      "label": "Relay 1",
      "data_mode": "binary",
      "unit": "",
      "min_value": 0,
      "max_value": 1
    }
  ],
  
  "digital_out": {
    "do1": true,
    "do2": false,
    "do3": true,
    "do4": false
  }
}`} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="esp32" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ESP32 Arduino Example (HTTP POST + Config Sync)</CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock code={`#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* BASE_URL = "${baseUrl}/functions/v1/device-data";
const char* MAC_ADDR = "AA:BB:CC:DD:EE:FF";

// Channel modes (synced from cloud)
String ch1_mode = "0-10V";
String ch2_mode = "4-20mA";
String ch3_mode = "0-10V";
String ch4_mode = "4-20mA";

void syncConfig() {
  HTTPClient http;
  String url = String(BASE_URL) + "?mac=" + MAC_ADDR;
  http.begin(url);
  
  int httpCode = http.GET();
  if (httpCode == 200) {
    StaticJsonDocument<1024> doc;
    deserializeJson(doc, http.getString());
    
    JsonArray configs = doc["channel_config"];
    for (JsonObject cfg : configs) {
      if (strcmp(cfg["channel_type"], "analog") == 0) {
        int ch = cfg["channel_number"];
        const char* mode = cfg["data_mode"];
        if (ch == 1) ch1_mode = mode;
        if (ch == 2) ch2_mode = mode;
        if (ch == 3) ch3_mode = mode;
        if (ch == 4) ch4_mode = mode;
      }
    }
    
    // Apply DO states
    JsonObject dout = doc["digital_out"];
    if (!dout.isNull()) {
      digitalWrite(GPIO_DO1, dout["do1"] ? HIGH : LOW);
      digitalWrite(GPIO_DO2, dout["do2"] ? HIGH : LOW);
      digitalWrite(GPIO_DO3, dout["do3"] ? HIGH : LOW);
      digitalWrite(GPIO_DO4, dout["do4"] ? HIGH : LOW);
    }
  }
  http.end();
}

void sendReadings() {
  HTTPClient http;
  http.begin(BASE_URL);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<512> doc;
  doc["mac_address"] = MAC_ADDR;

  JsonObject analog = doc.createNestedObject("analog");
  
  JsonObject ch1 = analog.createNestedObject("ch1");
  ch1["value"] = analogRead(0) * (10.0 / 4095.0);
  ch1["mode"] = ch1_mode;

  JsonObject ch2 = analog.createNestedObject("ch2");
  ch2["value"] = 4.0 + analogRead(1) * (16.0 / 4095.0);
  ch2["mode"] = ch2_mode;

  // ... ch3, ch4

  JsonObject di = doc.createNestedObject("digital_in");
  di["di1"] = digitalRead(GPIO_DI1);
  di["di2"] = digitalRead(GPIO_DI2);
  di["di3"] = digitalRead(GPIO_DI3);
  di["di4"] = digitalRead(GPIO_DI4);

  JsonObject dout = doc.createNestedObject("digital_out");
  dout["do1"] = digitalRead(GPIO_DO1);
  dout["do2"] = digitalRead(GPIO_DO2);
  dout["do3"] = digitalRead(GPIO_DO3);
  dout["do4"] = digitalRead(GPIO_DO4);

  doc["rtc_time"] = getRTCTimeISO8601();

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  if (httpCode == 200) {
    Serial.println("Data sent successfully");
  }
  http.end();
}

void loop() {
  syncConfig();     // Sync config from cloud
  sendReadings();   // Send sensor data
  delay(30000);     // Every 30 seconds
}`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Modbus RTU Integration Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>The ESP32-S3 board supports Modbus RTU via its RS485 interface. The modbus address is configurable per device through the Config page.</p>
                <p>When using Modbus, the ESP32 acts as a gateway — reading Modbus registers and forwarding data via HTTP to the cloud endpoint.</p>
                <p>The <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">modbus_address</code> field syncs via the GET config endpoint.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </AppLayout>
  );
};

export default ApiDocs;
