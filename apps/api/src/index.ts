import * as Sentry from "@sentry/node";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import { ALLOWED_ORIGINS, PORT, apiLimiter } from "./lib/shared";
import { router as webhookRouter } from "./routes/webhook";
import { router as authRouter } from "./routes/auth";
import { router as demandsRouter } from "./routes/demands";
import { router as ordersRouter } from "./routes/orders";
import { router as paymentsRouter } from "./routes/payments";
import { router as adminRouter } from "./routes/admin";
import { router as kycRouter } from "./routes/kyc";
import { router as storesRouter } from "./routes/stores";

const app = express();
app.set("trust proxy", 1);

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));
app.use(helmet());

// Webhook first: it needs the raw request body, before express.json() parses it.
app.use(webhookRouter);

app.use(express.json({ limit: "1mb" }));
app.use(apiLimiter);

app.use(authRouter);
app.use(demandsRouter);
app.use(ordersRouter);
app.use(paymentsRouter);
app.use(adminRouter);
app.use(kycRouter);
app.use(storesRouter);

// 404 and error handlers must come AFTER all routes.
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError || err.message?.startsWith("Only JPG")) {
    return res.status(400).json({ error: err.message });
  }
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
