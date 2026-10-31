import express, { Router } from "express";
import crypto from "crypto";
import { db } from "../prisma/db";
import { safeEqual, claimPayment, applyMappedPayment } from "../lib/shared";

export const router: Router = Router();

// Must be mounted BEFORE express.json() so the raw body is preserved for signature verification.
router.post("/webhooks/razorpay", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const signature = String(req.headers["x-razorpay-signature"] ?? "");

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(req.body)
      .digest("hex");

    if (!safeEqual(signature, expectedSignature)) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === "payment.captured") {
      const razorpayPaymentId = event.payload.payment.entity.id;
      const razorpayOrderId = event.payload.payment.entity.order_id;

      const mapping = await db.orm.public.RazorpayOrderMapping.where({ razorpayOrderId }).first();

      if (!mapping) {
        console.error("No mapping found for Razorpay order:", razorpayOrderId);
        return res.status(200).json({ message: "No mapping found, ignoring" });
      }

      const claimed = await claimPayment(razorpayPaymentId);
      if (!claimed) {
        return res.status(200).json({ message: "Already processed" });
      }

      await applyMappedPayment(mapping);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});
