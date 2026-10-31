import express, { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "../prisma/db";
import {
  type AuthRequest,
  requireAuth,
  SIGNUP_ROLES,
  loginLimiter,
  signupLimiter,
} from "../lib/shared";

export const router: Router = Router();

router.get("/", (req, res) => {
  res.send("Hello World from the backend!");
});

router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

router.post("/signup", signupLimiter, async (req, res) => {
  try {
    const { password, name, role } = req.body;
    let { email } = req.body;

    if (typeof email !== "string" || typeof password !== "string" || typeof name !== "string" || !email || !password || !name.trim()) {
      return res.status(400).json({ error: "email, password, and name are required" });
    }

    if (name.length > 100 || password.length > 72) {
      return res.status(400).json({ error: "name or password is too long" });
    }

    if (role !== undefined && !SIGNUP_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${SIGNUP_ROLES.join(", ")}` });
    }

    email = email.trim().toLowerCase();

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      return res.status(400).json({ error: "Please provide a valid email address" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const existingUser = await db.orm.public.User.where({ email }).first();

    if (existingUser) {
      return res.status(400).json({ error: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { referralCode: incomingReferralCode } = req.body;

    let referredByUserId: number | null = null;

    if (incomingReferralCode) {
      const referrer = await db.orm.public.User.where({ referralCode: incomingReferralCode }).first();
      if (referrer) {
        referredByUserId = referrer.id;
      }
    }

    const myReferralCode = crypto.randomBytes(4).toString("hex");

    const user = await db.orm.public.User.create({
      email,
      password: hashedPassword,
      name,
      role: role ?? "buyer",
      referralCode: myReferralCode,
      referredBy: referredByUserId,
    });

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { password } = req.body;

    if (typeof req.body.email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "email and password are required" });
    }

    const email = req.body.email.trim().toLowerCase();

    const user = await db.orm.public.User.where({ email }).first();

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({ user: userWithoutPassword, token });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/me/update", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, phone, address } = req.body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;

    const updated = await db.orm.public.User.where({ id: req.userId! }).update(updateData);

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    const { password: _, ...userWithoutPassword } = updated;
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/me/change-password", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "currentPassword and newPassword are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }

    const user = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.orm.public.User.where({ id: user.id }).update({ password: hashedPassword });

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/me/availability", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "delivery") {
      return res.status(403).json({ error: "Only delivery persons can set availability" });
    }

    const { isAvailable, latitude, longitude } = req.body;

    const updateData: Record<string, unknown> = {
      isAvailableForDelivery: Boolean(isAvailable),
    };

    if (latitude !== undefined) updateData.currentLatitude = latitude;
    if (longitude !== undefined) updateData.currentLongitude = longitude;

    const updated = await db.orm.public.User.where({ id: req.userId! }).update(updateData);

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      isAvailableForDelivery: updated.isAvailableForDelivery,
      currentLatitude: updated.currentLatitude,
      currentLongitude: updated.currentLongitude,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/logout", requireAuth, async (req: AuthRequest & { token?: string }, res) => {
  try {
    if (req.token) {
      await db.orm.public.BlockedToken.create({ token: req.token });
    }

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/referral/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await db.orm.public.User.where({ id: req.userId! }).first();
    res.status(200).json({ referralCode: user?.referralCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
