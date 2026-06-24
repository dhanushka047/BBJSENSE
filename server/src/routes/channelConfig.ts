import { Router, Response } from "express";
import prisma from "../db.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/device-channel-config - Fetch configs for a device
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { device_id } = req.query;

  if (!device_id) {
    return res.status(400).json({ error: "device_id is required" });
  }

  try {
    const device = await prisma.device.findUnique({
      where: { id: String(device_id) },
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
