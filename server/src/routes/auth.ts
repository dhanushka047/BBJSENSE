import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "bbjsense-default-secret-key-12345";

// JWT expiration time (e.g., 7 days)
const JWT_EXPIRES_IN = "7d";

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
  const { email, password, first_name, last_name, factory_name, location } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email is already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user and associated records in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
        },
      });

      const profile = await tx.profile.create({
        data: {
          user_id: user.id,
          first_name: first_name || "",
          last_name: last_name || "",
          email,
          factory_name: factory_name || "",
          location: location || "",
          subscription_status: "active",
        },
      });

      const role = await tx.userRole.create({
        data: {
          user_id: user.id,
          role: "user",
        },
      });

      await tx.notificationPreference.create({
        data: {
          user_id: user.id,
        },
      });

      return { user, profile, role };
    });

    // Create session user payload
    const sessionUser = {
      id: result.user.id,
      email: result.user.email,
      first_name: result.profile.first_name,
      last_name: result.profile.last_name,
      role: result.role.role,
      factory_name: result.profile.factory_name,
      location: result.profile.location,
      subscription_status: result.profile.subscription_status,
    };

    // Sign token
    const token = jwt.sign(
      { id: sessionUser.id, email: sessionUser.email, role: sessionUser.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      user: sessionUser,
      session: {
        access_token: token,
        token_type: "bearer",
        expires_in: 604800, // 7 days in seconds
        user: sessionUser,
      },
    });
  } catch (err: any) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Failed to register user" });
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        roles: true,
      },
    });

    if (!user) {
      return res.status(400).json({ error: "No user found with this email" });
    }

    // Compare password (support plain-text fallback for seeded user credentials if bcrypt fails)
    let isMatch = await bcrypt.compare(password, user.password).catch(() => false);
    if (!isMatch && password === user.password) {
      isMatch = true;
    }

    if (!isMatch) {
      return res.status(400).json({ error: "Invalid password" });
    }

    const primaryRole = user.roles[0]?.role || "user";
    const first_name = user.profile?.first_name || "";
    const last_name = user.profile?.last_name || "";
    const factory_name = user.profile?.factory_name || "";
    const location = user.profile?.location || "";
    const subscription_status = user.profile?.subscription_status || "active";

    const sessionUser = {
      id: user.id,
      email: user.email,
      first_name,
      last_name,
      role: primaryRole,
      factory_name,
      location,
      subscription_status,
    };

    // Sign token
    const token = jwt.sign(
      { id: sessionUser.id, email: sessionUser.email, role: sessionUser.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      user: sessionUser,
      session: {
        access_token: token,
        token_type: "bearer",
        expires_in: 604800, // 7 days in seconds
        user: sessionUser,
      },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Failed to login" });
  }
});

// GET /api/auth/session
router.get("/session", authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        profile: true,
        roles: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const primaryRole = user.roles[0]?.role || "user";

    const sessionUser = {
      id: user.id,
      email: user.email,
      first_name: user.profile?.first_name || "",
      last_name: user.profile?.last_name || "",
      role: primaryRole,
      factory_name: user.profile?.factory_name || "",
      location: user.profile?.location || "",
      subscription_status: user.profile?.subscription_status || "active",
    };

    return res.status(200).json({
      session: {
        access_token: req.headers["authorization"]?.split(" ")[1],
        token_type: "bearer",
        user: sessionUser,
      },
    });
  } catch (err: any) {
    console.error("Session error:", err);
    return res.status(500).json({ error: "Failed to fetch session" });
  }
});

export default router;
