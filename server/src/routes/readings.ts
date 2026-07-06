import { Router, Request, Response } from "express";
import prisma from "../db.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { broadcast } from "../ws.js";

const router = Router();

// GET /api/device-readings - Fetch readings for a device
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { device_id, limit, order } = req.query;

  if (!device_id) {
    return res.status(400).json({ error: "device_id is required" });
  }

  try {
    // Verify device exists and check permissions
    const device = await prisma.device.findUnique({
      where: { id: String(device_id) },
    });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    // Permission check for non-admins
    if (
      req.user?.role !== "super_admin" &&
      req.user?.role !== "admin" &&
      device.owner_id !== req.user?.id
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    const takeLimit = limit ? Math.min(Number(limit), 1000) : 100;
    const sortOrder = order === "asc" ? "asc" : "desc";

    const readings = await prisma.deviceReading.findMany({
      where: { device_id: String(device_id) },
      orderBy: { created_at: sortOrder },
      take: takeLimit,
    });

    // If order was desc, reverse them to asc so they plot chronologically in charts
    if (sortOrder === "desc" && !limit) {
      readings.reverse();
    }

    return res.status(200).json(readings);
  } catch (err: any) {
    console.error("Fetch readings error:", err);
    return res.status(500).json({ error: "Failed to fetch readings" });
  }
});

// POST /api/device-readings - Insert new sensor readings
router.post("/", async (req: Request, res: Response) => {
  const {
    device_id,
    analog_ch1,
    analog_ch2,
    analog_ch3,
    analog_ch4,
    analog_ch1_mode,
    analog_ch2_mode,
    analog_ch3_mode,
    analog_ch4_mode,
    digital_in1,
    digital_in2,
    digital_in3,
    digital_in4,
    digital_out1,
    digital_out2,
    digital_out3,
    digital_out4,
    rtc_time,
  } = req.body;

  if (!device_id) {
    return res.status(400).json({ error: "device_id is required" });
  }

  try {
    // Verify device exists
    const device = await prisma.device.findUnique({ where: { id: device_id } });
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    const reading = await prisma.deviceReading.create({
      data: {
        device_id,
        analog_ch1: analog_ch1 !== undefined ? Number(analog_ch1) : 0.0,
        analog_ch2: analog_ch2 !== undefined ? Number(analog_ch2) : 0.0,
        analog_ch3: analog_ch3 !== undefined ? Number(analog_ch3) : 0.0,
        analog_ch4: analog_ch4 !== undefined ? Number(analog_ch4) : 0.0,
        analog_ch1_mode: analog_ch1_mode || "0-10V",
        analog_ch2_mode: analog_ch2_mode || "0-10V",
        analog_ch3_mode: analog_ch3_mode || "0-10V",
        analog_ch4_mode: analog_ch4_mode || "0-10V",
        digital_in1: digital_in1 !== undefined ? Boolean(digital_in1) : false,
        digital_in2: digital_in2 !== undefined ? Boolean(digital_in2) : false,
        digital_in3: digital_in3 !== undefined ? Boolean(digital_in3) : false,
        digital_in4: digital_in4 !== undefined ? Boolean(digital_in4) : false,
        digital_out1: digital_out1 !== undefined ? Boolean(digital_out1) : false,
        digital_out2: digital_out2 !== undefined ? Boolean(digital_out2) : false,
        digital_out3: digital_out3 !== undefined ? Boolean(digital_out3) : false,
        digital_out4: digital_out4 !== undefined ? Boolean(digital_out4) : false,
        rtc_time: rtc_time ? new Date(rtc_time) : new Date(),
      },
    });

    // Also update device's last_seen_at and set online to true
    await prisma.device.update({
      where: { id: device_id },
      data: {
        is_online: true,
        last_seen_at: new Date(),
      },
    });

    // Broadcast reading to device-specific topic e.g. "device-readings-uuid"
    broadcast(`device-readings-${device_id}`, "INSERT", reading);
    // Also broadcast updated device status
    const updatedDevice = await prisma.device.findUnique({ where: { id: device_id } });
    if (updatedDevice) {
      broadcast("devices", "UPDATE", updatedDevice);
    }

    return res.status(201).json({
      ...reading,
      wifi_max_disconnect_time: updatedDevice?.wifi_max_disconnect_time ?? 900,
      led_disabled: updatedDevice?.led_disabled ?? false
    });
  } catch (err: any) {
    console.error("Insert reading error:", err);
    return res.status(500).json({ error: "Failed to insert reading" });
  }
});

export default router;
