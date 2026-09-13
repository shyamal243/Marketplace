import express from "express";
import bcrypt from "bcrypt";
import { db } from "./prisma/db";
import jwt from "jsonwebtoken";

interface AuthRequest extends express.Request {
  userId?: number;
  userRole?: string;
}

function requireAuth(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number; role: string };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

const app = express();
const PORT = 4000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World from the backend!");
});

app.post("/signup", async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

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

app.post("/login", async (req, res) => {
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

app.post("/demands", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { title, description, budget } = req.body;

    const demand = await db.orm.public.Demand.create({
      title,
      description,
      budget,
      buyerId: req.userId!,
    });

    res.status(201).json(demand);
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

    const bid = await db.orm.public.Bid.create({
      demandId,
      amount,
      message,
      sellerId: req.userId!,
    });

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

    const existingReview = await db.orm.public.Review.where({ orderId: order.id }).first();

    if (existingReview) {
      return res.status(400).json({ error: "This order has already been reviewed" });
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});