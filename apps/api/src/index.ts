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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});