import express, { Router } from "express";

import { db } from "../prisma/db";
import {
  type AuthRequest,
  requireAuth,
  claimPayment,
  applyMappedPayment,
  loadVerifiedMapping,
  InsufficientFundsError,
  adjustWallet,
  toPaise,
  paymentLimiter,
  razorpay,
} from "../lib/shared";

export const router: Router = Router();

router.post("/demands/:id/pay-fee", paymentLimiter, requireAuth, async (req: AuthRequest, res) => {
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
      const updatedDemand = await db.transaction(async (tx) => {
        const user = await tx.orm.public.User.where({ id: req.userId! }).first();
        const current = await tx.orm.public.Demand.where({ id: demand.id }).first();

        if (!user) return "insufficient" as const;
        if (!current || current.status !== "pending_payment") return "invalid" as const;

        try {
          await adjustWallet(tx, user.id, -feeAmount);
        } catch (err) {
          if (err instanceof InsufficientFundsError) return "insufficient" as const;
          throw err;
        }

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

      if (updatedDemand === "insufficient") {
        return res.status(400).json({ error: "Insufficient wallet balance" });
      }
      if (updatedDemand === "invalid") {
        return res.status(400).json({ error: "Booking fee already paid or demand not payable" });
      }

      return res.status(200).json(updatedDemand);


    }

    if (method === "razorpay") {
      const razorpayOrder = await razorpay.orders.create({
        amount: toPaise(feeAmount),
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

router.post("/demands/:id/verify-fee-payment", paymentLimiter, requireAuth, async (req: AuthRequest, res) => {
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

    const { mapping, error: mappingError } = await loadVerifiedMapping(razorpayOrderId, razorpayPaymentId, razorpaySignature, {
      purpose: "booking_fee",
      referenceId: demand.id,
      userId: req.userId!,
    });

    if (!mapping) {
      return res.status(400).json({ error: mappingError });
    }

    if (!(await claimPayment(razorpayPaymentId))) {
      return res.status(400).json({ error: "This payment has already been processed" });
    }

    const updatedDemand = await applyMappedPayment(mapping);

    res.status(200).json(updatedDemand);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/wallet/topup", paymentLimiter, requireAuth, async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body;

    if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0 || amount > 100000) {
      return res.status(400).json({ error: "Amount must be a whole number between 1 and 100000" });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: toPaise(amount),
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

router.post("/wallet/verify-topup", paymentLimiter, requireAuth, async (req: AuthRequest, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    const { mapping, error } = await loadVerifiedMapping(razorpayOrderId, razorpayPaymentId, razorpaySignature, {
      purpose: "wallet_topup",
      referenceId: req.userId!,
      userId: req.userId!,
    });

    if (!mapping) {
      return res.status(400).json({ error });
    }

    if (!(await claimPayment(razorpayPaymentId))) {
      return res.status(400).json({ error: "This payment has already been processed" });
    }

    // Amount comes from the server-side mapping, never from the client.
    const newBalance = await applyMappedPayment(mapping);

    res.status(200).json({ newBalance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/wallet", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/orders/:id/pay", paymentLimiter, requireAuth, async (req: AuthRequest, res) => {
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
      amount: toPaise(amountDue),
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

router.post("/orders/:id/verify-payment", paymentLimiter, requireAuth, async (req: AuthRequest, res) => {
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

    const { mapping, error: mappingError } = await loadVerifiedMapping(razorpayOrderId, razorpayPaymentId, razorpaySignature, {
      purpose: "order_payment",
      referenceId: order.id,
      userId: req.userId!,
    });

    if (!mapping) {
      return res.status(400).json({ error: mappingError });
    }

    if (!(await claimPayment(razorpayPaymentId))) {
      return res.status(400).json({ error: "This payment has already been processed" });
    }

    const updatedOrder = await applyMappedPayment(mapping);

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/orders/:id/generate-invoice", requireAuth, async (req: AuthRequest, res) => {
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

router.get("/orders/:id/invoice", requireAuth, async (req: AuthRequest, res) => {
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
