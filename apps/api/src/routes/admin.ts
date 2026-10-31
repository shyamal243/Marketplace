import express, { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
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

router.post("/admin/users/:id/promote-co-admin", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/admin/users/:id/demote-co-admin", requireAuth, async (req: AuthRequest, res) => {
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

router.get("/co-admin/users", requireAuth, async (req: AuthRequest, res) => {
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

router.get("/co-admin/orders", requireAuth, async (req: AuthRequest, res) => {
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

router.get("/co-admin/kyc/pending", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/co-admin/kyc/:id/decide", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/admin/users/:id/promote-employee", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/admin/tasks", requireAuth, async (req: AuthRequest, res) => {
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

router.get("/admin/tasks", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/admin/settings/referral-reward", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/admin/coupons", requireAuth, async (req: AuthRequest, res) => {
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

router.get("/admin/coupons", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/admin/coupons/:id/toggle", requireAuth, async (req: AuthRequest, res) => {
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

router.get("/admin/stores", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/admin/stores/:id/toggle-active", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/admin/stores/:id/toggle-print-service", requireAuth, async (req: AuthRequest, res) => {
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

router.get("/admin/risk-flags", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/admin/risk-flags/:id/resolve", requireAuth, async (req: AuthRequest, res) => {
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

router.get("/admin/data-requests", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/admin/data-requests/:id/complete", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/admin/data-requests/:id/reject", requireAuth, async (req: AuthRequest, res) => {
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

router.get("/co-admin/benchmarks", requireAuth, async (req: AuthRequest, res) => {
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

router.get("/co-admin/stores", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/co-admin/stores/:id/toggle-active", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/co-admin/stores/:id/toggle-print-service", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/co-admin/settings/referral-reward", requireAuth, async (req: AuthRequest, res) => {
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
