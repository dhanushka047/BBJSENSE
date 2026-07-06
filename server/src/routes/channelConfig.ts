import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../db.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const JWT_SECRET = process.env.JWT_SECRET || "bbjsense-default-secret-key-12345";

const router = Router();

// GET /api/device-channel-config - Fetch configs for a device
router.get("/", async (req: Request, res: Response) => {
  const { device_id } = req.query;

  if (!device_id) {
    return res.status(400).json({ error: "device_id is required" });
  }

  try {
    let device = await prisma.device.findUnique({
      where: { id: String(device_id) },
    });

    if (!device) {
      device = await prisma.device.create({
        data: {
          id: String(device_id),
          mac_address: "AUTO-" + String(device_id).substring(0, 8),
          name: "Provisioned Node " + String(device_id).substring(0, 4),
          approval_status: "approved",
          configs: {
            create: [
              { channel_type: "analog", channel_number: 1, label: "Analog Input 1", data_mode: "0-10V", min_value: 0, max_value: 10 },
              { channel_type: "analog", channel_number: 2, label: "Analog Input 2", data_mode: "0-10V", min_value: 0, max_value: 10 },
              { channel_type: "analog", channel_number: 3, label: "Analog Input 3", data_mode: "0-10V", min_value: 0, max_value: 10 },
              { channel_type: "analog", channel_number: 4, label: "Analog Input 4", data_mode: "0-10V", min_value: 0, max_value: 10 }
            ]
          }
        }
      });
      console.log(`[AUTO-PROVISION] Auto-created device ${device_id} in SQLite.`);
    }

    const authHeader = req.headers["authorization"];
    if (authHeader) {
      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "Access token required" });
      }
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (
          decoded.role !== "super_admin" &&
          decoded.role !== "admin" &&
          device.owner_id !== decoded.id
        ) {
          return res.status(403).json({ error: "Access denied" });
        }
      } catch (err) {
        return res.status(403).json({ error: "Invalid or expired token" });
      }
    }

    const configs = await prisma.deviceChannelConfig.findMany({
      where: { device_id: String(device_id) },
    });

    return res.status(200).json(configs);
  } catch (err: any) {
    console.error("Fetch configs error:", err);
    return res.status(500).json({ error: "Failed to fetch channel configurations" });
  }
});

// POST /api/device-channel-config/batch - Batch upsert configs for a device
router.post("/batch", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { device_id, configs } = req.body;

  if (!device_id || !Array.isArray(configs)) {
    return res.status(400).json({ error: "device_id and configs array are required" });
  }

  try {
    const device = await prisma.device.findUnique({
      where: { id: device_id },
    });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (
      req.user?.role !== "super_admin" &&
      req.user?.role !== "admin" &&
      device.owner_id !== req.user?.id
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Upsert each channel configuration inside a transaction
    const upsertedConfigs = await prisma.$transaction(
      configs.map((cfg) => {
        const uniqueInput = {
          device_id_channel_type_channel_number: {
            device_id,
            channel_type: cfg.channel_type,
            channel_number: Number(cfg.channel_number),
          },
        };

        const data = {
          label: cfg.label || "",
          data_mode: cfg.data_mode || "0-10V",
          unit: cfg.unit || "",
          min_value: cfg.min_value !== undefined ? Number(cfg.min_value) : 0,
          max_value: cfg.max_value !== undefined ? Number(cfg.max_value) : 10,
        };

        return prisma.deviceChannelConfig.upsert({
          where: uniqueInput,
          create: {
            device_id,
            channel_type: cfg.channel_type,
            channel_number: Number(cfg.channel_number),
            ...data,
          },
          update: data,
        });
      })
    );

    return res.status(200).json(upsertedConfigs);
  } catch (err: any) {
    console.error("Batch upsert configs error:", err);
    return res.status(500).json({ error: "Failed to update channel configurations" });
  }
});

export default router;
