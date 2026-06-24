import { motion } from "framer-motion";
import { Copy, Check, Code, Database, Wifi, Send, Shield, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
      <pre className="bg-background/40 rounded-xl p-4 overflow-x-auto text-xs font-mono text-foreground border border-border/40 max-h-[450px] scrollbar-thin">
        <code>{code}</code>
      </pre>
      <button onClick={handleCopy} className="absolute top-2 right-2 p-1.5 rounded-md bg-card/75 border border-border/20 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
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
    POST: "bg-primary/15 text-primary border border-primary/25",
    GET: "bg-success/15 text-success border border-success/25",
    PUT: "bg-warning/15 text-warning border border-warning/25",
    DELETE: "bg-destructive/15 text-destructive border border-destructive/25",
  };

  return (
    <Card className="border border-border bg-card shadow-sm relative overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge className={`${methodColors[method]} font-mono text-[10px] font-bold border`}>{method}</Badge>
          <code className="text-xs font-mono text-foreground bg-background/30 px-2 py-0.5 rounded border border-border/20">{path}</code>
          {auth && <Badge variant="outline" className="text-[10px] gap-1 font-semibold border-border"><Shield size={10} /> Auth Required</Badge>}
        </div>
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {requestBody && (
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">JSON Request Body Payload</p>
            <CodeBlock code={requestBody} />
          </div>
        )}
        {responseBody && (
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">JSON Response Format</p>
            <CodeBlock code={responseBody} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ApiDocs = () => {
  const baseUrl = `http://localhost:5001/api`;

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Code size={24} className="text-primary" /> Developer API & Docs
          </h1>
          <p className="text-sm text-muted-foreground">ESP32 gateway microcontroller payload schemas and synchronization parameters</p>
        </div>

        {/* Base URL */}
        <Card className="border border-border bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Active Local Endpoint Base URL</p>
            <CodeBlock code={baseUrl} language="text" />
          </CardContent>
        </Card>

        <Tabs defaultValue="ingestion" className="space-y-4">
          <TabsList className="bg-muted/40 p-1 rounded-xl flex-wrap h-auto">
            <TabsTrigger value="ingestion" className="rounded-lg text-xs font-semibold"><Send size={13} className="mr-1.5" /> Ingest Telemetry</TabsTrigger>
            <TabsTrigger value="config" className="rounded-lg text-xs font-semibold"><Settings size={13} className="mr-1.5" /> Configuration Sync</TabsTrigger>
            <TabsTrigger value="schema" className="rounded-lg text-xs font-semibold"><Database size={13} className="mr-1.5" /> DB Schema</TabsTrigger>
            <TabsTrigger value="packet" className="rounded-lg text-xs font-semibold"><Code size={13} className="mr-1.5" /> JSON Reference</TabsTrigger>
            <TabsTrigger value="esp32" className="rounded-lg text-xs font-semibold"><Wifi size={13} className="mr-1.5" /> ESP32-S3 Setup</TabsTrigger>
          </TabsList>

          <TabsContent value="ingestion" className="space-y-4">
            <EndpointCard
              method="POST"
              path="/device-readings"
              description="Sends telemetry values from a registered edge gateway node. The system updates the device's online status, logs the readings in SQLite/MySQL, and broadcasts the event in real-time to active dashboard clients over WebSockets."
              auth={false}
              requestBody={`{
  "device_id": "8fbbf427-68a4-480a-8e5c-57922ef8a75a",
  "analog_ch1": 75.4,
  "analog_ch1_mode": "4-20mA",
  "analog_ch2": 6.2,
  "analog_ch2_mode": "0-10V",
  "analog_ch3": 45.1,
  "analog_ch3_mode": "0-10V",
  "analog_ch4": 23.4,
  "analog_ch4_mode": "0-10V",
  "digital_in1": true,
  "digital_in2": false,
  "digital_in3": true,
  "digital_in4": false,
  "digital_out1": true,
  "digital_out2": false,
  "digital_out3": false,
  "digital_out4": false,
  "rtc_time": "2026-06-24T13:30:00Z"
}`}
              responseBody={`{
  "id": "ecca449b-6681-4ce3-8178-68288792a161",
  "device_id": "8fbbf427-68a4-480a-8e5c-57922ef8a75a",
  "analog_ch1": 75.4,
  "analog_ch1_mode": "4-20mA",
  "analog_ch2": 6.2,
  "analog_ch2_mode": "0-10V",
  "analog_ch3": 45.1,
  "analog_ch3_mode": "0-10V",
  "analog_ch4": 23.4,
  "analog_ch4_mode": "0-10V",
  "digital_in1": true,
  "digital_in2": false,
  "digital_in3": true,
  "digital_in4": false,
  "digital_out1": true,
  "digital_out2": false,
  "digital_out3": false,
  "digital_out4": false,
  "rtc_time": "2026-06-24T13:30:00.000Z",
  "created_at": "2026-06-24T08:00:00.000Z"
}`}
            />

            <EndpointCard
              method="POST"
              path="/device-events"
              description="Logs diagnostics, thresholds triggers, or system anomalies. These are logged in the events log and broadcasted instantly to the 'device-events-device_id' WebSocket topic."
              auth={true}
              requestBody={`{
  "device_id": "8fbbf427-68a4-480a-8e5c-57922ef8a75a",
  "event_type": "alert", // 'info' | 'alert' | 'critical'
  "message": "Boiler temperature critical threshold exceeded! Reading: 85.3 °C (Max: 80.0 °C)"
}`}
              responseBody={`{
  "id": "383eb04e-9914-434b-bb6a-2cee20c1efca",
  "device_id": "8fbbf427-68a4-480a-8e5c-57922ef8a75a",
  "event_type": "alert",
  "message": "Boiler temperature critical threshold exceeded! Reading: 85.3 °C (Max: 80.0 °C)",
  "triggered_by": "user-uuid-2222",
  "created_at": "2026-06-24T08:05:00.000Z"
}`}
            />
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <EndpointCard
              method="GET"
              path="/device-channel-config?device_id=8fbbf427-68a4-480a-8e5c-57922ef8a75a"
              description="Invoked by the gateway node or client to fetch dynamic channel labels, units, and custom scaling configurations for analog and digital I/O."
              auth={true}
              responseBody={`[
  {
    "id": "cfg-uuid-1111",
    "device_id": "8fbbf427-68a4-480a-8e5c-57922ef8a75a",
    "channel_type": "analog",
    "channel_number": 1,
    "label": "Boiler Temperature",
    "data_mode": "4-20mA",
    "unit": "°C",
    "min_value": 0,
    "max_value": 150,
    "created_at": "2026-06-24T08:00:00.000Z",
    "updated_at": "2026-06-24T08:00:00.000Z"
  },
  {
    "id": "cfg-uuid-2222",
    "device_id": "8fbbf427-68a4-480a-8e5c-57922ef8a75a",
    "channel_type": "digital_in",
    "channel_number": 1,
    "label": "Safety Gate Interlock",
    "data_mode": "binary",
    "unit": "",
    "min_value": 0,
    "max_value": 1,
    "created_at": "2026-06-24T08:00:00.000Z",
    "updated_at": "2026-06-24T08:00:00.000Z"
  }
]`}
            />

            <EndpointCard
              method="POST"
              path="/devices"
              description="Registers a new hardware gateway node under the authenticated user. Newly registered nodes default to 'pending' state and must be approved by an administrator."
              auth={true}
              requestBody={`{
  "mac_address": "00:1A:2B:3C:4D:5E",
  "name": "Gateway Node D",
  "nickname": "Assembly Line 4 Controller",
  "modbus_address": "0x04"
}`}
              responseBody={`{
  "id": "d27f85ae-78c2-43cb-8b1c-dcdc5a000cba",
  "mac_address": "00:1A:2B:3C:4D:5E",
  "name": "Gateway Node D",
  "nickname": "Assembly Line 4 Controller",
  "owner_id": "user-uuid-2222",
  "approval_status": "pending",
  "is_online": false,
  "modbus_address": "0x04",
  "created_at": "2026-06-24T08:10:00.000Z",
  "updated_at": "2026-06-24T08:10:00.000Z"
}`}
            />

            <Card className="border border-border bg-card shadow-sm">
              <CardHeader className="pb-2 border-b border-border/40">
                <CardTitle className="text-sm font-semibold">Synchronization Pipeline Workflow</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 text-xs text-muted-foreground space-y-2.5 leading-relaxed font-sans">
                <p>1. The dashboard administrator updates channel labels, active scaling limits, or Modbus registers mappings in the UI.</p>
                <p>2. Configuration parameters are instantly written to the backend database (SQLite/MySQL).</p>
                <p>3. The ESP32 node polls the <code className="bg-background/80 px-1.5 py-0.5 rounded font-mono text-[10px]">GET /api/device-channel-config?device_id=...</code> endpoint at periodic intervals (e.g., 15s-30s).</p>
                <p>4. The MCU decodes the JSON payload, applies relays configuration, and updates its local memory mapping.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schema" className="space-y-4">
            <Card className="border border-border bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold text-foreground">Device Readings Relational Schema (Prisma / SQLite / MySQL)</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <CodeBlock code={`model DeviceReading {
  id              String   @id @default(uuid())
  device_id       String
  analog_ch1      Float?   @default(0)
  analog_ch1_mode String?  @default("0-10V")
  analog_ch2      Float?   @default(0)
  analog_ch2_mode String?  @default("0-10V")
  analog_ch3      Float?   @default(0)
  analog_ch3_mode String?  @default("0-10V")
  analog_ch4      Float?   @default(0)
  analog_ch4_mode String?  @default("0-10V")
  digital_in1     Boolean? @default(false)
  digital_in2     Boolean? @default(false)
  digital_in3     Boolean? @default(false)
  digital_in4     Boolean? @default(false)
  digital_out1    Boolean? @default(false)
  digital_out2    Boolean? @default(false)
  digital_out3    Boolean? @default(false)
  digital_out4    Boolean? @default(false)
  rtc_time        DateTime?
  created_at      DateTime @default(now())
  device          Device   @relation(fields: [device_id], references: [id], onDelete: Cascade)
}`} />
              </CardContent>
            </Card>

            <Card className="border border-border bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold text-foreground">Channel Configuration Relational Schema (Prisma / SQLite / MySQL)</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <CodeBlock code={`model DeviceChannelConfig {
  id             String   @id @default(uuid())
  device_id      String
  channel_type   String   // 'analog', 'digital_in', 'digital_out'
  channel_number Int
  label          String   @default("")
  data_mode      String?  @default("0-10V")
  unit           String?  @default("")
  min_value      Float?   @default(0)
  max_value      Float?   @default(10)
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt
  device         Device   @relation(fields: [device_id], references: [id], onDelete: Cascade)

  @@unique([device_id, channel_type, channel_number])
}`} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="packet" className="space-y-4">
            <Card className="border border-border bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold text-foreground">Unified Ingestion Payload Reference Packet JSON</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <CodeBlock code={`{
  "$schema": "BBJSENSE Data Payload Specification v1.1",
  "device_id": "8fbbf427-68a4-480a-8e5c-57922ef8a75a",
  "analog_ch1": 42.5,
  "analog_ch1_mode": "4-20mA",
  "analog_ch2": 1.25,
  "analog_ch2_mode": "0-10V",
  "analog_ch3": 0.0,
  "analog_ch3_mode": "0-10V",
  "analog_ch4": 0.0,
  "analog_ch4_mode": "0-10V",
  "digital_in1": true,
  "digital_in2": false,
  "digital_in3": true,
  "digital_in4": false,
  "digital_out1": true,
  "digital_out2": false,
  "digital_out3": false,
  "digital_out4": false,
  "rtc_time": "2026-06-24T13:30:00Z"
}`} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="esp32" className="space-y-4">
            <Card className="border border-border bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold text-foreground">Arduino C++ HTTP Client Ingestion & Polling Example</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <CodeBlock code={`#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "Factory_Boiler_Room_SSID";
const char* WIFI_PASS = "FactorySecurePassword123";
// Replace with your Express server's IP address and Port
const char* API_BASE_URL = "http://192.168.1.100:5001/api"; 
const char* DEVICE_UUID = "8fbbf427-68a4-480a-8e5c-57922ef8a75a";

void setup() {
  Serial.begin(115200);
  pinMode(5, OUTPUT); // Relay Output DO1
  
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi Connected.");
}

void pollConfiguration() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    // GET channel configurations
    String fetchUrl = String(API_BASE_URL) + "/device-channel-config?device_id=" + DEVICE_UUID;
    http.begin(fetchUrl);
    
    int httpResponseCode = http.GET();
    if (httpResponseCode == 200) {
      String payload = http.getString();
      DynamicJsonDocument doc(2048);
      deserializeJson(doc, payload);
      
      // Parse settings and output relay configurations
      JsonArray arr = doc.as<JsonArray>();
      for (JsonObject obj : arr) {
        const char* type = obj["channel_type"];
        int num = obj["channel_number"];
        const char* label = obj["label"];
        
        Serial.printf("Config received: CH %d (%s) - Label: %s\\n", num, type, label);
      }
    }
    http.end();
  }
}

void postTelemetry() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    // POST Telemetry readings
    String postUrl = String(API_BASE_URL) + "/device-readings";
    http.begin(postUrl);
    http.addHeader("Content-Type", "application/json");
    
    DynamicJsonDocument txDoc(1024);
    txDoc["device_id"] = DEVICE_UUID;
    txDoc["analog_ch1"] = 78.45; // Simulating temperature read
    txDoc["analog_ch1_mode"] = "4-20mA";
    txDoc["analog_ch2"] = 5.23;  // Simulating pressure read
    txDoc["analog_ch2_mode"] = "0-10V";
    
    txDoc["digital_in1"] = true;
    txDoc["digital_in2"] = false;
    txDoc["digital_out1"] = true; // Report current relay state
    
    String jsonOutput;
    serializeJson(txDoc, jsonOutput);
    
    int postResponse = http.POST(jsonOutput);
    if (postResponse == 201) {
      Serial.println("Telemetry successfully pushed to SQLite database.");
    }
    http.end();
  }
}

void loop() {
  pollConfiguration();
  delay(1000);
  postTelemetry();
  delay(15000); // Wait 15 seconds before next polling cycle
}`} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </AppLayout>
  );
};

export default ApiDocs;
