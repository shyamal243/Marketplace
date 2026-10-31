import * as Sentry from "@sentry/node";
import express from "express";
import bcrypt from "bcrypt";
import { db } from "../prisma/db";
import jwt from "jsonwebtoken";
import Razorpay from "razorpay";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "path";


export interface AuthRequest extends express.Request {
  userId?: number;
  userRole?: string;
}

export async function requireAuth(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const blocked = await db.orm.public.BlockedToken.where({ token }).first();

    if (blocked) {
      return res.status(401).json({ error: "This token has been logged out" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number; role: string };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    (req as AuthRequest & { token?: string }).token = token;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function calculateRoadDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): Promise<number> {
  try {
    const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: {
        Authorization: process.env.ORS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [lon1, lat1],
          [lon2, lat2],
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouteService returned status ${response.status}`);
    }

    const data = await response.json();
    const distanceMeters = data.routes[0].summary.distance;
    return distanceMeters / 1000;
  } catch (error) {
    console.error("Distance calculation failed, falling back to straight-line:", error);
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}
export const requiredEnvVars = ["JWT_SECRET", "DATABASE_URL", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "ORS_API_KEY"];

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

export type PaymentMapping = {
  razorpayOrderId: string;
  purpose: string;
  referenceId: number;
  userId: number;
  amount: number;
};

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function verifyRazorpaySignature(orderId: unknown, paymentId: unknown, signature: unknown): boolean {
  if (typeof orderId !== "string" || typeof paymentId !== "string" || typeof signature !== "string") {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqual(signature, expected);
}

// Records a payment as processed. Returns false if it was already processed
// (relies on the unique constraint on razorpayPaymentId, so it is race-safe).
export async function claimPayment(razorpayPaymentId: string): Promise<boolean> {
  try {
    await db.orm.public.ProcessedPayment.create({ razorpayPaymentId });
    return true;
  } catch (error) {
    const existing = await db.orm.public.ProcessedPayment.where({ razorpayPaymentId }).first();
    if (existing) return false;
    throw error;
  }
}

// Applies the effect of a verified payment, based on what the server stored
// when the Razorpay order was created (never on client-supplied values).
export async function applyMappedPayment(mapping: PaymentMapping): Promise<unknown> {
  if (mapping.purpose === "order_payment") {
    return db.orm.public.Order.where({ id: mapping.referenceId }).update({ isPaid: true });
  }
  if (mapping.purpose === "booking_fee") {
    return db.orm.public.Demand.where({ id: mapping.referenceId }).update({
      status: "open",
      bookingFeePaid: true,
    });
  }
  if (mapping.purpose === "wallet_topup") {
    return db.transaction(async (tx) => {
      const user = await tx.orm.public.User.where({ id: mapping.userId }).first();
      if (!user) return null;
      const newBalance = await adjustWallet(tx, user.id, mapping.amount);
      await tx.orm.public.WalletTransaction.create({
        amount: mapping.amount,
        type: "credit",
        reason: "topup",
        userId: user.id,
      });
      return newBalance;
    });
  }
  return null;
}

// Looks up and validates the stored mapping for a client-side payment verification.
export async function loadVerifiedMapping(
  razorpayOrderId: unknown,
  razorpayPaymentId: unknown,
  razorpaySignature: unknown,
  expected: { purpose: string; referenceId: number; userId: number }
): Promise<{ mapping?: PaymentMapping; error?: string }> {
  if (!verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
    return { error: "Payment verification failed" };
  }
  const mapping = await db.orm.public.RazorpayOrderMapping.where({ razorpayOrderId: razorpayOrderId as string }).first();
  if (
    !mapping ||
    mapping.purpose !== expected.purpose ||
    mapping.referenceId !== expected.referenceId ||
    mapping.userId !== expected.userId
  ) {
    return { error: "Payment does not match this request" };
  }
  return { mapping };
}

export const ALLOWED_UPLOAD_TYPES = new Map([
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/png", [".png"]],
  ["application/pdf", [".pdf"]],
]);

export const SIGNUP_ROLES = ["buyer", "seller", "worker", "delivery"];

export function paginate<T>(items: T[], query: express.Request["query"], defaultLimit = 50, maxLimit = 100) {
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(query.limit)) || defaultLimit));
  const start = (page - 1) * limit;
  return { page, limit, total: items.length, items: items.slice(start, start + limit) };
}

// Masks a government ID number (e.g. Aadhaar/PAN) so only the last 4 characters are visible.
export function maskDocumentNumber<T extends { documentNumber?: string | null }>(doc: T): T {
  if (!doc.documentNumber) return doc;
  const n = doc.documentNumber;
  return { ...doc, documentNumber: n.length <= 4 ? "****" : `${"*".repeat(n.length - 4)}${n.slice(-4)}` };
}

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class InsufficientFundsError extends Error {
  constructor() {
    super("Insufficient wallet balance");
  }
}

// Atomically changes a user's wallet balance using compare-and-swap: the update only
// applies if the balance is still what we read, otherwise we re-read and retry.
// This prevents lost updates / double spends from concurrent requests.
// Must be called inside db.transaction(). Returns the new balance.
export async function adjustWallet(tx: Tx, userId: number, delta: number): Promise<number> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const user = await tx.orm.public.User.where({ id: userId }).first();
    if (!user) throw new Error(`User ${userId} not found`);

    const newBalance = user.walletBalance + delta;
    if (newBalance < 0) throw new InsufficientFundsError();

    const updated = await tx.orm.public.User.where({ id: userId, walletBalance: user.walletBalance }).update({
      walletBalance: newBalance,
    });
    if (updated) return newBalance;
  }
  throw new Error("Could not update wallet balance due to concurrent changes, please retry");
}

// Records an admin action. Never lets an audit failure break the request itself,
// but failures are logged loudly so they are noticed.
export async function audit(actorId: number, action: string, targetType: string | null, targetId: number | null, details: unknown) {
  try {
    await db.orm.public.AuditLog.create({
      actorId,
      action,
      targetType,
      targetId,
      details: JSON.stringify(details),
    });
  } catch (error) {
    console.error("AUDIT LOG FAILURE", { actorId, action, targetType, targetId, details }, error);
  }
}

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
export const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const exts = ALLOWED_UPLOAD_TYPES.get(file.mimetype);
    const ext = path.extname(file.originalname).toLowerCase();
    if (exts && exts.includes(ext)) return cb(null, true);
    cb(new Error("Only JPG, PNG or PDF files are allowed"));
  },
});
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Too many signups from this address. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many payment requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});
export const PORT = Number(process.env.PORT) || 4000;
export const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",").map((o) => o.trim());
