import * as Sentry from "@sentry/node";
import express from "express";
import bcrypt from "bcrypt";
import { db } from "./prisma/db";
import jwt from "jsonwebtoken";
import Razorpay from "razorpay";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import path from "path";
import fs from "fs";


interface AuthRequest extends express.Request {
  userId?: number;
  userRole?: string;
}

async function requireAuth(req: AuthRequest, res: express.Response, next: express.NextFunction) {
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

async function calculateRoadDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): Promise<number> {
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
const requiredEnvVars = ["JWT_SECRET", "DATABASE_URL", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "ORS_API_KEY"];

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}
const app = express();
app.set("trust proxy", 1);
const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});
const PORT = 4000;

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));
app.use(helmet());
app.use(express.json({ limit: "1mb" }));


app.get("/", (req, res) => {
  res.send("Hello World from the backend!");
});
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/signup", async (req, res) => {
  try {
    const { password, name, role } = req.body;
    let { email } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "email, password, and name are required" });
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

    if (referredByUserId) {
      const rewardSetting = await db.orm.public.PlatformSetting.where({ key: "referral_reward_amount" }).first();
      const rewardAmount = rewardSetting ? Number(rewardSetting.value) : 20;

      if (rewardAmount > 0) {
        await db.transaction(async (tx) => {
          const referrer = await tx.orm.public.User.where({ id: referredByUserId! }).first();

          if (referrer) {
            await tx.orm.public.User.where({ id: referrer.id }).update({
              walletBalance: referrer.walletBalance + rewardAmount,
            });

            await tx.orm.public.WalletTransaction.create({
              amount: rewardAmount,
              type: "credit",
              reason: "referral_bonus",
              userId: referrer.id,
            });
          }

          await tx.orm.public.User.where({ id: user.id }).update({
            walletBalance: user.walletBalance + rewardAmount,
          });

          await tx.orm.public.WalletTransaction.create({
            amount: rewardAmount,
            type: "credit",
            reason: "referral_bonus",
            userId: user.id,
          });
        });
      }
    }

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/login", loginLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    const email = req.body.email?.trim().toLowerCase();

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

app.get("/me", requireAuth, async (req: AuthRequest, res) => {
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

app.post("/me/update", requireAuth, async (req: AuthRequest, res) => {
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

app.post("/me/change-password", requireAuth, async (req: AuthRequest, res) => {
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

app.post("/me/availability", requireAuth, async (req: AuthRequest, res) => {
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

app.get("/demands/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const demands = await db.orm.public.Demand.where({ buyerId: req.userId! }).all();
    res.status(200).json(demands);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/bids/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const bids = await db.orm.public.Bid.where({ sellerId: req.userId! }).all();
    res.status(200).json(bids);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/orders/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const asBuyer = await db.orm.public.Order.where({ buyerId: req.userId! }).all();
    const asSeller = await db.orm.public.Order.where({ sellerId: req.userId! }).all();

    res.status(200).json({ asBuyer, asSeller });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/deliveries/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "delivery") {
      return res.status(403).json({ error: "Only delivery persons have delivery assignments" });
    }

    const assignments = await db.orm.public.DeliveryAssignment.where({ deliveryPersonId: req.userId! }).all();

    const enriched = await Promise.all(
      assignments.map(async (a) => {
        const order = await db.orm.public.Order.where({ id: a.orderId }).first();
        return { ...a, orderType: order?.orderType ?? null };
      })
    );

    res.status(200).json(enriched);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
app.post("/logout", requireAuth, async (req: AuthRequest & { token?: string }, res) => {
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

app.post("/demands", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { title, description, budget, durationHours, category, hoursNeeded } = req.body;
    if (req.userRole !== "buyer") {
      return res.status(403).json({ error: "Only buyers can post demands" });
    }
        if (budget !== undefined && budget !== null && (typeof budget !== "number" || budget <= 0)) {
      return res.status(400).json({ error: "budget must be a positive number" });
    }

    const allowedDurations = [1, 2, 3, 6, 12, 24];

    if (!durationHours || !allowedDurations.includes(durationHours)) {
      return res.status(400).json({ error: `durationHours must be one of: ${allowedDurations.join(", ")}` });
    }

    const feeSetting = await db.orm.public.PlatformSetting.where({ key: "booking_fee" }).first();
    const bookingFeeAmount = feeSetting ? Number(feeSetting.value) : 10;

    const bidWindowExpiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

    const demand = await db.orm.public.Demand.create({
      title,
      description,
      budget,
      category,
      hoursNeeded,
      buyerId: req.userId!,
      status: "pending_payment",
      bookingFeeAmount,
      bookingFeePaid: false,
      bidWindowExpiresAt,
    });

    res.status(201).json(demand);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});


app.post("/demands/ai-draft", requireAuth, upload.single("photo"), async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "buyer") {
      return res.status(403).json({ error: "Only buyers can draft demands" });
    }

    const { text } = req.body;
    const photoFile = req.file;

    if (!text && !photoFile) {
      return res.status(400).json({ error: "Provide some text or a photo describing what you need" });
    }

    const parts: Array<Record<string, unknown>> = [];

    const promptText = `The buyer typed or said: "${text || "(no text provided, see photo)"}"

Based on this (and the photo if provided), draft a demand posting for a reverse-marketplace platform. Correct any typos. Respond ONLY with JSON in this exact shape, no other text, no markdown fences:
{
  "title": "short corrected title",
  "description": "a clear 1-3 sentence description",
  "category": "a single lowercase category word, e.g. clothing, cleaning, electronics, maid, carpentry, medicines",
  "budget": null or a number if a budget was mentioned or reasonably inferable,
  "hoursNeeded": null or a number if this is an hourly service request
}`;

    parts.push({ text: promptText });

    if (photoFile) {
      const imageBuffer = fs.readFileSync(photoFile.path);
      const base64Image = imageBuffer.toString("base64");
      const ext = path.extname(photoFile.originalname).toLowerCase();
      const mimeTypeMap: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
      };
      const mimeType = mimeTypeMap[ext] || "image/jpeg";
      parts.push({
        inline_data: { mime_type: mimeType, data: base64Image },
      });
    }

    async function callGemini(): Promise<Response> {
      const maxAttempts = 3;
      let lastResponse: Response | null = null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": process.env.GEMINI_API_KEY!,
            },
            body: JSON.stringify({
              contents: [{ parts }],
            }),
          }
        );

        if (response.ok) return response;

        lastResponse = response;
        if (response.status === 503 || response.status === 429) {
          const waitMs = 500 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        break;
      }

      return lastResponse!;
    }

    const aiResponse = await callGemini();

    if (photoFile) {
      fs.unlink(photoFile.path, () => {});
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Gemini API error:", errText);
      const isOverloaded = aiResponse.status === 503 || aiResponse.status === 429;
      return res.status(502).json({
        error: isOverloaded
          ? "The AI drafting service is busy right now (free tier gets high demand at times) — please try again in a moment, or just fill the form in manually below."
          : "AI drafting service is unavailable right now",
      });
    }

    const aiData = await aiResponse.json();
    const rawText =
      aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let draft;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      draft = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", rawText);
      return res
        .status(502)
        .json({ error: "Could not understand the AI response, please try again or type your demand manually" });
    }

    res.json(draft);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
app.post("/demands/:id/pay-fee", requireAuth, async (req: AuthRequest, res) => {
  try {
    const demandId = Number(req.params.id);
    const { method } = req.body;

    const demand = await db.orm.public.Demand.where({ id: demandId }).first();

    if (!demand) {
      return res.status(404).json({ error: "Demand not found" });
    }

    if (demand.buyerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this demand" });
    }

    if (demand.status !== "pending_payment") {
      return res.status(400).json({ error: `Cannot pay fee for a demand with status "${demand.status}"` });
    }

    const feeAmount = demand.bookingFeeAmount!;

    if (method === "wallet") {
      const user = await db.orm.public.User.where({ id: req.userId! }).first();

      if (!user || user.walletBalance < feeAmount) {
        return res.status(400).json({ error: "Insufficient wallet balance" });
      }

      const updatedDemand = await db.transaction(async (tx) => {
        await tx.orm.public.User.where({ id: user.id }).update({
          walletBalance: user.walletBalance - feeAmount,
        });

        await tx.orm.public.WalletTransaction.create({
          amount: feeAmount,
          type: "debit",
          reason: "booking_fee",
          userId: user.id,
        });

        return tx.orm.public.Demand.where({ id: demand.id }).update({
          status: "open",
          bookingFeePaid: true,
        });
      });

      return res.status(200).json(updatedDemand);


    }

    if (method === "razorpay") {
      const razorpayOrder = await razorpay.orders.create({
        amount: feeAmount * 100,
        currency: "INR",
        receipt: `booking_fee_${demand.id}`,
      });

            await db.orm.public.RazorpayOrderMapping.create({
        razorpayOrderId: razorpayOrder.id,
        purpose: "booking_fee",
        referenceId: demand.id,
        userId: req.userId!,
        amount: feeAmount,
      });

      return res.status(200).json({
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      });
    }

    res.status(400).json({ error: "method must be 'wallet' or 'razorpay'" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/demands/:id/verify-fee-payment", requireAuth, async (req: AuthRequest, res) => {
  try {
    const demandId = Number(req.params.id);
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    const demand = await db.orm.public.Demand.where({ id: demandId }).first();

    if (!demand) {
      return res.status(404).json({ error: "Demand not found" });
    }

    if (demand.buyerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this demand" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    const alreadyProcessed = await db.orm.public.ProcessedPayment.where({ razorpayPaymentId }).first();

    if (alreadyProcessed) {
      return res.status(400).json({ error: "This payment has already been processed" });
    }

    await db.orm.public.ProcessedPayment.create({ razorpayPaymentId });

    const updatedDemand = await db.orm.public.Demand.where({ id: demand.id }).update({
      status: "open",
      bookingFeePaid: true,
    });

    res.status(200).json(updatedDemand);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/demands/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const demandId = Number(req.params.id);

    const demand = await db.orm.public.Demand.where({ id: demandId }).first();

    if (!demand) {
      return res.status(404).json({ error: "Demand not found" });
    }

    if (demand.buyerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this demand" });
    }

    if (demand.status !== "open") {
      return res.status(400).json({ error: `Cannot cancel a demand with status "${demand.status}"` });
    }

    const bids = await db.orm.public.Bid.where({ demandId: demand.id }).all();

    if (bids.length > 0) {
      return res.status(400).json({ error: "Cannot cancel a demand that has received bids" });
    }

    const user = await db.orm.public.User.where({ id: req.userId! }).first();

    if (user && demand.bookingFeePaid && demand.bookingFeeAmount) {
      await db.orm.public.User.where({ id: user.id }).update({
        walletBalance: user.walletBalance + demand.bookingFeeAmount,
      });

      await db.orm.public.WalletTransaction.create({
        amount: demand.bookingFeeAmount,
        type: "credit",
        reason: "booking_fee_refund",
        userId: user.id,
      });
    }

    const updatedDemand = await db.orm.public.Demand.where({ id: demand.id }).update({ status: "closed" });

    res.status(200).json(updatedDemand);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/demands", async (req, res) => {
  try {
    const { status, maxBudget, search } = req.query;

    const filters: Record<string, unknown> = {};

    if (status) {
      filters.status = status;
    }

    let demands = await db.orm.public.Demand.where(filters).all();

    if (maxBudget) {
      const max = Number(maxBudget);
      demands = demands.filter((d) => d.budget !== null && d.budget <= max);
    }

    if (search) {
      const term = String(search).toLowerCase();
      demands = demands.filter((d) => d.title.toLowerCase().includes(term));
    }

    res.status(200).json(demands);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/bids", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { demandId, amount, message, productId } = req.body;
        if (req.userRole !== "seller" && req.userRole !== "professional") {
      return res.status(403).json({ error: "Only sellers or professionals can submit bids" });
    }
        if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    // STEP 1: Look up the demand FIRST (new)
    const targetDemand = await db.orm.public.Demand.where({ id: demandId }).first();

    if (!targetDemand) {
      return res.status(404).json({ error: "Demand not found" });
    }

    // STEP 2: Check if the bidding deadline has passed (new)
    if (targetDemand.bidWindowExpiresAt && new Date(targetDemand.bidWindowExpiresAt) < new Date()) {
      return res.status(400).json({ error: "The bidding window for this demand has closed" });
    }
    if (targetDemand.status !== "open") {
      return res.status(400).json({ error: `Cannot bid on a demand with status "${targetDemand.status}"` });
    }

    let linkedProductId: number | null = null;

    if (productId !== undefined && productId !== null) {
      const linkedProduct = await db.orm.public.Product.where({ id: productId }).first();

      if (!linkedProduct) {
        return res.status(404).json({ error: "Linked product not found" });
      }

      const productStore = await db.orm.public.Store.where({ id: linkedProduct.storeId }).first();
      const isOwner = productStore?.sellerId === req.userId;
      const hasAccess =
        isOwner ||
        (await db.orm.public.StoreAccess.where({ storeId: linkedProduct.storeId, userId: req.userId! }).first()) !== null;

      if (!hasAccess) {
        return res.status(403).json({ error: "You can only link a product from your own store" });
      }

      linkedProductId = linkedProduct.id;
    }

    // STEP 3: Only now do we create the bid (same as before)
    const bid = await db.orm.public.Bid.create({
      demandId,
      amount,
      message,
      sellerId: req.userId!,
      linkedProductId,
    });

    // STEP 4: Look up demand again for the notification (same as before, kept for the message text)
    const demand = await db.orm.public.Demand.where({ id: demandId }).first();

    if (demand) {
      await db.orm.public.Notification.create({
        message: `You received a new bid of ₹${amount} on "${demand.title}"`,
        type: "new_bid",
        userId: demand.buyerId,
      });
    }

    res.status(201).json(bid);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/demands/:id/bids", requireAuth, async (req: AuthRequest, res) => {
  try {
    const demandId = Number(req.params.id);

    const demand = await db.orm.public.Demand.where({ id: demandId }).first();

    if (!demand) {
      return res.status(404).json({ error: "Demand not found" });
    }

    const allBids = await db.orm.public.Bid.where({ demandId }).all();

    const linkedProductIds = Array.from(
      new Set(allBids.map((b: any) => b.linkedProductId).filter((id: any) => id !== null && id !== undefined))
    );

    const linkedProducts = await Promise.all(
      linkedProductIds.map((productId: number) => db.orm.public.Product.where({ id: productId }).first())
    );

    const productById = new Map<number, any>();
    linkedProducts.forEach((p: any) => {
      if (p) productById.set(p.id, p);
    });

    const enrichedBids = allBids.map((b: any) => ({
      ...b,
      linkedProduct: b.linkedProductId ? productById.get(b.linkedProductId) ?? null : null,
    }));

    if (demand.buyerId === req.userId) {
      return res.status(200).json(enrichedBids);
    }

    const ownBidOnly = enrichedBids.filter((b: any) => b.sellerId === req.userId);
    res.status(200).json(ownBidOnly);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/bids/:id/accept", requireAuth, async (req: AuthRequest, res) => {
  try {
    const bidId = Number(req.params.id);

    const bid = await db.orm.public.Bid.where({ id: bidId }).first();

    if (!bid) {
      return res.status(404).json({ error: "Bid not found" });
    }

    const demand = await db.orm.public.Demand.where({ id: bid.demandId }).first();

    if (!demand) {
      return res.status(404).json({ error: "Demand not found" });
    }

    if (demand.buyerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this demand" });
    }

    const gstRate = demand.category
      ? await db.orm.public.GstRate.where({ category: demand.category }).first()
      : null;

    const ratePercent = gstRate?.ratePercent ?? 0;
    const gstAmount = Math.round((bid.amount * ratePercent) / (100 + ratePercent));
    const commissionSetting = await db.orm.public.PlatformSetting.where({ key: "commission_percent" }).first();
    const commissionPercent = commissionSetting ? Number(commissionSetting.value) : 0;
    const commissionAmount = Math.round((bid.amount * commissionPercent) / 100);

    const order = await db.transaction(async (tx) => {
      const newOrder = await tx.orm.public.Order.create({
        demandId: demand.id,
        bidId: bid.id,
        buyerId: demand.buyerId,
        sellerId: bid.sellerId,
        amount: bid.amount,
        gstCategory: demand.category ?? null,
        gstRatePercent: ratePercent,
        gstAmount,
        commissionAmount,
      });
            if (commissionAmount > 0) {
        await tx.orm.public.PlatformEarning.create({
          type: "commission",
          amount: commissionAmount,
          orderId: newOrder.id,
        });
      }

      await tx.orm.public.Bid.where({ id: bid.id }).update({ status: "accepted" });
      await tx.orm.public.Demand.where({ id: demand.id }).update({ status: "fulfilled" });

      return newOrder;
    });

    await db.orm.public.Notification.create({
      message: `Your bid of ₹${bid.amount} on "${demand.title}" was accepted!`,
      type: "bid_accepted",
      userId: bid.sellerId,
    });

    const buyerAccount = await db.orm.public.User.where({ id: demand.buyerId }).first();

    if (buyerAccount && buyerAccount.referredBy && !buyerAccount.referralRewarded) {
      const REFERRAL_REWARD = 50;

      await db.transaction(async (tx) => {
        const referrer = await tx.orm.public.User.where({ id: buyerAccount.referredBy! }).first();

        if (referrer) {
          await tx.orm.public.User.where({ id: referrer.id }).update({
            walletBalance: referrer.walletBalance + REFERRAL_REWARD,
          });
          await tx.orm.public.WalletTransaction.create({
            amount: REFERRAL_REWARD,
            type: "credit",
            reason: "referral_reward",
            userId: referrer.id,
          });
        }

        await tx.orm.public.User.where({ id: buyerAccount.id }).update({
          walletBalance: buyerAccount.walletBalance + REFERRAL_REWARD,
          referralRewarded: true,
        });
        await tx.orm.public.WalletTransaction.create({
          amount: REFERRAL_REWARD,
          type: "credit",
          reason: "referral_reward",
          userId: buyerAccount.id,
        });
      });
    }

    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/bids/:id/reject", requireAuth, async (req: AuthRequest, res) => {
  try {
    const bidId = Number(req.params.id);

    const bid = await db.orm.public.Bid.where({ id: bidId }).first();

    if (!bid) {
      return res.status(404).json({ error: "Bid not found" });
    }

    const demand = await db.orm.public.Demand.where({ id: bid.demandId }).first();

    if (!demand) {
      return res.status(404).json({ error: "Demand not found" });
    }

    if (demand.buyerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this demand" });
    }

    const updatedBid = await db.orm.public.Bid.where({ id: bid.id }).update({ status: "rejected" });
    await db.orm.public.Notification.create({
      message: `Your bid of ₹${bid.amount} on "${demand.title}" was rejected`,
      type: "bid_rejected",
      userId: bid.sellerId,
    });

    const remainingPendingBids = await db.orm.public.Bid.where({
      demandId: demand.id,
      status: "pending",
    }).all();

    if (remainingPendingBids.length === 0) {
      await db.orm.public.Demand.where({ id: demand.id }).update({ status: "closed" });
    }

    res.status(200).json(updatedBid);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/orders/:id/ship", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    const { deliveryMode, deliveryPersonId, trackingNumber, courierName } = req.body;

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.sellerId !== req.userId) {
      return res.status(403).json({ error: "You are not the seller for this order" });
    }

    if (order.status !== "confirmed") {
      return res.status(400).json({ error: `Cannot ship an order with status "${order.status}"` });
    }
    if (order.otpRequired && !order.checkoutOtpVerifiedAt) {
      return res.status(400).json({ error: "The buyer must verify the checkout OTP before this order can ship" });
    }

    const deliveryOtp = order.otpRequired ? Math.floor(100000 + Math.random() * 900000).toString() : null;

    if (deliveryMode !== "local" && deliveryMode !== "courier") {
      return res.status(400).json({ error: "deliveryMode must be 'local' or 'courier'" });
    }

    if (deliveryMode === "local") {
      let refLat: number | null = null;
      let refLon: number | null = null;

      if (order.storeId) {
        const store = await db.orm.public.Store.where({ id: order.storeId }).first();
        if (store?.latitude && store?.longitude) {
          refLat = store.latitude;
          refLon = store.longitude;
        }
      } else if (order.demandId) {
        const demand = await db.orm.public.Demand.where({ id: order.demandId }).first();
        if (demand?.deliveryLatitude && demand?.deliveryLongitude) {
          refLat = demand.deliveryLatitude;
          refLon = demand.deliveryLongitude;
        }
      }

      const availablePeople = await db.orm.public.User.where({
        role: "delivery",
        isAvailableForDelivery: true,
      }).all();

      if (availablePeople.length === 0) {
        return res.status(400).json({ error: "No delivery persons are currently available. Try courier delivery instead." });
      }

      let chosenPerson = availablePeople[0]!;

      if (refLat !== null && refLon !== null) {
        const withDistance = availablePeople
          .filter((p) => p.currentLatitude !== null && p.currentLongitude !== null)
          .map((p) => {
            const R = 6371;
            const dLat = ((p.currentLatitude! - refLat!) * Math.PI) / 180;
            const dLon = ((p.currentLongitude! - refLon!) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((refLat! * Math.PI) / 180) *
                Math.cos((p.currentLatitude! * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return { person: p, distanceKm: R * c };
          })
          .sort((a, b) => a.distanceKm - b.distanceKm);

        if (withDistance.length > 0) {
          chosenPerson = withDistance[0]!.person;
        }
      }

      const updatedOrder = await db.transaction(async (tx) => {
        await tx.orm.public.DeliveryAssignment.create({
          orderId: order.id,
          deliveryPersonId: chosenPerson.id,
        });

        return tx.orm.public.Order.where({ id: order.id }).update({
          status: "shipped",
          deliveryMode: "local",
          deliveryOtp,
        });
      });

      await db.orm.public.Notification.create({
        message: `You've been auto-assigned a local delivery for order #${order.id}`,
        type: "delivery_assigned",
        userId: chosenPerson.id,
      });

      if (order.otpRequired && deliveryOtp) {
        await db.orm.public.Notification.create({
          message: `Your delivery verification code for order #${order.id} is ${deliveryOtp}. Share this with the delivery partner only when you receive your item.`,
          type: "delivery_otp",
          userId: order.buyerId,
        });
      }

      return res.status(200).json({ ...updatedOrder, assignedTo: chosenPerson.name });
    }

    if (!trackingNumber || !courierName) {
      return res.status(400).json({ error: "trackingNumber and courierName are required for courier delivery" });
    }

    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({
      status: "shipped",
      deliveryMode: "courier",
      deliveryOtp,
      trackingNumber,
      courierName,
    });

    if (order.otpRequired && deliveryOtp) {
      await db.orm.public.Notification.create({
        message: `Your delivery verification code for order #${order.id} is ${deliveryOtp}. Share this with the delivery partner only when you receive your item.`,
        type: "delivery_otp",
        userId: order.buyerId,
      });
    }

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/deliveries/:orderId/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.orderId);
    const { status } = req.body;
    const { otp } = req.body;

    const allowedStatuses = ["picked_up", "out_for_delivery", "delivered"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowedStatuses.join(", ")}` });
    }

    const assignment = await db.orm.public.DeliveryAssignment.where({ orderId }).first();

    if (!assignment) {
      return res.status(404).json({ error: "No delivery assignment found for this order" });
    }

    if (assignment.deliveryPersonId !== req.userId) {
      return res.status(403).json({ error: "This delivery is not assigned to you" });
    }

    const orderForOtp = await db.orm.public.Order.where({ id: orderId }).first();
    if (
      orderForOtp &&
      orderForOtp.orderType === "logistics_booking" &&
      status === "picked_up" &&
      !orderForOtp.rideOtpVerifiedAt
    ) {
      if (!otp || otp !== orderForOtp.rideOtp) {
        return res.status(400).json({ error: "Incorrect or missing ride start OTP" });
      }
      await db.orm.public.Order.where({ id: orderForOtp.id }).update({
        rideOtpVerifiedAt: new Date().toISOString(),
        rideOtp: null,
      });
    }

    if (
      orderForOtp &&
      orderForOtp.orderType === "vehicle_rental" &&
      status === "picked_up" &&
      !orderForOtp.rentalStartOtpVerifiedAt
    ) {
      if (!otp || otp !== orderForOtp.rentalStartOtp) {
        return res.status(400).json({ error: "Incorrect or missing rental start OTP" });
      }
      await db.orm.public.Order.where({ id: orderForOtp.id }).update({
        rentalStartOtpVerifiedAt: new Date().toISOString(),
        rentalStartOtp: null,
      });
    }

    if (
      orderForOtp &&
      orderForOtp.orderType === "vehicle_rental" &&
      status === "delivered" &&
      !orderForOtp.rentalEndOtpVerifiedAt
    ) {
      if (!otp || otp !== orderForOtp.rentalEndOtp) {
        return res.status(400).json({ error: "Incorrect or missing rental end OTP" });
      }
      await db.orm.public.Order.where({ id: orderForOtp.id }).update({
        rentalEndOtpVerifiedAt: new Date().toISOString(),
        rentalEndOtp: null,
      });
    }

    const updatedAssignment = await db.transaction(async (tx) => {
      const updated = await tx.orm.public.DeliveryAssignment.where({ id: assignment.id }).update({ status });

      if (status === "delivered") {
        await tx.orm.public.Order.where({ id: orderId }).update({ status: "delivered" });
      }

      return updated;
    });

    res.status(200).json(updatedAssignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/orders/:id/tracking", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyerId !== req.userId && order.sellerId !== req.userId) {
      return res.status(403).json({ error: "You are not part of this order" });
    }

    if (order.deliveryMode === "local") {
      const assignment = await db.orm.public.DeliveryAssignment.where({ orderId }).first();

      return res.status(200).json({
        deliveryMode: "local",
        orderStatus: order.status,
        deliveryStatus: assignment?.status ?? null,
      });
    }

    if (order.deliveryMode === "courier") {
      return res.status(200).json({
        deliveryMode: "courier",
        orderStatus: order.status,
        courierName: order.courierName,
        trackingNumber: order.trackingNumber,
      });
    }

    res.status(200).json({
      deliveryMode: null,
      orderStatus: order.status,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/orders/:id/return", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: "reason is required" });
    }

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyerId !== req.userId) {
      return res.status(403).json({ error: "You are not the buyer for this order" });
    }

    if (order.status !== "delivered") {
      return res.status(400).json({ error: "Can only return delivered orders" });
    }

    const existing = await db.orm.public.ReturnRequest.where({ orderId: order.id }).first();

    if (existing) {
      return res.status(400).json({ error: "A return has already been requested for this order" });
    }

    const returnRequest = await db.orm.public.ReturnRequest.create({
      orderId: order.id,
      reason,
      requestedById: req.userId!,
    });

    await db.orm.public.Notification.create({
      message: `A return was requested for order #${order.id}: ${reason}`,
      type: "return_requested",
      userId: order.sellerId,
    });

    res.status(201).json(returnRequest);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/returns/:id/decide", requireAuth, async (req: AuthRequest, res) => {
  try {
    const returnId = Number(req.params.id);
    const { decision } = req.body;

    if (decision !== "approved" && decision !== "rejected") {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    const returnRequest = await db.orm.public.ReturnRequest.where({ id: returnId }).first();

    if (!returnRequest) {
      return res.status(404).json({ error: "Return request not found" });
    }

    const order = await db.orm.public.Order.where({ id: returnRequest.orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.sellerId !== req.userId && req.userRole !== "admin") {
      return res.status(403).json({ error: "Only the seller or an admin can decide on this return" });
    }

    if (returnRequest.status !== "requested") {
      return res.status(400).json({ error: `This return has already been ${returnRequest.status}` });
    }

    if (decision === "rejected") {
      const updated = await db.orm.public.ReturnRequest.where({ id: returnRequest.id }).update({ status: "rejected" });

      await db.orm.public.Notification.create({
        message: `Your return request for order #${order.id} was rejected`,
        type: "return_rejected",
        userId: order.buyerId,
      });

      return res.status(200).json(updated);
    }

    const buyer = await db.orm.public.User.where({ id: order.buyerId }).first();

    const updated = await db.transaction(async (tx) => {
      if (buyer) {
        await tx.orm.public.User.where({ id: buyer.id }).update({
          walletBalance: buyer.walletBalance + order.amount,
        });

        await tx.orm.public.WalletTransaction.create({
          amount: order.amount,
          type: "credit",
          reason: "return_refund",
          userId: buyer.id,
        });
      }

      if (order.orderType === "store_order") {
        const items = await tx.orm.public.OrderItem.where({ orderId: order.id }).all();
        for (const item of items) {
          const product = await tx.orm.public.Product.where({ id: item.productId }).first();
          if (product) {
            await tx.orm.public.Product.where({ id: product.id }).update({
              stock: product.stock + item.quantity,
            });
          }
        }
      }

      if (order.commissionAmount && order.commissionAmount > 0) {
        await tx.orm.public.PlatformEarning.create({
          type: "commission_reversal",
          amount: -order.commissionAmount,
          orderId: order.id,
        });
      }

      await tx.orm.public.Order.where({ id: order.id }).update({ status: "cancelled" });

      return tx.orm.public.ReturnRequest.where({ id: returnRequest.id }).update({ status: "completed" });
    });

    await db.orm.public.Notification.create({
      message: `Your return for order #${order.id} was approved and refunded`,
      type: "return_approved",
      userId: order.buyerId,
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/orders/:id/return", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyerId !== req.userId && order.sellerId !== req.userId) {
      return res.status(403).json({ error: "You are not part of this order" });
    }

    const returnRequest = await db.orm.public.ReturnRequest.where({ orderId }).first();

    res.status(200).json(returnRequest ?? null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/returns/for-seller", requireAuth, async (req: AuthRequest, res) => {
  try {
    const myOrders = await db.orm.public.Order.where({ sellerId: req.userId! }).all();
    const orderIds = myOrders.map((o) => o.id);

    const allReturns = await db.orm.public.ReturnRequest.where({ status: "requested" }).all();
    const myPendingReturns = allReturns.filter((r) => orderIds.includes(r.orderId));

    res.status(200).json(myPendingReturns);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/deliveries/:orderId/rate", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.orderId);
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyerId !== req.userId) {
      return res.status(403).json({ error: "You are not the buyer for this order" });
    }

    const assignment = await db.orm.public.DeliveryAssignment.where({ orderId }).first();

    if (!assignment) {
      return res.status(404).json({ error: "No delivery assignment found for this order" });
    }

    if (assignment.status !== "delivered") {
      return res.status(400).json({ error: "Can only rate a completed delivery" });
    }

    const existing = await db.orm.public.DeliveryRating.where({ deliveryAssignmentId: assignment.id }).first();

    if (existing) {
      return res.status(400).json({ error: "You have already rated this delivery" });
    }

    const deliveryRating = await db.orm.public.DeliveryRating.create({
      rating,
      comment,
      deliveryAssignmentId: assignment.id,
      customerId: req.userId!,
    });

    res.status(201).json(deliveryRating);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/deliveries/:orderId/tip", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.orderId);
    const { amount } = req.body;

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyerId !== req.userId) {
      return res.status(403).json({ error: "You are not the buyer for this order" });
    }

    const assignment = await db.orm.public.DeliveryAssignment.where({ orderId }).first();

    if (!assignment) {
      return res.status(404).json({ error: "No delivery assignment found for this order" });
    }

    if (assignment.status !== "delivered") {
      return res.status(400).json({ error: "Can only tip after delivery is completed" });
    }

    const existing = await db.orm.public.DeliveryTip.where({ deliveryAssignmentId: assignment.id }).first();

    if (existing) {
      return res.status(400).json({ error: "You have already tipped this delivery" });
    }

    const buyer = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!buyer || buyer.walletBalance < amount) {
      return res.status(400).json({ error: "Insufficient wallet balance for this tip" });
    }

    const tip = await db.transaction(async (tx) => {
      await tx.orm.public.User.where({ id: buyer.id }).update({
        walletBalance: buyer.walletBalance - amount,
      });

      await tx.orm.public.WalletTransaction.create({
        amount,
        type: "debit",
        reason: "delivery_tip",
        userId: buyer.id,
      });

      const deliveryPerson = await tx.orm.public.User.where({ id: assignment.deliveryPersonId }).first();

      if (deliveryPerson) {
        await tx.orm.public.User.where({ id: deliveryPerson.id }).update({
          walletBalance: deliveryPerson.walletBalance + amount,
        });

        await tx.orm.public.WalletTransaction.create({
          amount,
          type: "credit",
          reason: "delivery_tip",
          userId: deliveryPerson.id,
        });
      }

      return tx.orm.public.DeliveryTip.create({
        amount,
        deliveryAssignmentId: assignment.id,
        customerId: buyer.id,
        deliveryPersonId: assignment.deliveryPersonId,
      });
    });

    await db.orm.public.Notification.create({
      message: `You received a ₹${amount} tip for a delivery!`,
      type: "tip_received",
      userId: assignment.deliveryPersonId,
    });

    res.status(201).json(tip);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/orders/:id/deliver", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    const { otp } = req.body;

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyerId !== req.userId) {
      return res.status(403).json({ error: "You are not the buyer for this order" });
    }

    if (order.status !== "shipped") {
      return res.status(400).json({ error: `Cannot mark as delivered an order with status "${order.status}"` });
    }
    if (order.otpRequired && !order.deliveryOtpVerifiedAt) {
      if (!otp || otp !== order.deliveryOtp) {
        return res.status(400).json({ error: "Incorrect or missing delivery OTP" });
      }
    }

    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({ status: "delivered", deliveryOtpVerifiedAt: order.otpRequired ? new Date().toISOString() : order.deliveryOtpVerifiedAt, deliveryOtp: order.otpRequired ? null : order.deliveryOtp });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/orders/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    const { reason } = req.body;

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const isBuyer = order.buyerId === req.userId;
    const isSeller = order.sellerId === req.userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ error: "You are not part of this order" });
    }

    if (order.status !== "confirmed") {
      return res.status(400).json({ error: `Cannot cancel an order with status "${order.status}"` });
    }

    if (order.isPaid) {
      const buyer = await db.orm.public.User.where({ id: order.buyerId }).first();

      if (buyer) {
        await db.transaction(async (tx) => {
          await tx.orm.public.User.where({ id: buyer.id }).update({
            walletBalance: buyer.walletBalance + order.amount,
          });

          await tx.orm.public.WalletTransaction.create({
            amount: order.amount,
            type: "credit",
            reason: "order_cancelled_refund",
            userId: buyer.id,
          });
        });
      }
    }

        if (order.orderType === "store_order") {
      const items = await db.orm.public.OrderItem.where({ orderId: order.id }).all();

      await db.transaction(async (tx) => {
        for (const item of items) {
          const product = await tx.orm.public.Product.where({ id: item.productId }).first();
          if (product) {
            await tx.orm.public.Product.where({ id: product.id }).update({
              stock: product.stock + item.quantity,
            });
          }
        }
      });
    }

        if (order.commissionAmount && order.commissionAmount > 0) {
      await db.orm.public.PlatformEarning.create({
        type: "commission_reversal",
        amount: -order.commissionAmount,
        orderId: order.id,
      });
    }
    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({ status: "cancelled" });

    const notifyUserId = isBuyer ? order.sellerId : order.buyerId;

    await db.orm.public.Notification.create({
      message: `Order #${order.id} was cancelled${reason ? `: ${reason}` : ""}`,
      type: "order_cancelled",
      userId: notifyUserId,
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/orders/:id/review", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyerId !== req.userId) {
      return res.status(403).json({ error: "You are not the buyer for this order" });
    }

    if (order.status !== "delivered" && order.status !== "completed") {
      return res.status(400).json({ error: "Can only review delivered or completed orders" });
    }

    const existingReviews = await db.orm.public.Review.where({ orderId: order.id }).all();
    const buyerAlreadyReviewed = existingReviews.some((r) => r.reviewerId === order.buyerId);

    if (buyerAlreadyReviewed) {
      return res.status(400).json({ error: "You have already reviewed this seller for this order" });
    }

    const review = await db.orm.public.Review.create({
      rating,
      comment,
      orderId: order.id,
      reviewerId: order.buyerId,
      revieweeId: order.sellerId,
    });

    res.status(201).json(review);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/orders/:id/review-buyer", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.sellerId !== req.userId) {
      return res.status(403).json({ error: "You are not the seller for this order" });
    }

    if (order.status !== "delivered" && order.status !== "completed") {
      return res.status(400).json({ error: "Can only review delivered or completed orders" });
    }

    const existingReviews = await db.orm.public.Review.where({ orderId: order.id }).all();
    const sellerAlreadyReviewed = existingReviews.some((r) => r.reviewerId === order.sellerId);

    if (sellerAlreadyReviewed) {
      return res.status(400).json({ error: "You have already reviewed this buyer for this order" });
    }

    const review = await db.orm.public.Review.create({
      rating,
      comment,
      orderId: order.id,
      reviewerId: order.sellerId,
      revieweeId: order.buyerId,
    });

    res.status(201).json(review);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/users/:id/order-history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.id);

    const user = await db.orm.public.User.where({ id: userId }).first();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const ordersAsBuyer = await db.orm.public.Order.where({ buyerId: userId }).all();

    const reviews = await db.orm.public.Review.where({ revieweeId: userId }).all();

    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

    res.status(200).json({
      userId: user.id,
      name: user.name,
      averageRating,
      totalReviews: reviews.length,
      totalOrders: ordersAsBuyer.length,
      completedOrders: ordersAsBuyer.filter((o) => o.status === "delivered" || o.status === "paid").length,
      orders: ordersAsBuyer,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/users/:id/reviews", async (req, res) => {
  try {
    const revieweeId = Number(req.params.id);

    const reviews = await db.orm.public.Review.where({ revieweeId }).all();

    res.status(200).json(reviews);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/users/:id/profile", async (req, res) => {
  try {
    const userId = Number(req.params.id);

    const user = await db.orm.public.User.where({ id: userId }).first();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const reviews = await db.orm.public.Review.where({ revieweeId: userId }).all();

    const completedOrders = await db.orm.public.Order.where({
      sellerId: userId,
      status: "delivered",
    }).all();

    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      user: userWithoutPassword,
      averageRating,
      totalReviews: reviews.length,
      completedOrders: completedOrders.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/settings/booking-fee", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access only" });
    }

    const { amount } = req.body;

    const existing = await db.orm.public.PlatformSetting.where({ key: "booking_fee" }).first();

    if (existing) {
      const updated = await db.orm.public.PlatformSetting.where({ id: existing.id }).update({
        value: String(amount),
      });
      return res.status(200).json(updated);
    }

    const setting = await db.orm.public.PlatformSetting.create({
      key: "booking_fee",
      value: String(amount),
    });

    res.status(201).json(setting);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
app.post("/admin/settings/commission", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access only" });
    }

    const { percent } = req.body;

    if (typeof percent !== "number" || percent < 0 || percent > 100) {
      return res.status(400).json({ error: "percent must be between 0 and 100" });
    }

    const existing = await db.orm.public.PlatformSetting.where({ key: "commission_percent" }).first();

    if (existing) {
      const updated = await db.orm.public.PlatformSetting.where({ id: existing.id }).update({
        value: String(percent),
      });
      return res.status(200).json(updated);
    }

    const setting = await db.orm.public.PlatformSetting.create({
      key: "commission_percent",
      value: String(percent),
    });

    res.status(201).json(setting);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/wallet/adjust", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access only" });
    }

    const { userId, amount, type, reason } = req.body;

    if (!userId || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "userId and a positive amount are required" });
    }

    if (type !== "credit" && type !== "debit") {
      return res.status(400).json({ error: "type must be 'credit' or 'debit'" });
    }

    const user = await db.orm.public.User.where({ id: userId }).first();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (type === "debit" && user.walletBalance < amount) {
      return res.status(400).json({ error: "User does not have enough balance for this debit" });
    }

    const newBalance = type === "credit" ? user.walletBalance + amount : user.walletBalance - amount;

    const transaction = await db.transaction(async (tx) => {
      await tx.orm.public.User.where({ id: user.id }).update({ walletBalance: newBalance });

      return tx.orm.public.WalletTransaction.create({
        amount,
        type,
        reason: reason ?? "admin_adjustment",
        userId: user.id,
      });
    });

    await db.orm.public.Notification.create({
      message: `An admin ${type === "credit" ? "added" : "deducted"} ₹${amount} ${type === "credit" ? "to" : "from"} your wallet${reason ? `: ${reason}` : ""}`,
      type: "wallet_adjustment",
      userId: user.id,
    });

    res.status(200).json({ newBalance, transaction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/gst-rates", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access only" });
    }

    const { category, ratePercent } = req.body;

    if (!category || typeof ratePercent !== "number" || ratePercent < 0) {
      return res.status(400).json({ error: "category and a non-negative ratePercent are required" });
    }

    const existing = await db.orm.public.GstRate.where({ category }).first();

    if (existing) {
      const updated = await db.orm.public.GstRate.where({ id: existing.id }).update({ ratePercent });
      return res.status(200).json(updated);
    }

    const gstRate = await db.orm.public.GstRate.create({ category, ratePercent });
    res.status(201).json(gstRate);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/gst-rates", async (req, res) => {
  try {
    const rates = await db.orm.public.GstRate.where({}).all();
    res.status(200).json(rates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/wallet/topup", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than 0" });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `topup_${req.userId}_${Date.now()}`,
    });

        await db.orm.public.RazorpayOrderMapping.create({
      razorpayOrderId: razorpayOrder.id,
      purpose: "wallet_topup",
      referenceId: req.userId!,
      userId: req.userId!,
      amount,
    });

    res.status(200).json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/wallet/verify-topup", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, amount } = req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    const alreadyProcessed = await db.orm.public.ProcessedPayment.where({ razorpayPaymentId }).first();

    if (alreadyProcessed) {
      return res.status(400).json({ error: "This payment has already been processed" });
    }

    await db.orm.public.ProcessedPayment.create({ razorpayPaymentId });

    const user = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const newBalance = await db.transaction(async (tx) => {
      await tx.orm.public.User.where({ id: user.id }).update({
        walletBalance: user.walletBalance + amount,
      });

      await tx.orm.public.WalletTransaction.create({
        amount,
        type: "credit",
        reason: "topup",
        userId: user.id,
      });

      return user.walletBalance + amount;
    });

    res.status(200).json({ newBalance });


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/wallet", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const transactions = await db.orm.public.WalletTransaction.where({ userId: req.userId! }).all();

    res.status(200).json({
      balance: user.walletBalance,
      transactions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/orders/:id/pay", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyerId !== req.userId) {
      return res.status(403).json({ error: "You are not the buyer for this order" });
    }

    const demand = await db.orm.public.Demand.where({ id: order.demandId }).first();

    const alreadyPaidFee = demand?.bookingFeePaid ? (demand.bookingFeeAmount ?? 0) : 0;
    const amountDue = order.amount - alreadyPaidFee;

    if (amountDue <= 0) {
      return res.status(400).json({ error: "Nothing left to pay for this order" });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: amountDue * 100,
      currency: "INR",
      receipt: `order_${order.id}`,
    });

        await db.orm.public.RazorpayOrderMapping.create({
      razorpayOrderId: razorpayOrder.id,
      purpose: "order_payment",
      referenceId: order.id,
      userId: req.userId!,
      amount: amountDue,
    });

    res.status(200).json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      amountDue,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/orders/:id/verify-payment", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyerId !== req.userId) {
      return res.status(403).json({ error: "You are not the buyer for this order" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    const alreadyProcessed = await db.orm.public.ProcessedPayment.where({ razorpayPaymentId }).first();

    if (alreadyProcessed) {
      return res.status(400).json({ error: "This payment has already been processed" });
    }

    await db.orm.public.ProcessedPayment.create({ razorpayPaymentId });

    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({ isPaid: true });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/webhooks/razorpay", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(req.body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === "payment.captured") {
      const razorpayPaymentId = event.payload.payment.entity.id;
      const razorpayOrderId = event.payload.payment.entity.order_id;

      const alreadyProcessed = await db.orm.public.ProcessedPayment.where({ razorpayPaymentId }).first();

      if (alreadyProcessed) {
        return res.status(200).json({ message: "Already processed" });
      }

      const mapping = await db.orm.public.RazorpayOrderMapping.where({ razorpayOrderId }).first();

      if (!mapping) {
        console.error("No mapping found for Razorpay order:", razorpayOrderId);
        return res.status(200).json({ message: "No mapping found, ignoring" });
      }

      await db.orm.public.ProcessedPayment.create({ razorpayPaymentId });

      if (mapping.purpose === "order_payment") {
        await db.orm.public.Order.where({ id: mapping.referenceId }).update({ isPaid: true });
      } else if (mapping.purpose === "wallet_topup") {
        const user = await db.orm.public.User.where({ id: mapping.userId }).first();
        if (user) {
          await db.transaction(async (tx) => {
            await tx.orm.public.User.where({ id: user.id }).update({
              walletBalance: user.walletBalance + mapping.amount,
            });
            await tx.orm.public.WalletTransaction.create({
              amount: mapping.amount,
              type: "credit",
              reason: "topup",
              userId: user.id,
            });
          });
        }
      } else if (mapping.purpose === "booking_fee") {
        await db.orm.public.Demand.where({ id: mapping.referenceId }).update({
          status: "open",
          bookingFeePaid: true,
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

app.post("/orders/:id/generate-invoice", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    const { buyerGstin } = req.body;

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyerId !== req.userId && order.sellerId !== req.userId) {
      return res.status(403).json({ error: "You are not part of this order" });
    }

    const existing = await db.orm.public.GstInvoice.where({ orderId: order.id }).first();

    if (existing) {
      return res.status(200).json(existing);
    }

    const gstAmount = order.gstAmount ?? 0;
    const baseAmount = order.amount - gstAmount;
    const invoiceNumber = `INV-${order.id}-${Date.now()}`;

    const invoice = await db.orm.public.GstInvoice.create({
      orderId: order.id,
      invoiceNumber,
      buyerGstin: buyerGstin ?? null,
      baseAmount,
      gstAmount,
      totalAmount: order.amount,
    });

    res.status(201).json(invoice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/orders/:id/invoice", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyerId !== req.userId && order.sellerId !== req.userId) {
      return res.status(403).json({ error: "You are not part of this order" });
    }

    const invoice = await db.orm.public.GstInvoice.where({ orderId }).first();

    if (!invoice) {
      return res.status(404).json({ error: "No invoice generated for this order yet" });
    }

    res.status(200).json(invoice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});



app.get("/notifications", requireAuth, async (req: AuthRequest, res) => {
  try {
    const notifications = await db.orm.public.Notification.where({ userId: req.userId! }).all();
    res.status(200).json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/notifications/:id/read", requireAuth, async (req: AuthRequest, res) => {
  try {
    const notificationId = Number(req.params.id);

    const notification = await db.orm.public.Notification.where({ id: notificationId }).first();

    if (!notification || notification.userId !== req.userId) {
      return res.status(404).json({ error: "Notification not found" });
    }

    const updated = await db.orm.public.Notification.where({ id: notificationId }).update({ isRead: true });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/kyc/upload", requireAuth, upload.single("document"), async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "delivery") {
      return res.status(403).json({ error: "KYC is only required for sellers and delivery persons" });
    }

    const { documentType, documentNumber } = req.body;

    if (!documentType) {
      return res.status(400).json({ error: "documentType is required" });
    }

    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const doc = await db.transaction(async (tx) => {
      const kycDoc = await tx.orm.public.KycDocument.create({
        documentType,
        documentNumber,
        fileUrl,
        userId: req.userId!,
      });

      await tx.orm.public.User.where({ id: req.userId! }).update({ kycStatus: "pending" });

      return kycDoc;
    });

    res.status(201).json(doc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/kyc/file/:docId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const docId = Number(req.params.docId);

    const doc = await db.orm.public.KycDocument.where({ id: docId }).first();

    if (!doc || !doc.fileUrl) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (doc.userId !== req.userId && req.userRole !== "admin") {
      return res.status(403).json({ error: "You do not have permission to view this document" });
    }

    const filePath = doc.fileUrl.replace("/uploads/", "");
    res.sendFile(filePath, { root: "uploads" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/kyc/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const docs = await db.orm.public.KycDocument.where({ userId: req.userId! }).all();
    const user = await db.orm.public.User.where({ id: req.userId! }).first();

    res.status(200).json({ kycStatus: user?.kycStatus, documents: docs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/admin/kyc/pending", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access only" });
    }

    const docs = await db.orm.public.KycDocument.where({ status: "pending" }).all();
    res.status(200).json(docs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/kyc/:id/decide", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access only" });
    }

    const docId = Number(req.params.id);
    const { decision, rejectionReason } = req.body;

    if (decision !== "approved" && decision !== "rejected") {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    const doc = await db.orm.public.KycDocument.where({ id: docId }).first();

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const updatedDoc = await db.transaction(async (tx) => {
      const updated = await tx.orm.public.KycDocument.where({ id: docId }).update({
        status: decision,
        rejectionReason: decision === "rejected" ? rejectionReason ?? null : null,
      });

      const allDocs = await tx.orm.public.KycDocument.where({ userId: doc.userId }).all();
      const allApproved = allDocs.every((d) => d.id === docId ? decision === "approved" : d.status === "approved");
      const anyRejected = allDocs.some((d) => d.id === docId ? decision === "rejected" : d.status === "rejected");

      const overallStatus = anyRejected ? "rejected" : allApproved ? "approved" : "pending";

      await tx.orm.public.User.where({ id: doc.userId }).update({ kycStatus: overallStatus });

      return updated;
    });

    await db.orm.public.Notification.create({
      message: `Your KYC document (${doc.documentType}) was ${decision}${rejectionReason ? `: ${rejectionReason}` : ""}`,
      type: "kyc_decision",
      userId: doc.userId,
    });

    res.status(200).json(updatedDoc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/stores", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can create stores" });
    }

    const { name, address, latitude, longitude, deliveryFeeBase, deliveryFeePerKm } = req.body;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const store = await db.orm.public.Store.create({
      name,
      address,
      latitude,
      longitude,
      deliveryFeeBase: deliveryFeeBase ?? 0,
      deliveryFeePerKm: deliveryFeePerKm ?? 0,
      sellerId: req.userId!,
    });

    res.status(201).json(store);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/sellers/:id/stores", async (req, res) => {
  try {
    const sellerId = Number(req.params.id);
    const stores = await db.orm.public.Store.where({ sellerId, isActive: true }).all();
    res.status(200).json(stores);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/products/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can view their own products" });
    }

    const ownedStores = await db.orm.public.Store.where({ sellerId: req.userId! }).all();
    const accessEntries = await db.orm.public.StoreAccess.where({ userId: req.userId! }).all();

    const storeIds = new Set<number>();
    ownedStores.forEach((s: any) => storeIds.add(s.id));
    accessEntries.forEach((a: any) => storeIds.add(a.storeId));

    const productsByStore = await Promise.all(
      Array.from(storeIds).map((storeId) => db.orm.public.Product.where({ storeId, isActive: true }).all())
    );

    res.status(200).json(productsByStore.flat());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/products", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can add products" });
    }

    const { storeId, name, description, category, price, stock } = req.body;

    if (!storeId) {
      return res.status(400).json({ error: "storeId is required" });
    }

    if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({ error: "price must be a positive number" });
    }

    if (stock !== undefined && (typeof stock !== "number" || stock < 0)) {
      return res.status(400).json({ error: "stock must be a non-negative number" });
    }

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const isOwner = store.sellerId === req.userId;
    const hasAccess = isOwner || (await db.orm.public.StoreAccess.where({ storeId: store.id, userId: req.userId! }).first()) !== null;

    if (!hasAccess) {
      return res.status(403).json({ error: "You do not have access to manage this store" });
    }

    const product = await db.orm.public.Product.create({
      name,
      description,
      category: category || undefined,
      price,
      stock: stock ?? 0,
      storeId,
    });

    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/stores/:id/hygiene-photo", requireAuth, upload.single("photo"), async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can upload a hygiene photo" });
    }

    const storeId = Number(req.params.id);
    const photoFile = req.file;

    if (!photoFile) {
      return res.status(400).json({ error: "Please attach a photo" });
    }

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      fs.unlink(photoFile.path, () => {});
      return res.status(404).json({ error: "Store not found" });
    }

    const isOwner = store.sellerId === req.userId;
    const hasAccess = isOwner || (await db.orm.public.StoreAccess.where({ storeId: store.id, userId: req.userId! }).first()) !== null;

    if (!hasAccess) {
      fs.unlink(photoFile.path, () => {});
      return res.status(403).json({ error: "You do not have access to manage this store" });
    }

    const photo = await db.orm.public.HygienePhoto.create({
      storeId: store.id,
      photoPath: photoFile.path,
    });

    res.status(201).json(photo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/stores/:id/hygiene-status", async (req, res) => {
  try {
    const storeId = Number(req.params.id);

    const photos = await db.orm.public.HygienePhoto.where({ storeId }).all();

    let latest: { uploadedAt: string } | null = null;
    for (const p of photos) {
      if (!latest || new Date(p.uploadedAt) > new Date(latest.uploadedAt)) {
        latest = p;
      }
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const uploadedToday = latest ? new Date(latest.uploadedAt) > twentyFourHoursAgo : false;

    res.status(200).json({ uploadedToday, latestUploadedAt: latest ? latest.uploadedAt : null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/products/bulk-upload/template", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can access this" });
    }

    const XLSX = require("xlsx");

    const headers = ["name", "description", "category", "price", "stock"];
    const sampleRow = ["Sample Product", "A short description of the product", "fmcg", 199.5, 25];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=product-upload-template.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/products/bulk-upload", requireAuth, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can bulk upload products" });
    }

    const { storeId } = req.body;
    const uploadedFile = req.file;

    if (!storeId) {
      if (uploadedFile) fs.unlink(uploadedFile.path, () => {});
      return res.status(400).json({ error: "storeId is required" });
    }

    if (!uploadedFile) {
      return res.status(400).json({ error: "Please attach an Excel (.xlsx) file" });
    }

    const store = await db.orm.public.Store.where({ id: Number(storeId) }).first();

    if (!store) {
      fs.unlink(uploadedFile.path, () => {});
      return res.status(404).json({ error: "Store not found" });
    }

    const isOwner = store.sellerId === req.userId;
    const hasAccess = isOwner || (await db.orm.public.StoreAccess.where({ storeId: store.id, userId: req.userId! }).first()) !== null;

    if (!hasAccess) {
      fs.unlink(uploadedFile.path, () => {});
      return res.status(403).json({ error: "You do not have access to manage this store" });
    }

    const XLSX = require("xlsx");
    const workbook = XLSX.readFile(uploadedFile.path);
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

    fs.unlink(uploadedFile.path, () => {});

    if (rows.length === 0) {
      return res.status(400).json({ error: "The uploaded file has no product rows" });
    }

    const created: any[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const name = row.name ? String(row.name).trim() : "";
      const description: string | null = row.description ? String(row.description).trim() : null;
      const category: string | null = row.category ? String(row.category).trim() : null;
      const price = Number(row.price);
      const stock = row.stock !== null && row.stock !== undefined ? Number(row.stock) : 0;

      if (!name) {
        errors.push({ row: rowNumber, error: "name is required" });
        continue;
      }

      if (!price || price <= 0 || Number.isNaN(price)) {
        errors.push({ row: rowNumber, error: "price must be a positive number" });
        continue;
      }

      if (Number.isNaN(stock) || stock < 0) {
        errors.push({ row: rowNumber, error: "stock must be a non-negative number" });
        continue;
      }

      try {
        const product = await db.orm.public.Product.create({
          name,
          description,
          category,
          price,
          stock,
          storeId: store.id,
        });
        created.push(product);
      } catch (err) {
        errors.push({ row: rowNumber, error: "Failed to create product" });
      }
    }

    res.status(200).json({
      createdCount: created.length,
      totalRows: rows.length,
      errors,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/products/:id/remove", requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.id);

    const product = await db.orm.public.Product.where({ id: productId }).first();

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

       const store = await db.orm.public.Store.where({ id: product.storeId }).first();

    if (!store || store.sellerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this product" });
    }

    const updated = await db.orm.public.Product.where({ id: product.id }).update({ isActive: false });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});


app.get("/stores/:id", async (req, res) => {
  try {
    const storeId = Number(req.params.id);
    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    res.status(200).json({
      id: store.id,
      name: store.name,
      address: store.address,
      isActive: store.isActive,
      offersPrintService: store.offersPrintService,
      printPricePerPageBw: store.printPricePerPageBw,
      printPricePerPageColor: store.printPricePerPageColor,
      fssaiLicenseNumber: store.fssaiLicenseNumber,
      businessRegistrationNumber: store.businessRegistrationNumber,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/stores/:id/license-info", requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.id);
    const { fssaiLicenseNumber, businessRegistrationNumber } = req.body;

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const hasAccess =
      store.sellerId === req.userId ||
      (await db.orm.public.StoreAccess.where({ storeId, userId: req.userId! }).first()) !== null;

    if (!hasAccess) {
      return res.status(403).json({ error: "You do not have access to manage this store" });
    }

    const updated = await db.orm.public.Store.where({ id: storeId }).update({
      fssaiLicenseNumber: fssaiLicenseNumber || null,
      businessRegistrationNumber: businessRegistrationNumber || null,
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/stores/:id/products", async (req, res) => {
  try {
    const storeId = Number(req.params.id);
    const { search } = req.query;

    let products = await db.orm.public.Product.where({ storeId, isActive: true }).all();

    if (search) {
      const term = String(search).toLowerCase();
      products = products.filter((p) => p.name.toLowerCase().includes(term));
    }

    res.status(200).json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/professional-skills", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "professional") {
      return res.status(403).json({ error: "Only professionals can add skills" });
    }

    const { skillName, category, hourlyRate } = req.body;

    if (!skillName) {
      return res.status(400).json({ error: "skillName is required" });
    }

    if (typeof hourlyRate !== "number" || hourlyRate <= 0) {
      return res.status(400).json({ error: "hourlyRate must be a positive number" });
    }

    const skill = await db.orm.public.ProfessionalSkill.create({
      skillName,
      category: category || undefined,
      hourlyRate,
      professionalId: req.userId!,
    });

    res.status(201).json(skill);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/professional-skills/:id/remove", requireAuth, async (req: AuthRequest, res) => {
  try {
    const skillId = Number(req.params.id);

    const skill = await db.orm.public.ProfessionalSkill.where({ id: skillId }).first();

    if (!skill) {
      return res.status(404).json({ error: "Skill not found" });
    }

    if (skill.professionalId !== req.userId) {
      return res.status(403).json({ error: "You do not own this skill" });
    }

    const updated = await db.orm.public.ProfessionalSkill.where({ id: skill.id }).update({ isActive: false });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/professional-skills/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const skills = await db.orm.public.ProfessionalSkill.where({ professionalId: req.userId!, isActive: true }).all();
    res.status(200).json(skills);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/professional-skills/search", async (req, res) => {
  try {
    const { category, search } = req.query;

    const filters: Record<string, unknown> = { isActive: true };

    if (category) {
      filters.category = category;
    }

    let skills = await db.orm.public.ProfessionalSkill.where(filters).all();

    if (search) {
      const term = String(search).toLowerCase();
      skills = skills.filter((s) => s.skillName.toLowerCase().includes(term));
    }

    const professionalIds = [...new Set(skills.map((s) => s.professionalId))];
    const professionals = await Promise.all(
      professionalIds.map((id) => db.orm.public.User.where({ id }).first())
    );

    const results = skills.map((skill) => {
      const professional = professionals.find((p) => p?.id === skill.professionalId);
      return {
        ...skill,
        professionalName: professional?.name ?? "Unknown",
      };
    });

    res.status(200).json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
app.get("/stores/nearby", async (req, res) => {
  try {
    const { latitude, longitude, radiusKm } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: "latitude and longitude are required" });
    }

    const lat = Number(latitude);
    const lon = Number(longitude);
    const maxRadius = radiusKm ? Number(radiusKm) : 10;

    const allStores = await db.orm.public.Store.where({ isActive: true }).all();

    const nearby = allStores
      .filter((s) => s.latitude !== null && s.longitude !== null)
      .map((s) => {
        const R = 6371;
        const dLat = ((s.latitude! - lat) * Math.PI) / 180;
        const dLon = ((s.longitude! - lon) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat * Math.PI) / 180) *
            Math.cos((s.latitude! * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { ...s, distanceKm: Math.round(R * c * 10) / 10 };
      })
      .filter((s) => s.distanceKm <= maxRadius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.status(200).json(nearby);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/products/prescription-scan", requireAuth, upload.single("photo"), async (req: AuthRequest, res) => {
  try {
    const photoFile = req.file;

    if (!photoFile) {
      return res.status(400).json({ error: "Please attach a photo of the prescription" });
    }

    const imageBuffer = fs.readFileSync(photoFile.path);
    const base64Image = imageBuffer.toString("base64");
    const ext = path.extname(photoFile.originalname).toLowerCase();
    const mimeTypeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };
    const mimeType = mimeTypeMap[ext] || "image/jpeg";

    const promptText = `This is a photo of a medical prescription. Read the medicine names written or printed on it. Respond ONLY with JSON in this exact shape, no other text, no markdown fences:
{
  "medicines": ["medicine name 1", "medicine name 2"]
}
If you cannot read any medicine names clearly, respond with { "medicines": [] }. Do not guess or invent medicine names that are not visible in the image.`;

    const parts = [
      { text: promptText },
      { inline_data: { mime_type: mimeType, data: base64Image } },
    ];

    async function callGemini(): Promise<Response> {
      const maxAttempts = 3;
      let lastResponse: Response | null = null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": process.env.GEMINI_API_KEY!,
            },
            body: JSON.stringify({ contents: [{ parts }] }),
          }
        );

        if (response.ok) return response;

        lastResponse = response;
        if (response.status === 503 || response.status === 429) {
          const waitMs = 500 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        break;
      }

      return lastResponse!;
    }

    const aiResponse = await callGemini();
    fs.unlink(photoFile.path, () => {});

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Gemini API error:", errText);
      const isOverloaded = aiResponse.status === 503 || aiResponse.status === 429;
      return res.status(502).json({
        error: isOverloaded
          ? "The scanning service is busy right now — please try again in a moment, or search manually."
          : "Could not scan the prescription right now",
      });
    }

    const aiData = await aiResponse.json();
    const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let result;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse prescription scan response:", rawText);
      return res.status(502).json({ error: "Could not read the prescription, please try a clearer photo" });
    }

    res.json({ medicines: Array.isArray(result.medicines) ? result.medicines : [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
app.get("/products/search", async (req, res) => {
  try {
    const { search, maxPrice, category } = req.query;

    let products = await db.orm.public.Product.where({ isActive: true }).all();

    if (search) {
      const term = String(search).toLowerCase();
      products = products.filter(
        (p) => p.name.toLowerCase().includes(term) || (p.description ?? "").toLowerCase().includes(term)
      );
    }

    if (maxPrice) {
      const max = Number(maxPrice);
      products = products.filter((p) => p.price <= max);
    }

    if (category) {
      const cat = String(category).toLowerCase();
      products = products.filter((p) => (p.category ?? "").toLowerCase() === cat);
    }

    res.status(200).json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/products/:id/rate", requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.id);
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const product = await db.orm.public.Product.where({ id: productId }).first();

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const existing = await db.orm.public.ProductRating.where({
      productId,
      customerId: req.userId!,
    }).first();

    if (existing) {
      return res.status(400).json({ error: "You have already rated this product" });
    }

    const productRating = await db.orm.public.ProductRating.create({
      rating,
      comment,
      productId,
      customerId: req.userId!,
    });

    res.status(201).json(productRating);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const productId = Number(req.params.id);

    const product = await db.orm.public.Product.where({ id: productId }).first();

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const ratings = await db.orm.public.ProductRating.where({ productId }).all();

    const averageRating =
      ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : null;

    res.status(200).json({
      ...product,
      averageRating,
      totalRatings: ratings.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/store-orders", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { storeId, items, deliveryLatitude, deliveryLongitude, deliveryAddress } = req.body;

    if (!storeId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "storeId and a non-empty items array are required" });
    }

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store || !store.isActive) {
      return res.status(404).json({ error: "Store not found" });
    }

    let subtotal = 0;
    let hasJewellery = false;
    let hasFood = false;
    const validatedItems: { productId: number; quantity: number; priceAtPurchase: number }[] = [];

    for (const item of items) {
      const { productId, quantity } = item;

      if (!productId || !quantity || quantity <= 0) {
        return res.status(400).json({ error: "Each item needs a valid productId and quantity" });
      }

      const product = await db.orm.public.Product.where({ id: productId }).first();

      if (!product || !product.isActive || product.storeId !== storeId) {
        return res.status(400).json({ error: `Product ${productId} is not available in this store` });
      }

      if (product.stock < quantity) {
        return res.status(400).json({ error: `Not enough stock for "${product.name}" (only ${product.stock} left)` });
      }

      subtotal += product.price * quantity;
      validatedItems.push({ productId, quantity, priceAtPurchase: product.price });
      if (product.category === "jewellery") hasJewellery = true;
      if (product.category === "food") hasFood = true;
    }

    if (hasFood) {
      const foodPhotos = await db.orm.public.HygienePhoto.where({ storeId: store.id }).all();
      let latestFoodPhoto: { uploadedAt: string } | null = null;
      for (const p of foodPhotos) {
        if (!latestFoodPhoto || new Date(p.uploadedAt) > new Date(latestFoodPhoto.uploadedAt)) {
          latestFoodPhoto = p;
        }
      }
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const hygieneCurrent = latestFoodPhoto ? new Date(latestFoodPhoto.uploadedAt) > twentyFourHoursAgo : false;

      if (!hygieneCurrent) {
        return res.status(400).json({ error: "This store has not uploaded today's kitchen hygiene photo yet. Food orders cannot be placed until they do." });
      }
    }

    const { couponCode } = req.body;
    let appliedCoupon: { id: number; code: string; rewardType: string; discountAmount: number } | null = null;

    if (couponCode) {
      const coupon = await db.orm.public.Coupon.where({ code: String(couponCode).trim().toUpperCase() }).first();

      if (!coupon || !coupon.isActive) {
        return res.status(400).json({ error: "Invalid or inactive coupon code" });
      }

      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return res.status(400).json({ error: "This coupon has expired" });
      }

      if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
        return res.status(400).json({ error: `This coupon requires a minimum order of Rs.${coupon.minOrderAmount}` });
      }

      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({ error: "This coupon has reached its usage limit" });
      }

      if (coupon.perUserLimit) {
        const previousUses = await db.orm.public.CouponRedemption.where({ couponId: coupon.id, userId: req.userId! }).all();
        if (previousUses.length >= coupon.perUserLimit) {
          return res.status(400).json({ error: "You have already used this coupon the maximum number of times" });
        }
      }

      let rawAmount = coupon.valueType === "percent" ? Math.round((subtotal * coupon.value) / 100) : coupon.value;

      if (coupon.maxDiscount && rawAmount > coupon.maxDiscount) {
        rawAmount = coupon.maxDiscount;
      }

      if (rawAmount > subtotal) {
        rawAmount = subtotal;
      }

      appliedCoupon = { id: coupon.id, code: coupon.code, rewardType: coupon.rewardType, discountAmount: rawAmount };
    }

    let deliveryFeeAmount = store.deliveryFeeBase;

    if (deliveryLatitude && deliveryLongitude && store.latitude && store.longitude) {
      const distanceKm = await calculateRoadDistanceKm(
        store.latitude,
        store.longitude,
        deliveryLatitude,
        deliveryLongitude
      );
      deliveryFeeAmount = store.deliveryFeeBase + Math.round(distanceKm * store.deliveryFeePerKm);
    }

    const discountAmount = appliedCoupon && appliedCoupon.rewardType === "discount" ? appliedCoupon.discountAmount : 0;
    const totalAmount = subtotal + deliveryFeeAmount - discountAmount;

    const checkoutOtp = hasJewellery ? Math.floor(100000 + Math.random() * 900000).toString() : null;

        const { gstCategory } = req.body;

    const gstRate = gstCategory
      ? await db.orm.public.GstRate.where({ category: gstCategory }).first()
      : null;

    const gstRatePercent = gstRate?.ratePercent ?? 0;
    const gstAmount = Math.round((subtotal * gstRatePercent) / (100 + gstRatePercent));

    const commissionSetting = await db.orm.public.PlatformSetting.where({ key: "commission_percent" }).first();
    const commissionPercent = commissionSetting ? Number(commissionSetting.value) : 0;
    const commissionAmount = Math.round((subtotal * commissionPercent) / 100);

    const order = await db.transaction(async (tx) => {
      const newOrder = await tx.orm.public.Order.create({
        orderType: "store_order",
        storeId,
        buyerId: req.userId!,
        sellerId: store.sellerId,
        amount: totalAmount,
        deliveryFeeAmount,
        gstCategory: gstCategory ?? null,
        gstRatePercent,
        gstAmount,
        commissionAmount,
        status: "confirmed",
        otpRequired: hasJewellery,
        checkoutOtp,
      });

            if (commissionAmount > 0) {
        await tx.orm.public.PlatformEarning.create({
          type: "commission",
          amount: commissionAmount,
          orderId: newOrder.id,
        });
      }

      if (appliedCoupon) {
        await tx.orm.public.CouponRedemption.create({
          couponId: appliedCoupon.id,
          userId: req.userId!,
          orderId: newOrder.id,
          amount: appliedCoupon.discountAmount,
        });

        const currentCoupon = await tx.orm.public.Coupon.where({ id: appliedCoupon.id }).first();

        if (currentCoupon) {
          await tx.orm.public.Coupon.where({ id: appliedCoupon.id }).update({
            usedCount: currentCoupon.usedCount + 1,
          });
        }

        if (appliedCoupon.rewardType === "cashback" && appliedCoupon.discountAmount > 0) {
          const buyer = await tx.orm.public.User.where({ id: req.userId! }).first();
          if (buyer) {
            await tx.orm.public.User.where({ id: buyer.id }).update({
              walletBalance: buyer.walletBalance + appliedCoupon.discountAmount,
            });

            await tx.orm.public.WalletTransaction.create({
              amount: appliedCoupon.discountAmount,
              type: "credit",
              reason: "cashback",
              userId: buyer.id,
            });
          }
        }
      }

      for (const item of validatedItems) {
        await tx.orm.public.OrderItem.create({
          orderId: newOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          priceAtPurchase: item.priceAtPurchase,
        });

        const product = await tx.orm.public.Product.where({ id: item.productId }).first();

        if (product) {
          await tx.orm.public.Product.where({ id: item.productId }).update({
            stock: product.stock - item.quantity,
          });
        }
      }

      return newOrder;
    });

    await db.orm.public.Notification.create({
      message: `New order #${order.id} received at your store "${store.name}"`,
      type: "new_store_order",
      userId: store.sellerId,
    });

    try {
      const buyerForRisk = await db.orm.public.User.where({ id: req.userId! }).first();

      if (buyerForRisk) {
        const accountAgeMs = Date.now() - new Date(buyerForRisk.createdAt).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (accountAgeMs < oneDayMs && totalAmount > 5000) {
          await db.orm.public.RiskFlag.create({
            entityType: "order",
            entityId: order.id,
            reason: "High-value order from a newly created account",
            severity: "high",
          });
        }

        const pastOrders = await db.orm.public.Order.where({ buyerId: buyerForRisk.id, orderType: "store_order" }).all();
        const previousOrders = pastOrders.filter((o: any) => o.id !== order.id);

        if (previousOrders.length >= 3) {
          const avgAmount = previousOrders.reduce((sum: number, o: any) => sum + o.amount, 0) / previousOrders.length;
          if (avgAmount > 0 && totalAmount > avgAmount * 5) {
            await db.orm.public.RiskFlag.create({
              entityType: "order",
              entityId: order.id,
              reason: "Order amount far exceeds this buyer's usual order size",
              severity: "medium",
            });
          }
        }
      }
    } catch (riskError) {
      console.error("Risk evaluation failed (non-blocking):", riskError);
    }

    res.status(201).json({
      ...order,
      items: validatedItems,
      subtotal,
      deliveryFeeAmount,
      discountAmount,
      totalAmount,
      couponApplied: appliedCoupon
        ? { code: appliedCoupon.code, rewardType: appliedCoupon.rewardType, amount: appliedCoupon.discountAmount }
        : null,
      devCheckoutOtp: hasJewellery ? checkoutOtp : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_STOCK:")) {
      return res.status(400).json({ error: "One or more items went out of stock during checkout" });
    }
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/orders/:id/verify-checkout-otp", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    const { otp } = req.body;

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyerId !== req.userId) {
      return res.status(403).json({ error: "You are not the buyer for this order" });
    }

    if (!order.otpRequired) {
      return res.status(400).json({ error: "This order does not require OTP verification" });
    }

    if (order.checkoutOtpVerifiedAt) {
      return res.status(400).json({ error: "This order's checkout OTP has already been verified" });
    }

    if (!otp || otp !== order.checkoutOtp) {
      return res.status(400).json({ error: "Incorrect OTP" });
    }

    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({
      checkoutOtpVerifiedAt: new Date().toISOString(),
      checkoutOtp: null,
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
app.post("/service-bookings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { professionalSkillId, scheduleType, hoursBooked, scheduledFor } = req.body;

    const allowedSchedules = ["instant", "today", "tomorrow", "weekly", "monthly"];

    if (!professionalSkillId) {
      return res.status(400).json({ error: "professionalSkillId is required" });
    }

    if (!scheduleType || !allowedSchedules.includes(scheduleType)) {
      return res.status(400).json({ error: `scheduleType must be one of: ${allowedSchedules.join(", ")}` });
    }

    if (typeof hoursBooked !== "number" || hoursBooked <= 0) {
      return res.status(400).json({ error: "hoursBooked must be a positive number" });
    }

    const skill = await db.orm.public.ProfessionalSkill.where({ id: professionalSkillId, isActive: true }).first();

    if (!skill) {
      return res.status(404).json({ error: "This skill is not available" });
    }

    const amount = skill.hourlyRate * hoursBooked;

    const order = await db.orm.public.Order.create({
      orderType: "service_booking",
      professionalSkillId,
      scheduleType,
      scheduledFor: scheduledFor || null,
      hoursBooked,
      buyerId: req.userId!,
      sellerId: skill.professionalId,
      amount,
      status: "confirmed",
    });

    await db.orm.public.Notification.create({
      message: `New booking for "${skill.skillName}" (${scheduleType}, ${hoursBooked}h)`,
      type: "new_service_booking",
      userId: skill.professionalId,
    });

    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/orders/:id/complete", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.orderType !== "service_booking") {
      return res.status(400).json({ error: "This route is only for service bookings" });
    }

    if (order.sellerId !== req.userId) {
      return res.status(403).json({ error: "You are not the professional for this booking" });
    }

    if (order.status !== "confirmed") {
      return res.status(400).json({ error: `Cannot complete a booking with status "${order.status}"` });
    }

    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({ status: "completed" });

    await db.orm.public.Notification.create({
      message: `Your booking #${order.id} has been marked as completed`,
      type: "service_completed",
      userId: order.buyerId,
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
app.post("/logistics-bookings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      vehicleType,
      pickupLatitude,
      pickupLongitude,
      pickupAddress,
      dropLatitude,
      dropLongitude,
      dropAddress,
      isFreight,
      weightKg,
      sizeCategory,
    } = req.body;

    const allowedVehicles = ["2w", "3w", "4w"];

    if (!vehicleType || !allowedVehicles.includes(vehicleType)) {
      return res.status(400).json({ error: `vehicleType must be one of: ${allowedVehicles.join(", ")}` });
    }

    if (!pickupLatitude || !pickupLongitude || !dropLatitude || !dropLongitude) {
      return res.status(400).json({ error: "pickupLatitude, pickupLongitude, dropLatitude, and dropLongitude are required" });
    }

    const allowedSizes = ["small", "medium", "large"];

    if (isFreight && sizeCategory && !allowedSizes.includes(sizeCategory)) {
      return res.status(400).json({ error: `sizeCategory must be one of: ${allowedSizes.join(", ")}` });
    }

    if (isFreight && (typeof weightKg !== "number" || weightKg <= 0)) {
      return res.status(400).json({ error: "weightKg must be a positive number for freight bookings" });
    }

    const VEHICLE_RATES: Record<string, { base: number; perKm: number; freeWeightKg: number; extraPerKg: number }> = {
      "2w": { base: 20, perKm: 8, freeWeightKg: 5, extraPerKg: 2 },
      "3w": { base: 30, perKm: 12, freeWeightKg: 20, extraPerKg: 1.5 },
      "4w": { base: 50, perKm: 18, freeWeightKg: 50, extraPerKg: 1 },
    };

    const SIZE_MULTIPLIER: Record<string, number> = {
      small: 1,
      medium: 1.15,
      large: 1.3,
    };

    const distanceKm = await calculateRoadDistanceKm(pickupLatitude, pickupLongitude, dropLatitude, dropLongitude);
    const rate = VEHICLE_RATES[vehicleType]!;
    let amount = rate.base + Math.round(distanceKm * rate.perKm);

    if (isFreight) {
      const extraWeight = Math.max(0, (weightKg as number) - rate.freeWeightKg);
      const weightSurcharge = Math.round(extraWeight * rate.extraPerKg);
      const multiplier = sizeCategory ? SIZE_MULTIPLIER[sizeCategory as string]! : 1;
      amount = Math.round((amount + weightSurcharge) * multiplier);
    }

    const availablePeople = await db.orm.public.User.where({
      role: "delivery",
      isAvailableForDelivery: true,
    }).all();

    if (availablePeople.length === 0) {
      return res.status(400).json({ error: "No delivery partners are currently available. Please try again shortly." });
    }

    let chosenPerson = availablePeople[0]!;

    const withDistance = availablePeople
      .filter((p) => p.currentLatitude !== null && p.currentLongitude !== null)
      .map((p) => {
        const R = 6371;
        const dLat = ((p.currentLatitude! - pickupLatitude) * Math.PI) / 180;
        const dLon = ((p.currentLongitude! - pickupLongitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((pickupLatitude * Math.PI) / 180) *
            Math.cos((p.currentLatitude! * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { person: p, distanceKm: R * c };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (withDistance.length > 0) {
      chosenPerson = withDistance[0]!.person;
    }

    const rideOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const order = await db.transaction(async (tx) => {
      const newOrder = await tx.orm.public.Order.create({
        orderType: "logistics_booking",
        vehicleType,
        pickupLatitude,
        pickupLongitude,
        pickupAddress: pickupAddress || undefined,
        dropLatitude,
        dropLongitude,
        dropAddress: dropAddress || undefined,
        isFreight: Boolean(isFreight),
        weightKg: isFreight ? weightKg : undefined,
        sizeCategory: isFreight ? sizeCategory || undefined : undefined,
        rideOtp,
        buyerId: req.userId!,
        sellerId: chosenPerson.id,
        amount,
        status: "confirmed",
      });

      await tx.orm.public.DeliveryAssignment.create({
        orderId: newOrder.id,
        deliveryPersonId: chosenPerson.id,
      });

      return newOrder;
    });

    await db.orm.public.Notification.create({
      message: `New ${vehicleType.toUpperCase()}${isFreight ? " freight" : ""} request assigned to you`,
      type: "new_logistics_booking",
      userId: chosenPerson.id,
    });

    res.status(201).json({ ...order, distanceKm: Math.round(distanceKm * 10) / 10, assignedTo: chosenPerson.name, devRideOtp: rideOtp });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/stores/:id/print-settings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.id);
    const { offersPrintService, printPricePerPageBw, printPricePerPageColor } = req.body;

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const hasAccess =
      store.sellerId === req.userId ||
      (await db.orm.public.StoreAccess.where({ storeId, userId: req.userId! }).first()) !== null;

    if (!hasAccess) {
      return res.status(403).json({ error: "You do not have access to manage this store" });
    }

    const updated = await db.orm.public.Store.where({ id: storeId }).update({
      offersPrintService: Boolean(offersPrintService),
      printPricePerPageBw: printPricePerPageBw ?? undefined,
      printPricePerPageColor: printPricePerPageColor ?? undefined,
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/printout-orders", requireAuth, upload.single("document"), async (req: AuthRequest, res) => {
  try {
    const { storeId, pages, copies, isColorPrint } = req.body;
    const documentFile = req.file;

    if (!documentFile) {
      return res.status(400).json({ error: "Please attach the document to print" });
    }

    const pagesNum = Number(pages);
    const copiesNum = Number(copies);
    const isColor = isColorPrint === "true" || isColorPrint === true;

    if (!storeId || !pagesNum || pagesNum <= 0 || !copiesNum || copiesNum <= 0) {
      fs.unlink(documentFile.path, () => {});
      return res.status(400).json({ error: "storeId, pages, and copies are required and must be positive" });
    }

    const store = await db.orm.public.Store.where({ id: Number(storeId) }).first();

    if (!store || !store.offersPrintService) {
      fs.unlink(documentFile.path, () => {});
      return res.status(404).json({ error: "This store does not offer print service" });
    }

    const perPageRate = isColor ? store.printPricePerPageColor : store.printPricePerPageBw;

    if (!perPageRate) {
      fs.unlink(documentFile.path, () => {});
      return res.status(400).json({ error: "This store has not set pricing for that print type" });
    }

    const amount = perPageRate * pagesNum * copiesNum;

    const order = await db.orm.public.Order.create({
      orderType: "printout_order",
      storeId: store.id,
      pages: pagesNum,
      copies: copiesNum,
      isColorPrint: isColor,
      printFilePath: documentFile.filename,
      buyerId: req.userId!,
      sellerId: store.sellerId,
      amount,
      status: "confirmed",
    });

    await db.orm.public.Notification.create({
      message: `New print order received at "${store.name}" (${pagesNum} pages x ${copiesNum} copies, ${isColor ? "color" : "B&W"})`,
      type: "new_printout_order",
      userId: store.sellerId,
    });

    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/printout-orders/:id/document", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order || order.orderType !== "printout_order") {
      return res.status(404).json({ error: "Print order not found" });
    }

    if (order.buyerId !== req.userId && order.sellerId !== req.userId) {
      return res.status(403).json({ error: "You are not part of this order" });
    }

    if (!order.printFilePath) {
      return res.status(404).json({ error: "This document is no longer available" });
    }

    res.setHeader("Content-Disposition", "inline");
    res.sendFile(order.printFilePath, { root: "uploads" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/orders/:id/print-complete", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order || order.orderType !== "printout_order") {
      return res.status(404).json({ error: "Print order not found" });
    }

    if (order.sellerId !== req.userId) {
      return res.status(403).json({ error: "You are not the store owner for this order" });
    }

    if (order.status !== "confirmed") {
      return res.status(400).json({ error: `Cannot complete a print order with status "${order.status}"` });
    }

    if (order.printFilePath) {
      const filePath = path.join("uploads", order.printFilePath);
      fs.unlink(filePath, (err) => {
        if (err) console.error("Failed to delete print file:", err);
      });
    }

    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({
      status: "completed",
      printFilePath: null,
    });

    await db.orm.public.Notification.create({
      message: `Your print order #${order.id} is complete`,
      type: "printout_completed",
      userId: order.buyerId,
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
app.post("/vehicle-rentals", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { vehicleType, pickupLatitude, pickupLongitude, pickupAddress, rentalHours } = req.body;

    const allowedVehicles = ["2w", "3w", "4w"];

    if (!vehicleType || !allowedVehicles.includes(vehicleType)) {
      return res.status(400).json({ error: `vehicleType must be one of: ${allowedVehicles.join(", ")}` });
    }

    if (!pickupLatitude || !pickupLongitude) {
      return res.status(400).json({ error: "pickupLatitude and pickupLongitude are required" });
    }

    if (typeof rentalHours !== "number" || rentalHours <= 0) {
      return res.status(400).json({ error: "rentalHours must be a positive number" });
    }

    const RENTAL_HOURLY_RATES: Record<string, number> = {
      "2w": 80,
      "3w": 120,
      "4w": 200,
    };

    const amount = RENTAL_HOURLY_RATES[vehicleType]! * rentalHours;

    const availablePeople = await db.orm.public.User.where({
      role: "delivery",
      isAvailableForDelivery: true,
    }).all();

    if (availablePeople.length === 0) {
      return res.status(400).json({ error: "No drivers are currently available. Please try again shortly." });
    }

    let chosenPerson = availablePeople[0]!;

    const withDistance = availablePeople
      .filter((p) => p.currentLatitude !== null && p.currentLongitude !== null)
      .map((p) => {
        const R = 6371;
        const dLat = ((p.currentLatitude! - pickupLatitude) * Math.PI) / 180;
        const dLon = ((p.currentLongitude! - pickupLongitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((pickupLatitude * Math.PI) / 180) *
            Math.cos((p.currentLatitude! * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { person: p, distanceKm: R * c };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (withDistance.length > 0) {
      chosenPerson = withDistance[0]!.person;
    }

    const rentalStartOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const rentalEndOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const order = await db.transaction(async (tx) => {
      const newOrder = await tx.orm.public.Order.create({
        orderType: "vehicle_rental",
        vehicleType,
        pickupLatitude,
        pickupLongitude,
        pickupAddress: pickupAddress || undefined,
        rentalHours,
        rentalStartOtp,
        rentalEndOtp,
        buyerId: req.userId!,
        sellerId: chosenPerson.id,
        amount,
        status: "confirmed",
      });

      await tx.orm.public.DeliveryAssignment.create({
        orderId: newOrder.id,
        deliveryPersonId: chosenPerson.id,
      });

      return newOrder;
    });

    await db.orm.public.Notification.create({
      message: `New ${vehicleType.toUpperCase()} rental request assigned to you (${rentalHours}h)`,
      type: "new_vehicle_rental",
      userId: chosenPerson.id,
    });

    res.status(201).json({
      ...order,
      assignedTo: chosenPerson.name,
      devRentalStartOtp: rentalStartOtp,
      devRentalEndOtp: rentalEndOtp,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
app.post("/admin/users/:id/promote-co-admin", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const userId = Number(req.params.id);
    const { city } = req.body;

    if (!city) {
      return res.status(400).json({ error: "city is required" });
    }

    const targetUser = await db.orm.public.User.where({ id: userId }).first();

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const updated = await db.orm.public.User.where({ id: userId }).update({
      role: "co_admin",
      city,
    });

    res.status(200).json({ id: updated!.id, name: updated!.name, email: updated!.email, role: updated!.role, city: updated!.city });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/users/:id/demote-co-admin", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const userId = Number(req.params.id);

    const targetUser = await db.orm.public.User.where({ id: userId }).first();

    if (!targetUser || targetUser.role !== "co_admin") {
      return res.status(404).json({ error: "Co-admin not found" });
    }

    const updated = await db.orm.public.User.where({ id: userId }).update({
      role: "buyer",
      city: null,
    });

    res.status(200).json({ id: updated!.id, role: updated!.role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/co-admin/users", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_admin") {
      return res.status(403).json({ error: "Co-admin access required" });
    }

    const me = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!me?.city) {
      return res.status(400).json({ error: "Your co-admin account has no assigned city" });
    }

    const users = await db.orm.public.User.where({ city: me.city }).all();
    const sanitized = users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, kycStatus: u.kycStatus, city: u.city }));

    res.status(200).json(sanitized);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/co-admin/orders", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_admin") {
      return res.status(403).json({ error: "Co-admin access required" });
    }

    const me = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!me?.city) {
      return res.status(400).json({ error: "Your co-admin account has no assigned city" });
    }

    const cityUsers = await db.orm.public.User.where({ city: me.city }).all();
    const cityUserIds = new Set(cityUsers.map((u) => u.id));

    const allOrders = await db.orm.public.Order.where({}).all();
    const scopedOrders = allOrders.filter((o) => cityUserIds.has(o.buyerId) || cityUserIds.has(o.sellerId));

    res.status(200).json(scopedOrders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/co-admin/kyc/pending", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_admin") {
      return res.status(403).json({ error: "Co-admin access required" });
    }

    const me = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!me?.city) {
      return res.status(400).json({ error: "Your co-admin account has no assigned city" });
    }

    const cityUsers = await db.orm.public.User.where({ city: me.city }).all();
    const cityUserIds = new Set(cityUsers.map((u) => u.id));

    const allPending = await db.orm.public.KycDocument.where({ status: "pending" }).all();
    const scopedPending = allPending.filter((d) => cityUserIds.has(d.userId));

    res.status(200).json(scopedPending);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/co-admin/kyc/:id/decide", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_admin") {
      return res.status(403).json({ error: "Co-admin access required" });
    }

    const docId = Number(req.params.id);
    const { decision } = req.body;

    if (decision !== "approved" && decision !== "rejected") {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    const me = await db.orm.public.User.where({ id: req.userId! }).first();
    const doc = await db.orm.public.KycDocument.where({ id: docId }).first();

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const docUser = await db.orm.public.User.where({ id: doc.userId }).first();

    if (!docUser || docUser.city !== me?.city) {
      return res.status(403).json({ error: "This document is outside your assigned city" });
    }

    const updatedDoc = await db.orm.public.KycDocument.where({ id: docId }).update({ status: decision });

    const remainingPending = await db.orm.public.KycDocument.where({ userId: doc.userId, status: "pending" }).all();
    if (remainingPending.length === 0) {
      const allDocs = await db.orm.public.KycDocument.where({ userId: doc.userId }).all();
      const allApproved = allDocs.every((d) => d.status === "approved");
      if (allApproved) {
        await db.orm.public.User.where({ id: doc.userId }).update({ kycStatus: "verified" });
      }
    }

    res.status(200).json(updatedDoc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
app.post("/stores/:id/assign-co-supplier", requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.id);
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    if (store.sellerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this store" });
    }

    const targetUser = await db.orm.public.User.where({ email }).first();

    if (!targetUser) {
      return res.status(404).json({ error: "No user found with that email" });
    }

    if (targetUser.id === req.userId) {
      return res.status(400).json({ error: "You cannot assign yourself as a co-supplier" });
    }

    const existing = await db.orm.public.StoreAccess.where({ storeId, userId: targetUser.id }).first();

    if (existing) {
      return res.status(400).json({ error: "This user already has access to this store" });
    }

    if (targetUser.role === "buyer") {
      await db.orm.public.User.where({ id: targetUser.id }).update({ role: "co_supplier" });
    }

    const access = await db.orm.public.StoreAccess.create({
      storeId,
      userId: targetUser.id,
      assignedBySellerId: req.userId!,
    });

    await db.orm.public.Notification.create({
      message: `You've been given access to manage "${store.name}"`,
      type: "co_supplier_assigned",
      userId: targetUser.id,
    });

    res.status(201).json(access);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/stores/:id/remove-co-supplier", requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.id);
    const { userId } = req.body;

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    if (store.sellerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this store" });
    }

    const access = await db.orm.public.StoreAccess.where({ storeId, userId }).first();

    if (!access) {
      return res.status(404).json({ error: "This user does not have access to this store" });
    }

    await db.orm.public.StoreAccess.where({ id: access.id }).delete();

    res.status(200).json({ removed: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/stores/:id/co-suppliers", requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.id);

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    if (store.sellerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this store" });
    }

    const accesses = await db.orm.public.StoreAccess.where({ storeId }).all();
    const results = await Promise.all(
      accesses.map(async (a) => {
        const u = await db.orm.public.User.where({ id: a.userId }).first();
        return { accessId: a.id, userId: a.userId, name: u?.name ?? "Unknown", email: u?.email ?? "" };
      })
    );

    res.status(200).json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/co-supplier/stores", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Co-supplier access required" });
    }

    const accesses = await db.orm.public.StoreAccess.where({ userId: req.userId! }).all();
    const stores = await Promise.all(
      accesses.map((a) => db.orm.public.Store.where({ id: a.storeId }).first())
    );

    res.status(200).json(stores.filter((s) => s !== null));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
app.post("/admin/users/:id/promote-employee", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const userId = Number(req.params.id);

    const targetUser = await db.orm.public.User.where({ id: userId }).first();

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const updated = await db.orm.public.User.where({ id: userId }).update({ role: "employee" });

    res.status(200).json({ id: updated!.id, role: updated!.role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/tasks", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { assignedToId, taskType, relatedUserId, title, description } = req.body;

    const allowedTypes = ["verify_store", "verify_seller", "verify_delivery_partner", "verify_professional", "other"];

    if (!assignedToId || !title) {
      return res.status(400).json({ error: "assignedToId and title are required" });
    }

    if (!taskType || !allowedTypes.includes(taskType)) {
      return res.status(400).json({ error: `taskType must be one of: ${allowedTypes.join(", ")}` });
    }

    const assignee = await db.orm.public.User.where({ id: assignedToId }).first();

    if (!assignee || assignee.role !== "employee") {
      return res.status(400).json({ error: "assignedToId must belong to a user with the employee role" });
    }

    const task = await db.orm.public.Task.create({
      assignedToId,
      createdByAdminId: req.userId!,
      taskType,
      relatedUserId: relatedUserId || undefined,
      title,
      description: description || undefined,
      status: "pending",
    });

    await db.orm.public.Notification.create({
      message: `New task assigned: "${title}"`,
      type: "new_task",
      userId: assignedToId,
    });

    res.status(201).json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/admin/tasks", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const tasks = await db.orm.public.Task.where({}).all();

    res.status(200).json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/employee/tasks", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "employee") {
      return res.status(403).json({ error: "Employee access required" });
    }

    const tasks = await db.orm.public.Task.where({ assignedToId: req.userId! }).all();

    res.status(200).json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/employee/tasks/:id/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "employee") {
      return res.status(403).json({ error: "Employee access required" });
    }

    const taskId = Number(req.params.id);
    const { status, notes } = req.body;

    const allowedStatuses = ["pending", "in_progress", "completed"];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowedStatuses.join(", ")}` });
    }

    const task = await db.orm.public.Task.where({ id: taskId }).first();

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (task.assignedToId !== req.userId) {
      return res.status(403).json({ error: "This task is not assigned to you" });
    }

    const updatedTask = await db.orm.public.Task.where({ id: taskId }).update({
      status,
      notes: notes !== undefined ? notes : task.notes,
    });

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
app.get("/orders/:id/invoice-data", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyerId !== req.userId && order.sellerId !== req.userId) {
      return res.status(403).json({ error: "You are not part of this order" });
    }

    const buyer = await db.orm.public.User.where({ id: order.buyerId }).first();
    const seller = await db.orm.public.User.where({ id: order.sellerId }).first();

    if (order.orderType !== "store_order") {
      return res.status(200).json({
        orderId: order.id,
        orderType: order.orderType,
        createdAt: order.createdAt,
        buyerName: buyer?.name ?? "Unknown",
        buyerEmail: buyer?.email ?? "",
        sellerName: seller?.name ?? "Unknown",
        sellerEmail: seller?.email ?? "",
        isSimple: true,
        grandTotal: order.amount,
      });
    }

    const orderItems = await db.orm.public.OrderItem.where({ orderId: order.id }).all();
    const gstRates = await db.orm.public.GstRate.where({}).all();

    let subtotal = 0;
    let totalGst = 0;

    const items = await Promise.all(
      orderItems.map(async (item) => {
        const product = await db.orm.public.Product.where({ id: item.productId }).first();
        const lineTotal = item.priceAtPurchase * item.quantity;
        const category = product?.category ?? null;
        const matchedRate = gstRates.find((r) => r.category === category);
        const gstRatePercent = matchedRate ? matchedRate.ratePercent : 0;
        const gstAmount = Math.round(lineTotal * (gstRatePercent / 100) * 100) / 100;

        subtotal += lineTotal;
        totalGst += gstAmount;

        return {
          name: product?.name ?? "Unknown product",
          category: category ?? "uncategorized",
          quantity: item.quantity,
          unitPrice: item.priceAtPurchase,
          lineTotal,
          gstRatePercent,
          gstAmount,
        };
      })
    );

    res.status(200).json({
      orderId: order.id,
      orderType: order.orderType,
      createdAt: order.createdAt,
      buyerName: buyer?.name ?? "Unknown",
      buyerEmail: buyer?.email ?? "",
      sellerName: seller?.name ?? "Unknown",
      sellerEmail: seller?.email ?? "",
      isSimple: false,
      items,
      subtotal,
      totalGst,
      grandTotal: subtotal + totalGst,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
app.post("/admin/settings/referral-reward", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { amount } = req.body;

    if (typeof amount !== "number" || amount < 0) {
      return res.status(400).json({ error: "amount must be a non-negative number" });
    }

    const existing = await db.orm.public.PlatformSetting.where({ key: "referral_reward_amount" }).first();

    if (existing) {
      const updated = await db.orm.public.PlatformSetting.where({ id: existing.id }).update({ value: String(amount) });
      return res.status(200).json(updated);
    }

    const setting = await db.orm.public.PlatformSetting.create({ key: "referral_reward_amount", value: String(amount) });
    res.status(201).json(setting);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/coupons", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { code, description, rewardType, valueType, value, maxDiscount, minOrderAmount, usageLimit, perUserLimit, expiresAt } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "code is required" });
    }

    if (rewardType !== "discount" && rewardType !== "cashback") {
      return res.status(400).json({ error: "rewardType must be \"discount\" or \"cashback\"" });
    }

    if (valueType !== "flat" && valueType !== "percent") {
      return res.status(400).json({ error: "valueType must be \"flat\" or \"percent\"" });
    }

    if (typeof value !== "number" || value <= 0) {
      return res.status(400).json({ error: "value must be a positive number" });
    }

    const normalizedCode = code.trim().toUpperCase();

    const existing = await db.orm.public.Coupon.where({ code: normalizedCode }).first();

    if (existing) {
      return res.status(400).json({ error: "A coupon with this code already exists" });
    }

    const coupon = await db.orm.public.Coupon.create({
      code: normalizedCode,
      description: description || null,
      rewardType,
      valueType,
      value,
      maxDiscount: maxDiscount ?? null,
      minOrderAmount: minOrderAmount ?? null,
      usageLimit: usageLimit ?? null,
      perUserLimit: perUserLimit ?? 1,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    });

    res.status(201).json(coupon);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/admin/coupons", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const coupons = await db.orm.public.Coupon.where({}).all();
    res.status(200).json(coupons);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/coupons/:id/toggle", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const couponId = Number(req.params.id);
    const coupon = await db.orm.public.Coupon.where({ id: couponId }).first();

    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    const updated = await db.orm.public.Coupon.where({ id: couponId }).update({ isActive: !coupon.isActive });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/admin/stores", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const stores = await db.orm.public.Store.where({}).all();
    const sellers = await db.orm.public.User.where({}).all();
    const sellerNameById = new Map<number, string>();
    sellers.forEach((u: any) => sellerNameById.set(u.id, u.name));

    const result = stores.map((s: any) => ({
      id: s.id,
      name: s.name,
      sellerId: s.sellerId,
      sellerName: sellerNameById.get(s.sellerId) || `User #${s.sellerId}`,
      isActive: s.isActive,
      offersPrintService: s.offersPrintService,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/stores/:id/toggle-active", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const storeId = Number(req.params.id);
    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const updated = await db.orm.public.Store.where({ id: storeId }).update({ isActive: !store.isActive });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/stores/:id/toggle-print-service", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const storeId = Number(req.params.id);
    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const updated = await db.orm.public.Store.where({ id: storeId }).update({ offersPrintService: !store.offersPrintService });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/admin/risk-flags", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const flags = await db.orm.public.RiskFlag.where({}).all();
    flags.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(200).json(flags);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/risk-flags/:id/resolve", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const flagId = Number(req.params.id);
    const flag = await db.orm.public.RiskFlag.where({ id: flagId }).first();

    if (!flag) {
      return res.status(404).json({ error: "Risk flag not found" });
    }

    const updated = await db.orm.public.RiskFlag.where({ id: flagId }).update({ resolved: !flag.resolved });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/admin/data-requests", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const requests = await db.orm.public.DataRequest.where({}).all();
    requests.sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

    res.status(200).json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/data-requests/:id/complete", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const requestId = Number(req.params.id);
    const dataRequest = await db.orm.public.DataRequest.where({ id: requestId }).first();

    if (!dataRequest) {
      return res.status(404).json({ error: "Data request not found" });
    }

    if (dataRequest.type !== "deletion") {
      return res.status(400).json({ error: "Only deletion requests can be completed this way" });
    }

    if (dataRequest.status !== "pending") {
      return res.status(400).json({ error: "This request has already been processed" });
    }

    const targetUser = await db.orm.public.User.where({ id: dataRequest.userId }).first();

    if (targetUser) {
      const scrambledPassword = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10);

      await db.orm.public.User.where({ id: targetUser.id }).update({
        email: `deleted-user-${targetUser.id}@deleted.local`,
        name: "Deleted User",
        phone: null,
        address: null,
        city: null,
        password: scrambledPassword,
      });
    }

    const updated = await db.orm.public.DataRequest.where({ id: requestId }).update({
      status: "completed",
      completedAt: new Date().toISOString(),
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/admin/data-requests/:id/reject", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const requestId = Number(req.params.id);
    const dataRequest = await db.orm.public.DataRequest.where({ id: requestId }).first();

    if (!dataRequest) {
      return res.status(404).json({ error: "Data request not found" });
    }

    if (dataRequest.status !== "pending") {
      return res.status(400).json({ error: "This request has already been processed" });
    }

    const updated = await db.orm.public.DataRequest.where({ id: requestId }).update({ status: "rejected" });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/co-admin/benchmarks", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_admin") {
      return res.status(403).json({ error: "Co-admin access required" });
    }

    const products = await db.orm.public.Product.where({ isActive: true }).all();
    const stores = await db.orm.public.Store.where({}).all();
    const ratings = await db.orm.public.ProductRating.where({}).all();
    const orderItems = await db.orm.public.OrderItem.where({}).all();

    const storeNameById = new Map<number, string>();
    stores.forEach((s: any) => storeNameById.set(s.id, s.name));

    const ratingsByProduct = new Map<number, number[]>();
    ratings.forEach((r: any) => {
      const list = ratingsByProduct.get(r.productId) || [];
      list.push(r.rating);
      ratingsByProduct.set(r.productId, list);
    });

    const unitsByProduct = new Map<number, number>();
    orderItems.forEach((item: any) => {
      unitsByProduct.set(item.productId, (unitsByProduct.get(item.productId) || 0) + item.quantity);
    });

    const categoryMap = new Map<string, any[]>();
    products.forEach((p: any) => {
      const category = p.category || "uncategorized";
      const list = categoryMap.get(category) || [];
      list.push(p);
      categoryMap.set(category, list);
    });

    const categories = Array.from(categoryMap.entries()).map(([category, categoryProducts]) => {
      const prices = categoryProducts.map((p: any) => p.price);
      const storeIds = new Set(categoryProducts.map((p: any) => p.storeId));

      const storeGroups = new Map<number, any[]>();
      categoryProducts.forEach((p: any) => {
        const list = storeGroups.get(p.storeId) || [];
        list.push(p);
        storeGroups.set(p.storeId, list);
      });

      const storeBreakdown = Array.from(storeGroups.entries()).map(([storeId, storeProducts]) => {
        const storePrices = storeProducts.map((p: any) => p.price);
        const allRatings: number[] = [];
        let unitsSold = 0;

        storeProducts.forEach((p: any) => {
          const productRatings = ratingsByProduct.get(p.id) || [];
          allRatings.push(...productRatings);
          unitsSold += unitsByProduct.get(p.id) || 0;
        });

        const avgRating =
          allRatings.length > 0 ? allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length : null;

        return {
          storeId,
          storeName: storeNameById.get(storeId) || `Store #${storeId}`,
          productCount: storeProducts.length,
          avgPrice: Math.round(storePrices.reduce((sum: number, price: number) => sum + price, 0) / storePrices.length),
          avgRating,
          unitsSold,
        };
      });

      storeBreakdown.sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1));

      return {
        category,
        productCount: categoryProducts.length,
        storeCount: storeIds.size,
        avgPrice: Math.round(prices.reduce((sum: number, price: number) => sum + price, 0) / prices.length),
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        stores: storeBreakdown,
      };
    });

    categories.sort((a, b) => b.productCount - a.productCount);

    res.status(200).json({ categories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/co-admin/stores", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_admin") {
      return res.status(403).json({ error: "Co-admin access required" });
    }

    const me = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!me?.city) {
      return res.status(400).json({ error: "Your co-admin account has no assigned city" });
    }

    const cityUsers = await db.orm.public.User.where({ city: me.city }).all();
    const cityUserIds = new Set(cityUsers.map((u: any) => u.id));
    const sellerNameById = new Map<number, string>();
    cityUsers.forEach((u: any) => sellerNameById.set(u.id, u.name));

    const allStores = await db.orm.public.Store.where({}).all();
    const scopedStores = allStores.filter((s: any) => cityUserIds.has(s.sellerId));

    const result = scopedStores.map((s: any) => ({
      id: s.id,
      name: s.name,
      sellerId: s.sellerId,
      sellerName: sellerNameById.get(s.sellerId) || `User #${s.sellerId}`,
      isActive: s.isActive,
      offersPrintService: s.offersPrintService,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/co-admin/stores/:id/toggle-active", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_admin") {
      return res.status(403).json({ error: "Co-admin access required" });
    }

    const me = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!me?.city) {
      return res.status(400).json({ error: "Your co-admin account has no assigned city" });
    }

    const storeId = Number(req.params.id);
    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const seller = await db.orm.public.User.where({ id: store.sellerId }).first();

    if (seller?.city !== me.city) {
      return res.status(403).json({ error: "This store is outside your city" });
    }

    const updated = await db.orm.public.Store.where({ id: storeId }).update({ isActive: !store.isActive });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/co-admin/stores/:id/toggle-print-service", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_admin") {
      return res.status(403).json({ error: "Co-admin access required" });
    }

    const me = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!me?.city) {
      return res.status(400).json({ error: "Your co-admin account has no assigned city" });
    }

    const storeId = Number(req.params.id);
    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const seller = await db.orm.public.User.where({ id: store.sellerId }).first();

    if (seller?.city !== me.city) {
      return res.status(403).json({ error: "This store is outside your city" });
    }

    const updated = await db.orm.public.Store.where({ id: storeId }).update({ offersPrintService: !store.offersPrintService });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/co-admin/settings/referral-reward", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_admin") {
      return res.status(403).json({ error: "Co-admin access required" });
    }

    const { amount } = req.body;

    if (typeof amount !== "number" || amount < 0) {
      return res.status(400).json({ error: "amount must be a non-negative number" });
    }

    const existing = await db.orm.public.PlatformSetting.where({ key: "referral_reward_amount" }).first();

    if (existing) {
      const updated = await db.orm.public.PlatformSetting.where({ id: existing.id }).update({ value: String(amount) });
      return res.status(200).json(updated);
    }

    const setting = await db.orm.public.PlatformSetting.create({ key: "referral_reward_amount", value: String(amount) });
    res.status(201).json(setting);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/referral-reward", async (req, res) => {
  try {
    const setting = await db.orm.public.PlatformSetting.where({ key: "referral_reward_amount" }).first();
    res.status(200).json({ amount: setting ? Number(setting.value) : 20 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
app.get("/store-orders/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order || order.orderType !== "store_order") {
      return res.status(404).json({ error: "Store order not found" });
    }

    if (order.buyerId !== req.userId && order.sellerId !== req.userId) {
      return res.status(403).json({ error: "You are not part of this order" });
    }

    const items = await db.orm.public.OrderItem.where({ orderId }).all();

    res.status(200).json({ ...order, items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.get("/earnings/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { period } = req.query;

    const now = new Date();
    let startDate: Date;

    if (period === "weekly") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "monthly") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const allTransactions = await db.orm.public.WalletTransaction.where({ userId: req.userId! }).all();

    const inPeriod = allTransactions.filter((t) => new Date(t.createdAt) >= startDate);

    const totalCredits = inPeriod
      .filter((t) => t.type === "credit")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebits = inPeriod
      .filter((t) => t.type === "debit")
      .reduce((sum, t) => sum + t.amount, 0);

    res.status(200).json({
      period: period ?? "daily",
      startDate: startDate.toISOString(),
      totalCredits,
      totalDebits,
      netEarnings: totalCredits - totalDebits,
      transactionCount: inPeriod.length,
      transactions: inPeriod,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/admin/earnings/platform", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access only" });
    }

    const { period } = req.query;

    const now = new Date();
    let startDate: Date;

    if (period === "weekly") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "monthly") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const allEarnings = await db.orm.public.PlatformEarning.where({}).all();
    const inPeriod = allEarnings.filter((e) => new Date(e.createdAt) >= startDate);

    const total = inPeriod.reduce((sum, e) => sum + e.amount, 0);
    const byType: Record<string, number> = {};

    for (const e of inPeriod) {
      byType[e.type] = (byType[e.type] ?? 0) + e.amount;
    }

    res.status(200).json({
      period: period ?? "daily",
      startDate: startDate.toISOString(),
      totalEarnings: total,
      breakdownByType: byType,
      entries: inPeriod,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/admin/users", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access only" });
    }

    const { role } = req.query;
    const filters: Record<string, unknown> = {};

    if (role) {
      filters.role = role;
    }

    const users = await db.orm.public.User.where(filters).all();
    const usersWithoutPasswords = users.map(({ password, ...rest }) => rest);

    res.status(200).json(usersWithoutPasswords);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/admin/orders", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access only" });
    }

    const { status } = req.query;
    const filters: Record<string, unknown> = {};

    if (status) {
      filters.status = status;
    }

    const orders = await db.orm.public.Order.where(filters).all();
    res.status(200).json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/stores/:id/analytics", requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.id);

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    if (store.sellerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this store" });
    }

    const orders = await db.orm.public.Order.where({ storeId }).all();
    const products = await db.orm.public.Product.where({ storeId }).all();

    const totalSales = orders
      .filter((o) => o.status === "delivered")
      .reduce((sum, o) => sum + o.amount, 0);

    const orderItemsByProduct: Record<number, number> = {};

    for (const order of orders) {
      const items = await db.orm.public.OrderItem.where({ orderId: order.id }).all();
      for (const item of items) {
        orderItemsByProduct[item.productId] = (orderItemsByProduct[item.productId] ?? 0) + item.quantity;
      }
    }

    const bestSelling = Object.entries(orderItemsByProduct)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([productId, quantitySold]) => {
        const product = products.find((p) => p.id === Number(productId));
        return { productId: Number(productId), name: product?.name ?? "Unknown", quantitySold };
      });

    res.status(200).json({
      totalOrders: orders.length,
      totalSales,
      deliveredOrders: orders.filter((o) => o.status === "delivered").length,
      cancelledOrders: orders.filter((o) => o.status === "cancelled").length,
      totalProducts: products.length,
      bestSellingProducts: bestSelling,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
app.post("/favorites", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { storeId, productId } = req.body;

    if (!storeId && !productId) {
      return res.status(400).json({ error: "Either storeId or productId is required" });
    }

    const existing = await db.orm.public.Favorite.where({
      userId: req.userId!,
      storeId: storeId ?? null,
      productId: productId ?? null,
    }).first();

    if (existing) {
      return res.status(400).json({ error: "Already in your favorites" });
    }

    const favorite = await db.orm.public.Favorite.create({
      userId: req.userId!,
      storeId: storeId ?? null,
      productId: productId ?? null,
    });

    res.status(201).json(favorite);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/favorites/:id/remove", requireAuth, async (req: AuthRequest, res) => {
  try {
    const favoriteId = Number(req.params.id);

    const favorite = await db.orm.public.Favorite.where({ id: favoriteId }).first();

    if (!favorite || favorite.userId !== req.userId) {
      return res.status(404).json({ error: "Favorite not found" });
    }

    await db.orm.public.Favorite.where({ id: favoriteId }).delete();

    res.status(200).json({ message: "Removed from favorites" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/favorites/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const favorites = await db.orm.public.Favorite.where({ userId: req.userId! }).all();
    res.status(200).json(favorites);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/referral/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await db.orm.public.User.where({ id: req.userId! }).first();
    res.status(200).json({ referralCode: user?.referralCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/data-requests/export", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const safeProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      address: user.address,
      city: user.city,
      role: user.role,
      walletBalance: user.walletBalance,
      referralCode: user.referralCode,
      createdAt: user.createdAt,
    };

    const ordersAsBuyer = await db.orm.public.Order.where({ buyerId: user.id }).all();
    const ordersAsSeller = await db.orm.public.Order.where({ sellerId: user.id }).all();
    const reviewsGiven = await db.orm.public.Review.where({ reviewerId: user.id }).all();
    const reviewsReceived = await db.orm.public.Review.where({ revieweeId: user.id }).all();
    const walletTransactions = await db.orm.public.WalletTransaction.where({ userId: user.id }).all();
    const stores = await db.orm.public.Store.where({ sellerId: user.id }).all();

    await db.orm.public.DataRequest.create({
      userId: user.id,
      type: "export",
      status: "completed",
      notes: "Self-service data export",
      completedAt: new Date().toISOString(),
    });

    res.status(200).json({
      profile: safeProfile,
      ordersAsBuyer,
      ordersAsSeller,
      reviewsGiven,
      reviewsReceived,
      walletTransactions,
      stores,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/data-requests/deletion", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;

    const created = await db.orm.public.DataRequest.create({
      userId: req.userId!,
      type: "deletion",
      status: "pending",
      notes: typeof reason === "string" && reason.trim() ? reason.trim() : null,
      completedAt: null,
    });

    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/data-requests/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const requests = await db.orm.public.DataRequest.where({ userId: req.userId! }).all();
    requests.sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

    res.status(200).json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});