import { motion } from "framer-motion";
import { Copy, Check, Code, Database, Wifi, Send, Shield, Settings, Info, Terminal, ChevronRight, Server } from "lucide-react";
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
    <div className="relative group flex-1 flex flex-col min-h-0">
      <pre className="bg-slate-950 text-slate-100 rounded-xl p-4 overflow-x-auto text-[11px] font-mono border border-border/35 flex-1 min-h-0 max-h-[500px] scrollbar-thin leading-relaxed">
        <code>{code}</code>
      </pre>
      <button onClick={handleCopy} className="absolute top-3 right-3 p-1.5 rounded-md bg-slate-800/85 border border-slate-700/55 text-slate-400 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function EndpointSection({ method, path, description, requestBody, responseBody, paramsTable, auth = true }: {
  method: "POST" | "GET" | "PUT" | "DELETE";
  path: string;
  description: string;
  requestBody?: string;
  responseBody?: string;
  paramsTable?: Array<{ name: string; type: string; desc: string; req: boolean }>;
  auth?: boolean;
}) {
  const methodColors: Record<string, string> = {
    POST: "bg-primary/10 text-primary border border-primary/25",
    GET: "bg-success/10 text-success border border-success/25",
    PUT: "bg-warning/10 text-warning border border-warning/25",
    DELETE: "bg-destructive/10 text-destructive border border-destructive/25",
  };

  const [activeTab, setActiveTab] = useState<"request" | "response">("request");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 border-b border-border/40 pb-10 last:border-0 last:pb-0">
      {/* Left Column: Documentation */}
      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`font-mono text-[10px] font-bold border rounded-md px-2.5 py-0.5 ${methodColors[method]}`}>
            {method}
          </span>
          <code className="text-xs font-mono text-foreground bg-muted/50 px-2 py-0.5 rounded border border-border/30">
            {path}
          </code>
          {auth && (
            <Badge variant="outline" className="text-[10px] gap-1 font-semibold border-border/70 text-muted-foreground bg-background/50">
              <Shield size={10} /> Auth Required
            </Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>

        {paramsTable && paramsTable.length > 0 && (
          <div className="space-y-2 pt-2">
            <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
              <Terminal size={11} className="text-primary" /> Payload Schema Parameters
            </h4>
            <div className="border border-border/40 rounded-xl overflow-hidden bg-muted/5">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/20 border-b border-border/35">
                    <th className="py-2.5 px-3 font-semibold text-muted-foreground w-1/3">Parameter</th>
                    <th className="py-2.5 px-3 font-semibold text-muted-foreground w-1/4">Type</th>
                    <th className="py-2.5 px-3 font-semibold text-muted-foreground">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {paramsTable.map((p, i) => (
                    <tr key={i} className="hover:bg-muted/5 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                        <div className="flex items-center gap-1.5">
                          {p.name}
                          {p.req && (
                            <span className="text-[8px] text-destructive font-semibold uppercase bg-destructive/5 px-1 rounded border border-destructive/10">
                              required
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-primary/85 text-[10.5px]">{p.type}</td>
                      <td className="py-2.5 px-3 text-muted-foreground leading-normal">{p.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Interactive Code Viewer */}
      <div className="lg:col-span-2 flex flex-col justify-start">
        <div className="bg-slate-900 border border-border/50 rounded-xl shadow-md overflow-hidden flex flex-col h-full min-h-[250px]">
          <div className="bg-slate-950 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between">
            <div className="flex gap-2">
              {requestBody && (
                <button
                  onClick={() => setActiveTab("request")}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
                    activeTab === "request" ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  JSON Request
                </button>
              )}
              {responseBody && (
                <button
                  onClick={() => setActiveTab("response")}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
                    activeTab === "response" || !requestBody ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  JSON Response
                </button>
              )}
            </div>
            <span className="text-[9px] font-mono text-slate-500 tracking-wider">application/json</span>
          </div>
          <div className="p-3 flex-1 bg-slate-900/40 flex flex-col justify-stretch">
            {activeTab === "request" && requestBody ? (
              <CodeBlock code={requestBody} />
            ) : (
              responseBody && <CodeBlock code={responseBody} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const ApiDocs = () => {
  const baseUrl = `http://localhost:5001/api`;

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6 w-full">
        {/* Header Title Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-md">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Code size={24} className="text-primary" /> Developer API & Docs
              </h1>
              <p className="text-sm text-muted-foreground">
                Node.js Express backend integration schemas, SQLite/MySQL models, and ESP32 gateway setup guides
              </p>
            </div>
            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 shrink-0 self-start md:self-auto">
              <Server size={16} className="text-primary" />
              <div className="text-xs">
                <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-wider">Endpoint Base URL</span>
                <code className="font-mono font-bold text-foreground">{baseUrl}</code>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="ingestion" className="space-y-6">
          <TabsList className="bg-muted/40 p-1 rounded-xl flex-wrap h-auto gap-1 border border-border/30">
            <TabsTrigger value="ingestion" className="rounded-lg text-xs font-semibold py-2 px-3"><Send size={13} className="mr-1.5" /> Ingest Telemetry</TabsTrigger>
            <TabsTrigger value="config" className="rounded-lg text-xs font-semibold py-2 px-3"><Settings size={13} className="mr-1.5" /> Configuration Sync</TabsTrigger>
            <TabsTrigger value="schema" className="rounded-lg text-xs font-semibold py-2 px-3"><Database size={13} className="mr-1.5" /> DB Schema</TabsTrigger>
            <TabsTrigger value="packet" className="rounded-lg text-xs font-semibold py-2 px-3"><Code size={13} className="mr-1.5" /> JSON Reference</TabsTrigger>
            <TabsTrigger value="esp32" className="rounded-lg text-xs font-semibold py-2 px-3"><Wifi size={13} className="mr-1.5" /> ESP32-S3 Setup</TabsTrigger>
          </TabsList>

          {/* Ingest Telemetry Tab Content */}
          <TabsContent value="ingestion" className="space-y-6 focus-visible:outline-none">
            <Card className="border border-border bg-card shadow-sm">
              <CardHeader className="pb-4 border-b border-border/40">
                <CardTitle className="text-base flex items-center gap-2">
                  <Send size={18} className="text-primary" /> Sensor Telemetry Ingestion Pipeline
                </CardTitle>
                <CardDescription>
                  Documented endpoints for ingesting raw sensor readings, digital statuses, and diagnostic event logs from edge nodes.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-12">
                <EndpointSection
                  method="POST"
                  path="/device-readings"
                  description="Sends sensor telemetry values from a registered edge gateway node. The system updates the device's online status, saves the reading parameters to the SQLite database, and instantly broadcasts the data to all active monitoring consoles via WebSockets."
                  auth={false}
                  paramsTable={[
                    { name: "device_id", type: "String", desc: "Unique UUID identifier of the registered hardware node.", req: true },
                    { name: "analog_ch1", type: "Float", desc: "Raw floating-point measurement value for Analog Channel 1.", req: false },
                    { name: "analog_ch1_mode", type: "String", desc: "Measurement range calibration: '4-20mA' or '0-10V'.", req: false },
                    { name: "analog_ch2", type: "Float", desc: "Raw floating-point measurement value for Analog Channel 2.", req: false },
                    { name: "analog_ch2_mode", type: "String", desc: "Measurement range calibration: '4-20mA' or '0-10V'.", req: false },
                    { name: "analog_ch3", type: "Float", desc: "Raw floating-point measurement value for Analog Channel 3.", req: false },
                    { name: "analog_ch3_mode", type: "String", desc: "Measurement range calibration: '4-20mA' or '0-10V'.", req: false },
                    { name: "analog_ch4", type: "Float", desc: "Raw floating-point measurement value for Analog Channel 4.", req: false },
                    { name: "analog_ch4_mode", type: "String", desc: "Measurement range calibration: '4-20mA' or '0-10V'.", req: false },
                    { name: "digital_in1", type: "Boolean", desc: "Binary status of Digital Input 1 (HIGH = true, LOW = false).", req: false },
                    { name: "digital_in2", type: "Boolean", desc: "Binary status of Digital Input 2 (HIGH = true, LOW = false).", req: false },
                    { name: "digital_in3", type: "Boolean", desc: "Binary status of Digital Input 3 (HIGH = true, LOW = false).", req: false },
                    { name: "digital_in4", type: "Boolean", desc: "Binary status of Digital Input 4 (HIGH = true, LOW = false).", req: false },
                    { name: "digital_out1", type: "Boolean", desc: "Relay status of Digital Output 1 (ON = true, OFF = false).", req: false },
                    { name: "digital_out2", type: "Boolean", desc: "Relay status of Digital Output 2 (ON = true, OFF = false).", req: false },
                    { name: "digital_out3", type: "Boolean", desc: "Relay status of Digital Output 3 (ON = true, OFF = false).", req: false },
                    { name: "digital_out4", type: "Boolean", desc: "Relay status of Digital Output 4 (ON = true, OFF = false).", req: false },
                    { name: "rtc_time", type: "String", desc: "ISO 8601 timestamp generated from the gateway board's local RTC chip.", req: false }
                  ]}
                  requestBody={`{
  "device_id": "8fbbf427-68a4-480a-8e5c-57922ef8a75a",
  "analog_ch1": 75.1,
  "analog_ch1_mode": "4-20mA",
  "analog_ch2": 7.7,
  "analog_ch2_mode": "0-10V",
  "analog_ch3": 46.4,
  "analog_ch3_mode": "0-10V",
  "analog_ch4": 23.6,
  "analog_ch4_mode": "0-10V",
  "digital_in1": true,
  "digital_in2": false,
  "digital_in3": false,
  "digital_in4": false,
  "digital_out1": true,
  "digital_out2": false,
  "digital_out3": false,
  "digital_out4": false,
  "rtc_time": "2026-06-24T13:46:12Z"
}`}
                  responseBody={`{
  "id": "ecca449b-6681-4ce3-8178-68288792a161",
  "device_id": "8fbbf427-68a4-480a-8e5c-57922ef8a75a",
  "analog_ch1": 75.1,
  "analog_ch1_mode": "4-20mA",
  "analog_ch2": 7.7,
  "analog_ch2_mode": "0-10V",
  "analog_ch3": 46.4,
  "analog_ch3_mode": "0-10V",
  "analog_ch4": 23.6,
  "analog_ch4_mode": "0-10V",
  "digital_in1": true,
  "digital_in2": false,
  "digital_in3": false,
  "digital_in4": false,
  "digital_out1": true,
  "digital_out2": false,
  "digital_out3": false,
  "digital_out4": false,
  "rtc_time": "2026-06-24T13:46:12.000Z",
  "created_at": "2026-06-24T08:16:15.122Z"
}`}
                />

                <EndpointSection
                  method="POST"
                  path="/device-events"
                  description="Logs diagnostic events, anomalies, threshold notifications, or hardware control records. Events logged are saved in the events timeline database and broadcasted in real-time to dashboard subscribers."
                  auth={true}
                  paramsTable={[
                    { name: "device_id", type: "String", desc: "Unique UUID identifier of the source gateway hardware.", req: true },
                    { name: "event_type", type: "String", desc: "Event severity / classification: 'info', 'control', 'alert', or 'critical'.", req: true },
                    { name: "message", type: "String", desc: "Narrative description detailing the anomaly, alarm, or trigger description.", req: true }
                  ]}
                  requestBody={`{
  "device_id": "8fbbf427-68a4-480a-8e5c-57922ef8a75a",
  "event_type": "alert",
  "message": "Boiler temperature critical threshold exceeded! Reading: 75.1 °C (Max Limit: 75.0 °C)"
}`}
                  responseBody={`{
  "id": "383eb04e-9914-434b-bb6a-2cee20c1efca",
  "device_id": "8fbbf427-68a4-480a-8e5c-57922ef8a75a",
  "event_type": "alert",
  "message": "Boiler temperature critical threshold exceeded! Reading: 75.1 °C (Max Limit: 75.0 °C)",
  "triggered_by": "user-uuid-1111",
  "created_at": "2026-06-24T08:16:20.450Z"
}`}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configuration Sync Tab Content */}
          <TabsContent value="config" className="space-y-6 focus-visible:outline-none">
            <Card className="border border-border bg-card shadow-sm">
              <CardHeader className="pb-4 border-b border-border/40">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings size={18} className="text-primary" /> Gateway Configuration Synchronization
                </CardTitle>
                <CardDescription>
                  Endpoints used by edge nodes to download remote settings, channel calibrations, and register new nodes.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-12">
                <EndpointSection
                  method="GET"
                  path="/device-channel-config"
                  description="Retrieves active channel mappings, labels, units, and custom measurement bounds configured by administrators in the control console. Used by the ESP32 node to dynamically re-range its local ADC scaling algorithms."
                  auth={true}
                  paramsTable={[
                    { name: "device_id", type: "Query String", desc: "The UUID of the gateway board to pull configs for.", req: true }
                  ]}
                  responseBody={`[
  {
    "id": "cfg-uuid-1111",
    "device_id": "8fbbf427-68a4-480a-8e5c-57922ef8a75a",
    "channel_type": "analog",
    "channel_number": 1,
    "label": "Main Boiler Temp",
    "data_mode": "4-20mA",
    "unit": "mA",
    "min_value": 4.0,
    "max_value": 20.0,
    "created_at": "2026-06-24T08:00:00.000Z",
    "updated_at": "2026-06-24T08:15:32.000Z"
  },
  {
    "id": "cfg-uuid-2222",
    "device_id": "8fbbf427-68a4-480a-8e5c-57922ef8a75a",
    "channel_type": "digital_out",
    "channel_number": 1,
    "label": "Primary Extractor Fan",
    "data_mode": "binary",
    "unit": "",
    "min_value": 0,
    "max_value": 1,
    "created_at": "2026-06-24T08:00:00.000Z",
    "updated_at": "2026-06-24T08:15:40.000Z"
  }
]`}
                />

                <EndpointSection
                  method="POST"
                  path="/devices"
                  description="Registers a new hardware gateway node under the authenticated user. New nodes default to 'pending' state and must be approved by an administrator before transmitting data."
                  auth={true}
                  paramsTable={[
                    { name: "mac_address", type: "String", desc: "Hardware MAC Address of the physical microcontroller.", req: true },
                    { name: "name", type: "String", desc: "Descriptive name for system routing, e.g. Gateway Node D.", req: true },
                    { name: "nickname", type: "String", desc: "Human-friendly label, e.g., Assembly Line 4 Controller.", req: false },
                    { name: "modbus_address", type: "String", desc: "Industrial Modbus Slave RTU address, e.g. 0x04.", req: false }
                  ]}
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
  "created_at": "2026-06-24T08:16:30.000Z",
  "updated_at": "2026-06-24T08:16:30.000Z"
}`}
                />

                <Card className="border border-border/60 bg-muted/10">
                  <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border/30">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Info size={13} className="text-primary" /> Sync Pipeline Workflow Architecture
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 text-xs text-muted-foreground space-y-3 leading-relaxed font-sans">
                    <p className="flex items-start gap-2">
                      <ChevronRight size={13} className="text-primary shrink-0 mt-0.5" />
                      <span><strong>1. Console Modifications:</strong> An administrator logs in and adjusts labels, calibration coefficients, scaling methods (0-10V / 4-20mA), or Modbus registers in the settings panel.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <ChevronRight size={13} className="text-primary shrink-0 mt-0.5" />
                      <span><strong>2. DB Storage:</strong> The frontend makes REST calls to the Node.js Express API, committing updates immediately into the relational SQLite/MySQL tables.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <ChevronRight size={13} className="text-primary shrink-0 mt-0.5" />
                      <span><strong>3. Edge Polling:</strong> The physical ESP32 gateway polls the <code className="bg-background/80 px-1 py-0.5 rounded font-mono text-[10px]">GET /api/device-channel-config</code> endpoint on a configured interval (every 10s-30s).</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <ChevronRight size={13} className="text-primary shrink-0 mt-0.5" />
                      <span><strong>4. Microcontroller Scaling:</strong> The ESP32 decodes the JSON payload, dynamically remaps its local memory and scaling limits, updates relay outputs, and applies scaling coefficients to raw ADC readings.</span>
                    </p>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Database Schema Tab Content */}
          <TabsContent value="schema" className="space-y-6 focus-visible:outline-none">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card className="border border-border bg-card shadow-sm">
                <CardHeader className="pb-3 border-b border-border/40">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Database size={16} className="text-primary" />
                    <CardTitle className="text-sm">Device Readings Schema</CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Prisma ORM structure storing analog inputs, digital inputs, digital outputs, and timestamps.
                  </CardDescription>
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
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Settings size={16} className="text-primary" />
                    <CardTitle className="text-sm">Channel Configuration Schema</CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Stores labels, active measuring modes, coefficients, and physical units per input/output pin.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <CodeBlock code={`model DeviceChannelConfig {
  id             String   @id @default(uuid())
  device_id      String
  channel_type   String   // 'analog', 'digital_in', 'digital_out'
  channel_number Int
  label          String   @default("")
  data_mode      String?  @default("0-10V") // '0-10V' or '4-20mA'
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
            </div>
          </TabsContent>

          {/* JSON Reference Tab Content */}
          <TabsContent value="packet" className="space-y-6 focus-visible:outline-none">
            <Card className="border border-border bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Code size={18} className="text-primary" />
                  <CardTitle className="text-sm">Unified Telemetry Ingestion Payload Specification</CardTitle>
                </div>
                <CardDescription>
                  Reference schema detailing structural models, parameter validation ranges, and complete payload formats.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <CodeBlock code={`{
  "$schema": "BBJSENSE Data Payload Specification v1.1",
  "device_id": "8fbbf427-68a4-480a-8e5c-57922ef8a75a",
  "analog_ch1": 75.1,
  "analog_ch1_mode": "4-20mA",
  "analog_ch2": 7.7,
  "analog_ch2_mode": "0-10V",
  "analog_ch3": 46.4,
  "analog_ch3_mode": "0-10V",
  "analog_ch4": 23.6,
  "analog_ch4_mode": "0-10V",
  "digital_in1": true,
  "digital_in2": false,
  "digital_in3": false,
  "digital_in4": false,
  "digital_out1": true,
  "digital_out2": false,
  "digital_out3": false,
  "digital_out4": false,
  "rtc_time": "2026-06-24T13:46:12Z"
}`} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ESP32-S3 Setup Tab Content */}
          <TabsContent value="esp32" className="space-y-6 focus-visible:outline-none">
            <Card className="border border-border bg-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Wifi size={18} className="text-primary" />
                  <CardTitle className="text-sm">Arduino C++ HTTP Integration Example (ESP32-S3 / ESP32)</CardTitle>
                </div>
                <CardDescription>
                  Plug-and-play code template for gateway microcontrollers to poll configurations and transmit real-time telemetry.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <CodeBlock code={`#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "Factory_Boiler_Room_SSID";
const char* WIFI_PASS = "FactorySecurePassword123";
// Replace with your active backend Express server IP address and Port
const char* API_BASE_URL = "http://192.168.1.100:5001/api"; 
const char* DEVICE_UUID = "8fbbf427-68a4-480a-8e5c-57922ef8a75a";

void setup() {
  Serial.begin(115200);
  pinMode(5, OUTPUT); // Relay Output DO1 (e.g. status LED or valve switch)
  
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
    
    // GET remote channel configurations
    String fetchUrl = String(API_BASE_URL) + "/device-channel-config?device_id=" + DEVICE_UUID;
    http.begin(fetchUrl);
    
    int httpResponseCode = http.GET();
    if (httpResponseCode == 200) {
      String payload = http.getString();
      DynamicJsonDocument doc(2048);
      deserializeJson(doc, payload);
      
      // Parse settings and apply local settings / relay configs
      JsonArray arr = doc.as<JsonArray>();
      for (JsonObject obj : arr) {
        const char* type = obj["channel_type"];
        int num = obj["channel_number"];
        const char* label = obj["label"];
        
        Serial.printf("Config sync: CH %d (%s) - Label: %s\\n", num, type, label);
      }
    }
    http.end();
  }
}

void postTelemetry() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    // POST raw and calculated telemetry readings
    String postUrl = String(API_BASE_URL) + "/device-readings";
    http.begin(postUrl);
    http.addHeader("Content-Type", "application/json");
    
    DynamicJsonDocument txDoc(1024);
    txDoc["device_id"] = DEVICE_UUID;
    txDoc["analog_ch1"] = 75.10; // Read from thermal probe
    txDoc["analog_ch1_mode"] = "4-20mA";
    txDoc["analog_ch2"] = 7.70;  // Read from pressure transducer
    txDoc["analog_ch2_mode"] = "0-10V";
    txDoc["analog_ch3"] = 46.40; // Read from flow meter
    txDoc["analog_ch3_mode"] = "0-10V";
    txDoc["analog_ch4"] = 23.60; // Read from auxiliary channel
    txDoc["analog_ch4_mode"] = "0-10V";
    
    txDoc["digital_in1"] = true; // Safety switch status
    txDoc["digital_in2"] = false;
    txDoc["digital_out1"] = true; // Report active actuator status
    txDoc["digital_out2"] = false;
    
    String jsonOutput;
    serializeJson(txDoc, jsonOutput);
    
    int postResponse = http.POST(jsonOutput);
    if (postResponse == 201) {
      Serial.println("Telemetry successfully transmitted to database.");
    } else {
      Serial.printf("Error transmitting telemetry: %d\\n", postResponse);
    }
    http.end();
  }
}

void loop() {
  pollConfiguration();
  delay(1000);
  postTelemetry();
  delay(15000); // 15s sampling/polling loop
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
