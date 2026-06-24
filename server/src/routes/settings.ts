import { Router, Request, Response } from "express";
import prisma from "../db.js";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";
import { broadcast } from "../ws.js";

const router = Router();

// GET /api/settings - Public, fetch branding settings
router.get("/", async (req: Request, res: Response) => {
  try {
    const settings = await prisma.systemSetting.findMany();
    
    // Convert array to key-value object
    const config: Record<string, string> = {
      site_name: "BBJSENSE",
      site_logo: "/logo.png", // Default logo
    };

    settings.forEach((s) => {
      config[s.key] = s.value;
    });

    return res.status(200).json(config);
  } catch (err: any) {
    console.error("Fetch settings error:", err);
    return res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// POST /api/settings - Admin/Super Admin only, update branding settings
router.post("/", authenticateToken, requireRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
  const { site_name, site_logo } = req.body;

  try {
    const updates: any[] = [];

    if (site_name !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: "site_name" },
          update: { value: String(site_name) },
          create: { key: "site_name", value: String(site_name) },
        })
      );
    }

    if (site_logo !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: "site_logo" },
          update: { value: String(site_logo) },
          create: { key: "site_logo", value: String(site_logo) },
        })
      );
    }

    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }

    // Get fresh settings
    const allSettings = await prisma.systemSetting.findMany();
    const freshConfig: Record<string, string> = {
      site_name: "BBJSENSE",
      site_logo: "/logo.png",
    };
    allSettings.forEach((s) => {
      freshConfig[s.key] = s.value;
    });

    // Broadcast system settings updates to all active clients
    broadcast("system_settings", "UPDATE", freshConfig);

    return res.status(200).json(freshConfig);
  } catch (err: any) {
    console.error("Update settings error:", err);
    return res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
