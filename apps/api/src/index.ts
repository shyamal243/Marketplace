import express from "express";
import bcrypt from "bcrypt";
import { db } from "./prisma/db";
import jwt from "jsonwebtoken";
import Razorpay from "razorpay";
import crypto from "crypto";
import rateLimit from "express-rate-limit";

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

const app = express();
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

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World from the backend!");
});

app.post("/signup", async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "email, password, and name are required" });
    }

    const existingUser = await db.orm.public.User.where({ email }).first();

    if (existingUser) {
      return res.status(400).json({ error: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.orm.public.User.create({
      email,
      password: hashedPassword,
      name,
      role: role ?? "buyer",
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
    const { email, password } = req.body;

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
    const { title, description, budget, durationHours } = req.body;
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

      await db.orm.public.User.where({ id: user.id }).update({
        walletBalance: user.walletBalance - feeAmount,
      });

      await db.orm.public.WalletTransaction.create({
        amount: feeAmount,
        type: "debit",
        reason: "booking_fee",
        userId: user.id,
      });

      const updatedDemand = await db.orm.public.Demand.where({ id: demand.id }).update({
        status: "open",
        bookingFeePaid: true,
      });

      return res.status(200).json(updatedDemand);
    }

    if (method === "razorpay") {
      const razorpayOrder = await razorpay.orders.create({
        amount: feeAmount * 100,
        currency: "INR",
        receipt: `booking_fee_${demand.id}`,
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

app.get("/demands/:id/bids", async (req, res) => {
  try {
    const demandId = Number(req.params.id);

    const bids = await db.orm.public.Bid.where({ demandId }).all();

    res.status(200).json(bids);
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

    const order = await db.orm.public.Order.create({
      demandId: demand.id,
      bidId: bid.id,
      buyerId: demand.buyerId,
      sellerId: bid.sellerId,
      amount: bid.amount,
    });

    await db.orm.public.Bid.where({ id: bid.id }).update({ status: "accepted" });
    await db.orm.public.Demand.where({ id: demand.id }).update({ status: "fulfilled" });
    await db.orm.public.Notification.create({
      message: `Your bid of ₹${bid.amount} on "${demand.title}" was accepted!`,
      type: "bid_accepted",
      userId: bid.sellerId,
    });

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

    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({ status: "shipped" });

    res.status(200).json(updatedOrder);
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

    const user = await db.orm.public.User.where({ id: req.userId! }).first();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await db.orm.public.User.where({ id: user.id }).update({
      walletBalance: user.walletBalance + amount,
    });

    await db.orm.public.WalletTransaction.create({
      amount,
      type: "credit",
      reason: "topup",
      userId: user.id,
    });

    res.status(200).json({ newBalance: user.walletBalance + amount });
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

    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({ status: "paid" });

    res.status(200).json(updatedOrder);
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

app.post("/products", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller") {
      return res.status(403).json({ error: "Only sellers can add products" });
    }

    const { name, description, price, stock } = req.body;
        if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({ error: "price must be a positive number" });
    }

    if (stock !== undefined && (typeof stock !== "number" || stock < 0)) {
      return res.status(400).json({ error: "stock must be a non-negative number" });
    }

    const product = await db.orm.public.Product.create({
      name,
      description,
      price,
      stock: stock ?? 0,
      sellerId: req.userId!,
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

    if (product.sellerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this product" });
    }

    const updated = await db.orm.public.Product.where({ id: product.id }).update({ isActive: false });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/sellers/:id/products", async (req, res) => {
  try {
    const sellerId = Number(req.params.id);
    const { search } = req.query;

    let products = await db.orm.public.Product.where({ sellerId, isActive: true }).all();

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

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});