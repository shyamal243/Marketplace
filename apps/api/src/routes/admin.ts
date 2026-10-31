import express, { Router } from "express";

import { db } from "../prisma/db";
import {
  type AuthRequest,
  requireAuth,
  paginate,
  InsufficientFundsError,
  adjustWallet,
  audit,
} from "../lib/shared";

export const router: Router = Router();

router.post("/admin/settings/booking-fee", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access only" });
    }

    const { amount } = req.body;

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: "amount must be a non-negative number" });
    }

    const existing = await db.orm.public.PlatformSetting.where({ key: "booking_fee" }).first();
    await audit(req.userId!, "set_booking_fee", "PlatformSetting", existing?.id ?? null, { from: existing?.value ?? null, to: amount });

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

router.post("/admin/settings/commission", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access only" });
    }

    const { percent } = req.body;

    if (typeof percent !== "number" || percent < 0 || percent > 100) {
      return res.status(400).json({ error: "percent must be between 0 and 100" });
    }

    const existing = await db.orm.public.PlatformSetting.where({ key: "commission_percent" }).first();
    await audit(req.userId!, "set_commission", "PlatformSetting", existing?.id ?? null, { from: existing?.value ?? null, to: percent });

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

router.post("/admin/wallet/adjust", requireAuth, async (req: AuthRequest, res) => {
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

    let newBalance: number;
    let transaction;
    try {
      ({ newBalance, transaction } = await db.transaction(async (tx) => {
        const balance = await adjustWallet(tx, user.id, type === "credit" ? amount : -amount);

        const txn = await tx.orm.public.WalletTransaction.create({
          amount,
          type,
          reason: reason ?? "admin_adjustment",
          userId: user.id,
        });
        return { newBalance: balance, transaction: txn };
      }));
    } catch (err) {
      if (err instanceof InsufficientFundsError) {
        return res.status(400).json({ error: "User does not have enough balance for this debit" });
      }
      throw err;
    }

    await audit(req.userId!, "wallet_adjust", "User", user.id, { type, amount, reason: reason ?? null, newBalance });

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

router.post("/admin/gst-rates", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access only" });
    }

    const { category, ratePercent } = req.body;

    if (!category || typeof ratePercent !== "number" || ratePercent < 0) {
      return res.status(400).json({ error: "category and a non-negative ratePercent are required" });
    }

    const existing = await db.orm.public.GstRate.where({ category }).first();
    await audit(req.userId!, "set_gst_rate", "GstRate", existing?.id ?? null, { category, from: existing?.ratePercent ?? null, to: ratePercent });

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

router.get("/gst-rates", async (req, res) => {
  try {
    const rates = await db.orm.public.GstRate.where({}).all();
    res.status(200).json(rates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/admin/kyc/pending", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/admin/kyc/:id/decide", requireAuth, async (req: AuthRequest, res) => {
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

    await audit(req.userId!, "kyc_decision", "KycDocument", doc.id, { decision, rejectionReason: rejectionReason ?? null, userId: doc.userId });

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

router.get("/admin/earnings/platform", requireAuth, async (req: AuthRequest, res) => {
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

router.get("/admin/audit-log", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access only" });
    }

    const logs = await db.orm.public.AuditLog.where({}).all();
    const sorted = logs.sort((a, b) => b.id - a.id);
    const result = paginate(sorted, req.query);
    res.setHeader("X-Total-Count", String(result.total));
    res.status(200).json(result.items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/admin/users", requireAuth, async (req: AuthRequest, res) => {
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

    const result = paginate(usersWithoutPasswords, req.query);
    res.setHeader("X-Total-Count", String(result.total));
    res.status(200).json(result.items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/admin/orders", requireAuth, async (req: AuthRequest, res) => {
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
    const result = paginate(orders, req.query);
    res.setHeader("X-Total-Count", String(result.total));
    res.status(200).json(result.items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
