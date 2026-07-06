import { Router, Response } from "express";
import prisma from "../db.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { broadcast } from "../ws.js";

const router = Router();

// GET /api/devices - Get all devices (filtered)
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { approval_status, owner_id } = req.query;

  try {
    const whereClause: any = {};

    if (approval_status) {
      whereClause.approval_status = String(approval_status);
    }

    // Role-based restrictions
    if (req.user?.role !== "super_admin" && req.user?.role !== "admin") {
      // Regular users can only see their own devices
      whereClause.owner_id = req.user?.id;
    } else if (owner_id) {
      // Admins can filter by owner_id if requested
      whereClause.owner_id = String(owner_id);
    }

    const devices = await prisma.device.findMany({
      where: whereClause,
      orderBy: { created_at: "desc" },
    });

    return res.status(200).json(devices);
  } catch (err: any) {
    console.error("Fetch devices error:", err);
    return res.status(500).json({ error: "Failed to fetch devices" });
  }
});

// GET /api/devices/:id - Get device by id
router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const device = await prisma.device.findUnique({
      where: { id },
    });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    // Check ownership for regular users
    if (
      req.user?.role !== "super_admin" &&
      req.user?.role !== "admin" &&
      device.owner_id !== req.user?.id
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.status(200).json(device);
  } catch (err: any) {
    console.error("Fetch device error:", err);
    return res.status(500).json({ error: "Failed to fetch device" });
  }
});

// POST /api/devices - Register new device
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { mac_address, name, nickname, modbus_address, wifi_max_disconnect_time, led_disabled } = req.body;

  if (!mac_address) {
    return res.status(400).json({ error: "MAC address is required" });
  }

  try {
    // Check if MAC is already registered
    const existing = await prisma.device.findUnique({ where: { mac_address } });
    if (existing) {
      return res.status(400).json({ error: "A device with this MAC address is already registered" });
    }

    const device = await prisma.device.create({
      data: {
        mac_address,
        name: name || "New Device",
        nickname: nickname || "",
        owner_id: req.user?.id,
        modbus_address: modbus_address || "0x01",
        wifi_max_disconnect_time: wifi_max_disconnect_time !== undefined ? Number(wifi_max_disconnect_time) : 900,
        led_disabled: led_disabled !== undefined ? Boolean(led_disabled) : false,
        approval_status: "pending", // Requires admin approval
      },
    });

    // Broadcast insert to all subscribers
    broadcast("devices", "INSERT", device);

    return res.status(201).json(device);
  } catch (err: any) {
    console.error("Register device error:", err);
    return res.status(500).json({ error: "Failed to register device" });
  }
});

// PUT /api/devices/:id - Update device
router.put("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, nickname, is_online, approval_status, modbus_address, last_seen_at, wifi_max_disconnect_time, led_disabled } = req.body;

  try {
    const existing = await prisma.device.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Device not found" });
    }

    const isAdmin = req.user?.role === "super_admin" || req.user?.role === "admin";
    const isOwner = existing.owner_id === req.user?.id;

    // Regular users can only update their own devices, and cannot change approval status
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (nickname !== undefined) updateData.nickname = nickname;
    if (modbus_address !== undefined) updateData.modbus_address = modbus_address;
    if (is_online !== undefined) updateData.is_online = Boolean(is_online);
    if (last_seen_at !== undefined) updateData.last_seen_at = new Date(last_seen_at);
    if (wifi_max_disconnect_time !== undefined) updateData.wifi_max_disconnect_time = Number(wifi_max_disconnect_time);
    if (led_disabled !== undefined) updateData.led_disabled = Boolean(led_disabled);

    // Only admins can approve/reject
    if (approval_status !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({ error: "Only administrators can approve or reject devices" });
      }
      updateData.approval_status = approval_status;
      if (approval_status === "approved") {
        updateData.approved_by = req.user?.id;
      }
    }

    const updatedDevice = await prisma.device.update({
      where: { id },
      data: updateData,
    });

    // Broadcast update to all subscribers
    broadcast("devices", "UPDATE", updatedDevice);

    return res.status(200).json(updatedDevice);
  } catch (err: any) {
    console.error("Update device error:", err);
    return res.status(500).json({ error: "Failed to update device" });
  }
});

// DELETE /api/devices/:id - Delete device
router.delete("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const existing = await prisma.device.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Device not found" });
    }

    const isAdmin = req.user?.role === "super_admin" || req.user?.role === "admin";
    const isOwner = existing.owner_id === req.user?.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "Access denied" });
    }

    await prisma.device.delete({ where: { id } });

    // Broadcast deletion to all subscribers
    broadcast("devices", "DELETE", { id });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("Delete device error:", err);
    return res.status(500).json({ error: "Failed to delete device" });
  }
});

export default router;
