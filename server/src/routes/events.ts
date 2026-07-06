import { Router, Request, Response } from "express";
import prisma from "../db.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { broadcast } from "../ws.js";

const router = Router();

// GET /api/device-events - Fetch events
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { device_id, event_type, limit } = req.query;

  try {
    const whereClause: any = {};

    if (event_type) {
      whereClause.event_type = String(event_type);
    }

    if (device_id) {
      whereClause.device_id = String(device_id);
    }

    // Role-based restrictions
    if (req.user?.role !== "super_admin" && req.user?.role !== "admin") {
      // Regular users can only see events for devices they own
      if (device_id) {
        // Verify ownership
        const device = await prisma.device.findUnique({ where: { id: String(device_id) } });
        if (!device || device.owner_id !== req.user?.id) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else {
        // Find all devices owned by user and filter events by those devices
        const ownedDevices = await prisma.device.findMany({
          where: { owner_id: req.user?.id },
          select: { id: true },
        });
        const ownedIds = ownedDevices.map((d) => d.id);
        whereClause.device_id = { in: ownedIds };
      }
    }

    const takeLimit = limit ? Math.min(Number(limit), 500) : 50;

    const events = await prisma.deviceEvent.findMany({
      where: whereClause,
      orderBy: { created_at: "desc" },
      take: takeLimit,
      include: {
        trigger: {
          select: {
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json(events);
  } catch (err: any) {
    console.error("Fetch events error:", err);
    return res.status(500).json({ error: "Failed to fetch events" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  const { device_id, event_type, message } = req.body;
  const user = (req as any).user;

  if (!device_id || !message) {
    return res.status(400).json({ error: "device_id and message are required" });
  }

  try {
    // Verify device exists
    let device = await prisma.device.findUnique({ where: { id: device_id } });
    if (!device) {
      device = await prisma.device.create({
        data: {
          id: device_id,
          mac_address: "AUTO-" + device_id.substring(0, 8),
          name: "Provisioned Node " + device_id.substring(0, 4),
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
      console.log(`[AUTO-PROVISION] Auto-created device ${device_id} during event post.`);
    }

    // Regular users can only trigger events for devices they own (if authenticated request)
    if (user) {
      if (
        user.role !== "super_admin" &&
        user.role !== "admin" &&
        device.owner_id !== user.id
      ) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    const event = await prisma.deviceEvent.create({
      data: {
        device_id,
        event_type: event_type || "info",
        message,
        triggered_by: req.user?.id,
      },
      include: {
        trigger: {
          select: {
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });

    // Broadcast event to specific device topic: "device-events-uuid"
    broadcast(`device-events-${device_id}`, "INSERT", event);

    return res.status(201).json(event);
  } catch (err: any) {
    console.error("Create event error:", err);
    return res.status(500).json({ error: "Failed to create event" });
  }
});

export default router;
