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
    const demands = await db.orm.public.Demand.where({}).all();
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

