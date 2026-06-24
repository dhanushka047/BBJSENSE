import express from "express";
import cors from "cors";
import http from "http";
import dotenv from "dotenv";
import { initWebSocket } from "./ws.js";

// Import routers
import authRouter from "./routes/auth.js";
import profilesRouter from "./routes/profiles.js";
import devicesRouter from "./routes/devices.js";
import readingsRouter from "./routes/readings.js";
import eventsRouter from "./routes/events.js";
import channelConfigRouter from "./routes/channelConfig.js";
import modbusRouter from "./routes/modbus.js";
import backupRouter from "./routes/backup.js";
import settingsRouter from "./routes/settings.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
// Set JSON payload limits high enough for database backups
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Log requests
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api/devices", devicesRouter);
app.use("/api/device-readings", readingsRouter);
app.use("/api/device-events", eventsRouter);
app.use("/api/device-channel-config", channelConfigRouter);
app.use("/api/modbus", modbusRouter);
app.use("/api/backup", backupRouter);
app.use("/api/settings", settingsRouter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[ERROR]", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
initWebSocket(server);

// Start server
server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 BBJSENSE Backend Server Active`);
  console.log(`➜  Local:   http://localhost:${PORT}/`);
  console.log(`➜  WS:      ws://localhost:${PORT}/ws`);
  console.log(`=================================`);
});
