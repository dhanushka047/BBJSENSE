import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../db.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { broadcast } from "../ws.js";

const JWT_SECRET = process.env.JWT_SECRET || "bbjsense-default-secret-key-12345";

const router = Router();

// ── Modbus Devices Endpoints ──────────────────────────────────────────────────

// GET /api/modbus/devices - List modbus devices for a gateway
router.get("/devices", async (req: Request, res: Response) => {
  const { device_id } = req.query;

  if (!device_id) {
    return res.status(400).json({ error: "device_id is required" });
  }

  try {
    // Permission check
    const device = await prisma.device.findUnique({ where: { id: String(device_id) } });
    if (!device) {
      return res.status(404).json({ error: "Gateway device not found" });
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

    const modbusDevices = await prisma.modbusDevice.findMany({
      where: { device_id: String(device_id) },
      orderBy: { created_at: "desc" },
    });

    return res.status(200).json(modbusDevices);
  } catch (err: any) {
    console.error("Fetch modbus devices error:", err);
    return res.status(500).json({ error: "Failed to fetch Modbus devices" });
  }
});

// POST /api/modbus/devices - Create modbus slave device
router.post("/devices", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { device_id, name, manufacturer, slave_id, baud_rate, parity, stop_bits, data_bits } = req.body;

  if (!device_id || !name) {
    return res.status(400).json({ error: "device_id and name are required" });
  }

  try {
    // Permission check
    const device = await prisma.device.findUnique({ where: { id: device_id } });
    if (!device) {
      return res.status(404).json({ error: "Gateway device not found" });
    }

    if (
      req.user?.role !== "super_admin" &&
      req.user?.role !== "admin" &&
      device.owner_id !== req.user?.id
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    const modbusDevice = await prisma.modbusDevice.create({
      data: {
        device_id,
        name,
        manufacturer: manufacturer || "",
        slave_id: slave_id !== undefined ? Number(slave_id) : 1,
        baud_rate: baud_rate !== undefined ? Number(baud_rate) : 9600,
        parity: parity || "none",
        stop_bits: stop_bits !== undefined ? Number(stop_bits) : 1,
        data_bits: data_bits !== undefined ? Number(data_bits) : 8,
      },
    });

    broadcast("modbus_devices", "INSERT", modbusDevice);

    return res.status(201).json(modbusDevice);
  } catch (err: any) {
    console.error("Create modbus device error:", err);
    return res.status(500).json({ error: "Failed to create Modbus device" });
  }
});

// PUT /api/modbus/devices/:id - Update modbus device
router.put("/devices/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, manufacturer, slave_id, baud_rate, parity, stop_bits, data_bits } = req.body;

  try {
    const existing = await prisma.modbusDevice.findUnique({
      where: { id },
      include: { device: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Modbus device not found" });
    }

    // Permission check
    if (
      req.user?.role !== "super_admin" &&
      req.user?.role !== "admin" &&
      existing.device.owner_id !== req.user?.id
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (manufacturer !== undefined) updateData.manufacturer = manufacturer;
    if (slave_id !== undefined) updateData.slave_id = Number(slave_id);
    if (baud_rate !== undefined) updateData.baud_rate = Number(baud_rate);
    if (parity !== undefined) updateData.parity = parity;
    if (stop_bits !== undefined) updateData.stop_bits = Number(stop_bits);
    if (data_bits !== undefined) updateData.data_bits = Number(data_bits);

    const updated = await prisma.modbusDevice.update({
      where: { id },
      data: updateData,
    });

    broadcast("modbus_devices", "UPDATE", updated);

    return res.status(200).json(updated);
  } catch (err: any) {
    console.error("Update modbus device error:", err);
    return res.status(500).json({ error: "Failed to update Modbus device" });
  }
});

// DELETE /api/modbus/devices/:id - Delete modbus device
router.delete("/devices/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const existing = await prisma.modbusDevice.findUnique({
      where: { id },
      include: { device: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Modbus device not found" });
    }

    // Permission check
    if (
      req.user?.role !== "super_admin" &&
      req.user?.role !== "admin" &&
      existing.device.owner_id !== req.user?.id
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    await prisma.modbusDevice.delete({ where: { id } });

    broadcast("modbus_devices", "DELETE", { id });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("Delete modbus device error:", err);
    return res.status(500).json({ error: "Failed to delete Modbus device" });
  }
});

// ── Modbus Registers Endpoints ────────────────────────────────────────────────

// GET /api/modbus/registers - Get registers for a modbus device
router.get("/registers", async (req: Request, res: Response) => {
  const { modbus_device_id } = req.query;

  if (!modbus_device_id) {
    return res.status(400).json({ error: "modbus_device_id is required" });
  }

  try {
    const modbusDev = await prisma.modbusDevice.findUnique({
      where: { id: String(modbus_device_id) },
      include: { device: true },
    });

    if (!modbusDev) {
      return res.status(404).json({ error: "Modbus device not found" });
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
          modbusDev.device.owner_id !== decoded.id
        ) {
          return res.status(403).json({ error: "Access denied" });
        }
      } catch (err) {
        return res.status(403).json({ error: "Invalid or expired token" });
      }
    }

    const registers = await prisma.modbusRegister.findMany({
      where: { modbus_device_id: String(modbus_device_id) },
      orderBy: { display_order: "asc" },
    });

    return res.status(200).json(registers);
  } catch (err: any) {
    console.error("Fetch modbus registers error:", err);
    return res.status(500).json({ error: "Failed to fetch Modbus registers" });
  }
});

// POST /api/modbus/registers - Create register map (supports single and bulk insert)
router.post("/registers", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (Array.isArray(req.body)) {
      // Bulk insert
      const registersData = req.body.map(r => ({
        modbus_device_id: r.modbus_device_id,
        address: Number(r.address),
        function_code: r.function_code !== undefined ? Number(r.function_code) : 3,
        label: r.label,
        data_type: r.data_type || "float32_be",
        scale: r.scale !== undefined ? Number(r.scale) : 1.0,
        unit: r.unit || "",
        group_name: r.group_name || "",
        display_order: r.display_order !== undefined ? Number(r.display_order) : 0,
      }));

      // Validate each item in the array
      for (const r of registersData) {
        if (!r.modbus_device_id || r.address === undefined || !r.label) {
          return res.status(400).json({ error: "Each register must have modbus_device_id, address, and label" });
        }
      }

      // Verify permission for the modbus device
      const modbusDev = await prisma.modbusDevice.findUnique({
        where: { id: registersData[0].modbus_device_id },
        include: { device: true },
      });

      if (!modbusDev) {
        return res.status(404).json({ error: "Modbus device not found" });
      }

      if (
        req.user?.role !== "super_admin" &&
        req.user?.role !== "admin" &&
        modbusDev.device.owner_id !== req.user?.id
      ) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Perform bulk insert
      await prisma.modbusRegister.createMany({
        data: registersData,
      });

      return res.status(201).json({ success: true });
    }

    // Single insert
    const { modbus_device_id, address, function_code, label, data_type, scale, unit, group_name, display_order } = req.body;

    if (!modbus_device_id || address === undefined || !label) {
      return res.status(400).json({ error: "modbus_device_id, address, and label are required" });
    }

    const modbusDev = await prisma.modbusDevice.findUnique({
      where: { id: modbus_device_id },
      include: { device: true },
    });

    if (!modbusDev) {
      return res.status(404).json({ error: "Modbus device not found" });
    }

    if (
      req.user?.role !== "super_admin" &&
      req.user?.role !== "admin" &&
      modbusDev.device.owner_id !== req.user?.id
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    const register = await prisma.modbusRegister.create({
      data: {
        modbus_device_id,
        address: Number(address),
        function_code: function_code !== undefined ? Number(function_code) : 3,
        label,
        data_type: data_type || "float32_be",
        scale: scale !== undefined ? Number(scale) : 1.0,
        unit: unit || "",
        group_name: group_name || "",
        display_order: display_order !== undefined ? Number(display_order) : 0,
      },
    });

    return res.status(201).json(register);
  } catch (err: any) {
    console.error("Create modbus register error:", err);
    return res.status(500).json({ error: "Failed to create Modbus register mapping" });
  }
});

// ── Modbus Readings Endpoints ─────────────────────────────────────────────────

// GET /api/modbus/readings - Get register readings
router.get("/readings", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { modbus_device_id, limit } = req.query;

  if (!modbus_device_id) {
    return res.status(400).json({ error: "modbus_device_id is required" });
  }

  try {
    const modbusDev = await prisma.modbusDevice.findUnique({
      where: { id: String(modbus_device_id) },
      include: { device: true },
    });

    if (!modbusDev) {
      return res.status(404).json({ error: "Modbus device not found" });
    }

    if (
      req.user?.role !== "super_admin" &&
      req.user?.role !== "admin" &&
      modbusDev.device.owner_id !== req.user?.id
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    const takeLimit = limit ? Math.min(Number(limit), 1000) : 100;

    const readings = await prisma.modbusReading.findMany({
      where: { modbus_device_id: String(modbus_device_id) },
      orderBy: { created_at: "desc" },
      take: takeLimit,
      include: { register: true },
    });

    return res.status(200).json(readings);
  } catch (err: any) {
    console.error("Fetch modbus readings error:", err);
    return res.status(500).json({ error: "Failed to fetch Modbus readings" });
  }
});

// POST /api/modbus/readings - Write new register reading
router.post("/readings", async (req: Request, res: Response) => {
  const { modbus_device_id, register_id, raw_value, scaled_value } = req.body;

  if (!modbus_device_id || !register_id) {
    return res.status(400).json({ error: "modbus_device_id and register_id are required" });
  }

  try {
    const reading = await prisma.modbusReading.create({
      data: {
        modbus_device_id,
        register_id,
        raw_value: raw_value || "",
        scaled_value: scaled_value !== undefined ? Number(scaled_value) : 0.0,
      },
      include: { register: true },
    });

    broadcast(`modbus_readings-${modbus_device_id}`, "INSERT", reading);

    return res.status(201).json(reading);
  } catch (err: any) {
    console.error("Insert modbus reading error:", err);
    return res.status(500).json({ error: "Failed to log Modbus reading" });
  }
});

export default router;
