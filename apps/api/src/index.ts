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
    res.status(200).json(assignments);
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
    const { demandId, amount, message } = req.body;
        if (req.userRole !== "seller" && req.userRole !== "worker") {
      return res.status(403).json({ error: "Only sellers or workers can submit bids" });
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
    // STEP 3: Only now do we create the bid (same as before)
    const bid = await db.orm.public.Bid.create({
      demandId,
      amount,
      message,
      sellerId: req.userId!,
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

    if (demand.buyerId === req.userId) {
      return res.status(200).json(allBids);
    }

    const ownBidOnly = allBids.filter((b) => b.sellerId === req.userId);
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

    if (deliveryMode !== "local" && deliveryMode !== "courier") {
      return res.status(400).json({ error: "deliveryMode must be 'local' or 'courier'" });
    }

    if (deliveryMode === "local") {
      if (!deliveryPersonId) {
        return res.status(400).json({ error: "deliveryPersonId is required for local delivery" });
      }

      const deliveryPerson = await db.orm.public.User.where({ id: deliveryPersonId }).first();

      if (!deliveryPerson || deliveryPerson.role !== "delivery") {
        return res.status(400).json({ error: "deliveryPersonId must belong to a user with role 'delivery'" });
      }

      const updatedOrder = await db.transaction(async (tx) => {
        await tx.orm.public.DeliveryAssignment.create({
          orderId: order.id,
          deliveryPersonId,
        });

        return tx.orm.public.Order.where({ id: order.id }).update({
          status: "shipped",
          deliveryMode: "local",
        });
      });

      await db.orm.public.Notification.create({
        message: `You've been assigned a local delivery for order #${order.id}`,
        type: "delivery_assigned",
        userId: deliveryPersonId,
      });

      return res.status(200).json(updatedOrder);
    }

    if (!trackingNumber || !courierName) {
      return res.status(400).json({ error: "trackingNumber and courierName are required for courier delivery" });
    }

    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({
      status: "shipped",
      deliveryMode: "courier",
      trackingNumber,
      courierName,
    });

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

    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({ status: "delivered" });

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

    if (order.status !== "delivered") {
      return res.status(400).json({ error: "Can only review delivered orders" });
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

    if (order.status !== "delivered") {
      return res.status(400).json({ error: "Can only review delivered orders" });
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
    if (req.userRole !== "seller") {
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

app.post("/products", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller") {
      return res.status(403).json({ error: "Only sellers can add products" });
    }

    const { storeId, name, description, price, stock } = req.body;

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

    if (!store || store.sellerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this store" });
    }

    const product = await db.orm.public.Product.create({
      name,
      description,
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

app.get("/products/search", async (req, res) => {
  try {
    const { search, maxPrice } = req.query;

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

    const totalAmount = subtotal + deliveryFeeAmount;

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
      });

            if (commissionAmount > 0) {
        await tx.orm.public.PlatformEarning.create({
          type: "commission",
          amount: commissionAmount,
          orderId: newOrder.id,
        });
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

    res.status(201).json({ ...order, items: validatedItems, subtotal, deliveryFeeAmount, totalAmount });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_STOCK:")) {
      return res.status(400).json({ error: "One or more items went out of stock during checkout" });
    }
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});