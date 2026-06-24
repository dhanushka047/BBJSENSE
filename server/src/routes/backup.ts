import { Router, Response } from "express";
import prisma from "../db.js";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/backup/snapshots - List all snapshots (Admin only)
router.get("/snapshots", authenticateToken, requireRole(["super_admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const snapshots = await prisma.databaseSnapshot.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        created_by: true,
        created_at: true,
        creator: {
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

    // Match the format expected by the frontend
    const formattedSnapshots = snapshots.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      created_by: s.created_by,
      created_at: s.created_at.toISOString(),
      creator_name: s.creator?.profile
        ? `${s.creator.profile.first_name} ${s.creator.profile.last_name}`.trim()
        : "System",
    }));

    return res.status(200).json(formattedSnapshots);
  } catch (err: any) {
    console.error("Fetch snapshots error:", err);
    return res.status(500).json({ error: "Failed to fetch snapshots" });
  }
});

// GET /api/backup/snapshots/:id - Get snapshot data by id
router.get("/snapshots/:id", authenticateToken, requireRole(["super_admin"]), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const snapshot = await prisma.databaseSnapshot.findUnique({
      where: { id },
    });

    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    return res.status(200).json({
      ...snapshot,
      snapshot_data: JSON.parse(snapshot.snapshot_data),
    });
  } catch (err: any) {
    console.error("Fetch snapshot detail error:", err);
    return res.status(500).json({ error: "Failed to fetch snapshot detail" });
  }
});

// POST /api/backup/snapshots - Create database snapshot
router.post("/snapshots", authenticateToken, requireRole(["super_admin"]), async (req: AuthRequest, res: Response) => {
  const { name, description, snapshot_data } = req.body;

  if (!name || !snapshot_data) {
    return res.status(400).json({ error: "name and snapshot_data are required" });
  }

  try {
    const serializedData = typeof snapshot_data === "string" 
      ? snapshot_data 
      : JSON.stringify(snapshot_data);

    const snapshot = await prisma.databaseSnapshot.create({
      data: {
        name,
        description: description || "",
        snapshot_data: serializedData,
        created_by: req.user!.id,
      },
    });

    return res.status(201).json({
      id: snapshot.id,
      name: snapshot.name,
      description: snapshot.description,
      created_at: snapshot.created_at,
    });
  } catch (err: any) {
    console.error("Create snapshot error:", err);
    return res.status(500).json({ error: "Failed to create database snapshot" });
  }
});

// DELETE /api/backup/snapshots/:id - Delete snapshot
router.delete("/snapshots/:id", authenticateToken, requireRole(["super_admin"]), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.databaseSnapshot.delete({
      where: { id },
    });
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("Delete snapshot error:", err);
    return res.status(500).json({ error: "Failed to delete snapshot" });
  }
});

export default router;
