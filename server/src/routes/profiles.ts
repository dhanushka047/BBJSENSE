import { Router, Response } from "express";
import prisma from "../db.js";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/profiles - Admin only, get all profiles
router.get("/", authenticateToken, requireRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const profiles = await prisma.profile.findMany({
      orderBy: { created_at: "desc" },
    });
    return res.status(200).json(profiles);
  } catch (err: any) {
    console.error("Fetch profiles error:", err);
    return res.status(500).json({ error: "Failed to fetch profiles" });
  }
});

// GET /api/profiles/roles - Admin only, get all user roles
router.get("/roles", authenticateToken, requireRole(["super_admin", "admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const roles = await prisma.userRole.findMany();
    return res.status(200).json(roles);
  } catch (err: any) {
    console.error("Fetch roles error:", err);
    return res.status(500).json({ error: "Failed to fetch roles" });
  }
});

// PUT /api/profiles/:userId/role - Super Admin only, update a user's role
router.put("/:userId/role", authenticateToken, requireRole(["super_admin"]), async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({ error: "Role is required" });
  }

  try {
    // Delete existing roles for this user and create the new one to prevent conflicts
    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { user_id: userId } }),
      prisma.userRole.create({
        data: {
          user_id: userId,
          role,
        },
      }),
    ]);

    return res.status(200).json({ user_id: userId, role });
  } catch (err: any) {
    console.error("Update role error:", err);
    return res.status(500).json({ error: "Failed to update user role" });
  }
});

// GET /api/profiles/:userId - Get profile by user_id
router.get("/:userId", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;

  // Users can only view their own profile, unless they are admins
  if (req.user?.id !== userId && req.user?.role !== "super_admin" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const profile = await prisma.profile.findUnique({
      where: { user_id: userId },
      include: {
        user: {
          select: {
            roles: {
              select: { role: true }
            }
          }
        }
      }
    });

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.status(200).json(profile);
  } catch (err: any) {
    console.error("Fetch profile error:", err);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PUT /api/profiles/:userId - Update profile by user_id
router.put("/:userId", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const { first_name, last_name, factory_name, location, subscription_status } = req.body;

  // Users can only update their own profile, unless super_admin
  if (req.user?.id !== userId && req.user?.role !== "super_admin") {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    // Only super_admin can update subscription_status
    const updateData: any = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (factory_name !== undefined) updateData.factory_name = factory_name;
    if (location !== undefined) updateData.location = location;
    
    if (subscription_status !== undefined && req.user?.role === "super_admin") {
      updateData.subscription_status = subscription_status;
    }

    const updatedProfile = await prisma.profile.update({
      where: { user_id: userId },
      data: updateData,
    });

    return res.status(200).json(updatedProfile);
  } catch (err: any) {
    console.error("Update profile error:", err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

// GET /api/profiles/:userId/preferences - Get notification preferences
router.get("/:userId/preferences", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;

  if (req.user?.id !== userId && req.user?.role !== "super_admin" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    let prefs = await prisma.notificationPreference.findUnique({
      where: { user_id: userId },
    });

    // Auto-create if not existing for some reason
    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: { user_id: userId },
      });
    }

    return res.status(200).json(prefs);
  } catch (err: any) {
    console.error("Fetch preferences error:", err);
    return res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

// PUT /api/profiles/:userId/preferences - Update notification preferences
router.put("/:userId/preferences", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const { email_on_offline, email_on_alert } = req.body;

  if (req.user?.id !== userId && req.user?.role !== "super_admin") {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const updateData: any = {};
    if (email_on_offline !== undefined) updateData.email_on_offline = email_on_offline;
    if (email_on_alert !== undefined) updateData.email_on_alert = email_on_alert;

    const updatedPrefs = await prisma.notificationPreference.update({
      where: { user_id: userId },
      data: updateData,
    });

    return res.status(200).json(updatedPrefs);
  } catch (err: any) {
    console.error("Update preferences error:", err);
    return res.status(500).json({ error: "Failed to update preferences" });
  }
});

export default router;
