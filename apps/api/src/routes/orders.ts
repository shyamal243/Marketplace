import express, { Router } from "express";
import fs from "fs";
import path from "path";
import { db } from "../prisma/db";
import {
  type AuthRequest,
  requireAuth,
  calculateRoadDistanceKm,
  InsufficientFundsError,
  adjustWallet,
  upload,
} from "../lib/shared";

export const router: Router = Router();

router.get("/orders/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const asBuyer = await db.orm.public.Order.where({ buyerId: req.userId! }).all();
    const asSeller = await db.orm.public.Order.where({ sellerId: req.userId! }).all();

    res.status(200).json({ asBuyer, asSeller });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/deliveries/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "delivery") {
      return res.status(403).json({ error: "Only delivery persons have delivery assignments" });
    }

    const assignments = await db.orm.public.DeliveryAssignment.where({ deliveryPersonId: req.userId! }).all();

    const enriched = await Promise.all(
      assignments.map(async (a) => {
        const order = await db.orm.public.Order.where({ id: a.orderId }).first();
        return { ...a, orderType: order?.orderType ?? null };
      })
    );

    res.status(200).json(enriched);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/orders/:id/ship", requireAuth, async (req: AuthRequest, res) => {
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
    if (order.otpRequired && !order.checkoutOtpVerifiedAt) {
      return res.status(400).json({ error: "The buyer must verify the checkout OTP before this order can ship" });
    }

    const deliveryOtp = order.otpRequired ? Math.floor(100000 + Math.random() * 900000).toString() : null;

    if (deliveryMode !== "local" && deliveryMode !== "courier") {
      return res.status(400).json({ error: "deliveryMode must be 'local' or 'courier'" });
    }

    if (deliveryMode === "local") {
      let refLat: number | null = null;
      let refLon: number | null = null;

      if (order.storeId) {
        const store = await db.orm.public.Store.where({ id: order.storeId }).first();
        if (store?.latitude && store?.longitude) {
          refLat = store.latitude;
          refLon = store.longitude;
        }
      } else if (order.demandId) {
        const demand = await db.orm.public.Demand.where({ id: order.demandId }).first();
        if (demand?.deliveryLatitude && demand?.deliveryLongitude) {
          refLat = demand.deliveryLatitude;
          refLon = demand.deliveryLongitude;
        }
      }

      const availablePeople = await db.orm.public.User.where({
        role: "delivery",
        isAvailableForDelivery: true,
      }).all();

      if (availablePeople.length === 0) {
        return res.status(400).json({ error: "No delivery persons are currently available. Try courier delivery instead." });
      }

      let chosenPerson = availablePeople[0]!;

      if (refLat !== null && refLon !== null) {
        const withDistance = availablePeople
          .filter((p) => p.currentLatitude !== null && p.currentLongitude !== null)
          .map((p) => {
            const R = 6371;
            const dLat = ((p.currentLatitude! - refLat!) * Math.PI) / 180;
            const dLon = ((p.currentLongitude! - refLon!) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((refLat! * Math.PI) / 180) *
                Math.cos((p.currentLatitude! * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return { person: p, distanceKm: R * c };
          })
          .sort((a, b) => a.distanceKm - b.distanceKm);

        if (withDistance.length > 0) {
          chosenPerson = withDistance[0]!.person;
        }
      }

      const updatedOrder = await db.transaction(async (tx) => {
        await tx.orm.public.DeliveryAssignment.create({
          orderId: order.id,
          deliveryPersonId: chosenPerson.id,
        });

        return tx.orm.public.Order.where({ id: order.id }).update({
          status: "shipped",
          deliveryMode: "local",
          deliveryOtp,
        });
      });

      await db.orm.public.Notification.create({
        message: `You've been auto-assigned a local delivery for order #${order.id}`,
        type: "delivery_assigned",
        userId: chosenPerson.id,
      });

      if (order.otpRequired && deliveryOtp) {
        await db.orm.public.Notification.create({
          message: `Your delivery verification code for order #${order.id} is ${deliveryOtp}. Share this with the delivery partner only when you receive your item.`,
          type: "delivery_otp",
          userId: order.buyerId,
        });
      }

      return res.status(200).json({ ...updatedOrder, assignedTo: chosenPerson.name });
    }

    if (!trackingNumber || !courierName) {
      return res.status(400).json({ error: "trackingNumber and courierName are required for courier delivery" });
    }

    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({
      status: "shipped",
      deliveryMode: "courier",
      deliveryOtp,
      trackingNumber,
      courierName,
    });

    if (order.otpRequired && deliveryOtp) {
      await db.orm.public.Notification.create({
        message: `Your delivery verification code for order #${order.id} is ${deliveryOtp}. Share this with the delivery partner only when you receive your item.`,
        type: "delivery_otp",
        userId: order.buyerId,
      });
    }

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/deliveries/:orderId/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.orderId);
    const { status } = req.body;
    const { otp } = req.body;

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

    const orderForOtp = await db.orm.public.Order.where({ id: orderId }).first();
    if (
      orderForOtp &&
      orderForOtp.orderType === "logistics_booking" &&
      status === "picked_up" &&
      !orderForOtp.rideOtpVerifiedAt
    ) {
      if (!otp || otp !== orderForOtp.rideOtp) {
        return res.status(400).json({ error: "Incorrect or missing ride start OTP" });
      }
      await db.orm.public.Order.where({ id: orderForOtp.id }).update({
        rideOtpVerifiedAt: new Date().toISOString(),
        rideOtp: null,
      });
    }

    if (
      orderForOtp &&
      orderForOtp.orderType === "vehicle_rental" &&
      status === "picked_up" &&
      !orderForOtp.rentalStartOtpVerifiedAt
    ) {
      if (!otp || otp !== orderForOtp.rentalStartOtp) {
        return res.status(400).json({ error: "Incorrect or missing rental start OTP" });
      }
      await db.orm.public.Order.where({ id: orderForOtp.id }).update({
        rentalStartOtpVerifiedAt: new Date().toISOString(),
        rentalStartOtp: null,
      });
    }

    if (
      orderForOtp &&
      orderForOtp.orderType === "vehicle_rental" &&
      status === "delivered" &&
      !orderForOtp.rentalEndOtpVerifiedAt
    ) {
      if (!otp || otp !== orderForOtp.rentalEndOtp) {
        return res.status(400).json({ error: "Incorrect or missing rental end OTP" });
      }
      await db.orm.public.Order.where({ id: orderForOtp.id }).update({
        rentalEndOtpVerifiedAt: new Date().toISOString(),
        rentalEndOtp: null,
      });
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

router.get("/orders/:id/tracking", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/orders/:id/return", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/returns/:id/decide", requireAuth, async (req: AuthRequest, res) => {
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
        await adjustWallet(tx, buyer.id, order.amount);

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

router.get("/orders/:id/return", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyerId !== req.userId && order.sellerId !== req.userId) {
      return res.status(403).json({ error: "You are not part of this order" });
    }

    const returnRequest = await db.orm.public.ReturnRequest.where({ orderId }).first();

    res.status(200).json(returnRequest ?? null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/returns/for-seller", requireAuth, async (req: AuthRequest, res) => {
  try {
    const myOrders = await db.orm.public.Order.where({ sellerId: req.userId! }).all();
    const orderIds = myOrders.map((o) => o.id);

    const allReturns = await db.orm.public.ReturnRequest.where({ status: "requested" }).all();
    const myPendingReturns = allReturns.filter((r) => orderIds.includes(r.orderId));

    res.status(200).json(myPendingReturns);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/deliveries/:orderId/rate", requireAuth, async (req: AuthRequest, res) => {
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

router.post("/deliveries/:orderId/tip", requireAuth, async (req: AuthRequest, res) => {
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
      try {
        await adjustWallet(tx, buyer.id, -amount);
      } catch (err) {
        if (err instanceof InsufficientFundsError) return null;
        throw err;
      }

      await tx.orm.public.WalletTransaction.create({
        amount,
        type: "debit",
        reason: "delivery_tip",
        userId: buyer.id,
      });

      const deliveryPerson = await tx.orm.public.User.where({ id: assignment.deliveryPersonId }).first();

      if (deliveryPerson) {
        await adjustWallet(tx, deliveryPerson.id, amount);

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

    if (!tip) {
      return res.status(400).json({ error: "Insufficient wallet balance for this tip" });
    }

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

router.post("/orders/:id/deliver", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    const { otp } = req.body;

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
    if (order.otpRequired && !order.deliveryOtpVerifiedAt) {
      if (!otp || otp !== order.deliveryOtp) {
        return res.status(400).json({ error: "Incorrect or missing delivery OTP" });
      }
    }

    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({ status: "delivered", deliveryOtpVerifiedAt: order.otpRequired ? new Date().toISOString() : order.deliveryOtpVerifiedAt, deliveryOtp: order.otpRequired ? null : order.deliveryOtp });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/orders/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
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

    const updatedOrder = await db.transaction(async (tx) => {
      // Re-check status inside the transaction so a repeated/concurrent cancel cannot refund twice.
      const fresh = await tx.orm.public.Order.where({ id: order.id }).first();
      if (!fresh || fresh.status !== "confirmed") {
        return null;
      }

      if (fresh.isPaid) {
        const buyer = await tx.orm.public.User.where({ id: fresh.buyerId }).first();
        if (buyer) {
          await adjustWallet(tx, buyer.id, fresh.amount);
          await tx.orm.public.WalletTransaction.create({
            amount: fresh.amount,
            type: "credit",
            reason: "order_cancelled_refund",
            userId: buyer.id,
          });
        }
      }

      if (fresh.orderType === "store_order") {
        const items = await tx.orm.public.OrderItem.where({ orderId: fresh.id }).all();
        for (const item of items) {
          const product = await tx.orm.public.Product.where({ id: item.productId }).first();
          if (product) {
            await tx.orm.public.Product.where({ id: product.id }).update({
              stock: product.stock + item.quantity,
            });
          }
        }
      }

      if (fresh.commissionAmount && fresh.commissionAmount > 0) {
        await tx.orm.public.PlatformEarning.create({
          type: "commission_reversal",
          amount: -fresh.commissionAmount,
          orderId: fresh.id,
        });
      }

      return tx.orm.public.Order.where({ id: fresh.id }).update({ status: "cancelled" });
    });

    if (!updatedOrder) {
      return res.status(400).json({ error: "Order can no longer be cancelled" });
    }

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

router.post("/orders/:id/review", requireAuth, async (req: AuthRequest, res) => {
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

    if (order.status !== "delivered" && order.status !== "completed") {
      return res.status(400).json({ error: "Can only review delivered or completed orders" });
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

router.post("/orders/:id/review-buyer", requireAuth, async (req: AuthRequest, res) => {
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

    if (order.status !== "delivered" && order.status !== "completed") {
      return res.status(400).json({ error: "Can only review delivered or completed orders" });
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

router.get("/users/:id/order-history", requireAuth, async (req: AuthRequest, res) => {
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

router.get("/users/:id/reviews", async (req, res) => {
  try {
    const revieweeId = Number(req.params.id);

    const reviews = await db.orm.public.Review.where({ revieweeId }).all();

    res.status(200).json(reviews);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/users/:id/profile", async (req, res) => {
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

router.post("/professional-skills", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "professional") {
      return res.status(403).json({ error: "Only professionals can add skills" });
    }

    const { skillName, category, hourlyRate } = req.body;

    if (!skillName) {
      return res.status(400).json({ error: "skillName is required" });
    }

    if (typeof hourlyRate !== "number" || hourlyRate <= 0) {
      return res.status(400).json({ error: "hourlyRate must be a positive number" });
    }

    const skill = await db.orm.public.ProfessionalSkill.create({
      skillName,
      category: category || undefined,
      hourlyRate,
      professionalId: req.userId!,
    });

    res.status(201).json(skill);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/professional-skills/:id/remove", requireAuth, async (req: AuthRequest, res) => {
  try {
    const skillId = Number(req.params.id);

    const skill = await db.orm.public.ProfessionalSkill.where({ id: skillId }).first();

    if (!skill) {
      return res.status(404).json({ error: "Skill not found" });
    }

    if (skill.professionalId !== req.userId) {
      return res.status(403).json({ error: "You do not own this skill" });
    }

    const updated = await db.orm.public.ProfessionalSkill.where({ id: skill.id }).update({ isActive: false });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/professional-skills/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const skills = await db.orm.public.ProfessionalSkill.where({ professionalId: req.userId!, isActive: true }).all();
    res.status(200).json(skills);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/professional-skills/search", async (req, res) => {
  try {
    const { category, search } = req.query;

    const filters: Record<string, unknown> = { isActive: true };

    if (category) {
      filters.category = category;
    }

    let skills = await db.orm.public.ProfessionalSkill.where(filters).all();

    if (search) {
      const term = String(search).toLowerCase();
      skills = skills.filter((s) => s.skillName.toLowerCase().includes(term));
    }

    const professionalIds = [...new Set(skills.map((s) => s.professionalId))];
    const professionals = await Promise.all(
      professionalIds.map((id) => db.orm.public.User.where({ id }).first())
    );

    const results = skills.map((skill) => {
      const professional = professionals.find((p) => p?.id === skill.professionalId);
      return {
        ...skill,
        professionalName: professional?.name ?? "Unknown",
      };
    });

    res.status(200).json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/store-orders", requireAuth, async (req: AuthRequest, res) => {
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
    let hasJewellery = false;
    let hasFood = false;
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
      if (product.category === "jewellery") hasJewellery = true;
      if (product.category === "food") hasFood = true;
    }

    if (hasFood) {
      const foodPhotos = await db.orm.public.HygienePhoto.where({ storeId: store.id }).all();
      let latestFoodPhoto: { uploadedAt: string } | null = null;
      for (const p of foodPhotos) {
        if (!latestFoodPhoto || new Date(p.uploadedAt) > new Date(latestFoodPhoto.uploadedAt)) {
          latestFoodPhoto = p;
        }
      }
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const hygieneCurrent = latestFoodPhoto ? new Date(latestFoodPhoto.uploadedAt) > twentyFourHoursAgo : false;

      if (!hygieneCurrent) {
        return res.status(400).json({ error: "This store has not uploaded today's kitchen hygiene photo yet. Food orders cannot be placed until they do." });
      }
    }

    const { couponCode } = req.body;
    let appliedCoupon: { id: number; code: string; rewardType: string; discountAmount: number } | null = null;

    if (couponCode) {
      const coupon = await db.orm.public.Coupon.where({ code: String(couponCode).trim().toUpperCase() }).first();

      if (!coupon || !coupon.isActive) {
        return res.status(400).json({ error: "Invalid or inactive coupon code" });
      }

      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return res.status(400).json({ error: "This coupon has expired" });
      }

      if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
        return res.status(400).json({ error: `This coupon requires a minimum order of Rs.${coupon.minOrderAmount}` });
      }

      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({ error: "This coupon has reached its usage limit" });
      }

      if (coupon.perUserLimit) {
        const previousUses = await db.orm.public.CouponRedemption.where({ couponId: coupon.id, userId: req.userId! }).all();
        if (previousUses.length >= coupon.perUserLimit) {
          return res.status(400).json({ error: "You have already used this coupon the maximum number of times" });
        }
      }

      let rawAmount = coupon.valueType === "percent" ? Math.round((subtotal * coupon.value) / 100) : coupon.value;

      if (coupon.maxDiscount && rawAmount > coupon.maxDiscount) {
        rawAmount = coupon.maxDiscount;
      }

      if (rawAmount > subtotal) {
        rawAmount = subtotal;
      }

      appliedCoupon = { id: coupon.id, code: coupon.code, rewardType: coupon.rewardType, discountAmount: rawAmount };
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

    const discountAmount = appliedCoupon && appliedCoupon.rewardType === "discount" ? appliedCoupon.discountAmount : 0;
    const totalAmount = subtotal + deliveryFeeAmount - discountAmount;

    const checkoutOtp = hasJewellery ? Math.floor(100000 + Math.random() * 900000).toString() : null;

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
        otpRequired: hasJewellery,
        checkoutOtp,
      });

            if (commissionAmount > 0) {
        await tx.orm.public.PlatformEarning.create({
          type: "commission",
          amount: commissionAmount,
          orderId: newOrder.id,
        });
      }

      if (appliedCoupon) {
        await tx.orm.public.CouponRedemption.create({
          couponId: appliedCoupon.id,
          userId: req.userId!,
          orderId: newOrder.id,
          amount: appliedCoupon.discountAmount,
        });

        const currentCoupon = await tx.orm.public.Coupon.where({ id: appliedCoupon.id }).first();

        if (currentCoupon) {
          await tx.orm.public.Coupon.where({ id: appliedCoupon.id }).update({
            usedCount: currentCoupon.usedCount + 1,
          });
        }

        if (appliedCoupon.rewardType === "cashback" && appliedCoupon.discountAmount > 0) {
          const buyer = await tx.orm.public.User.where({ id: req.userId! }).first();
          if (buyer) {
            await tx.orm.public.User.where({ id: buyer.id }).update({
              walletBalance: buyer.walletBalance + appliedCoupon.discountAmount,
            });

            await tx.orm.public.WalletTransaction.create({
              amount: appliedCoupon.discountAmount,
              type: "credit",
              reason: "cashback",
              userId: buyer.id,
            });
          }
        }
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

    try {
      const buyerForRisk = await db.orm.public.User.where({ id: req.userId! }).first();

      if (buyerForRisk) {
        const accountAgeMs = Date.now() - new Date(buyerForRisk.createdAt).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (accountAgeMs < oneDayMs && totalAmount > 5000) {
          await db.orm.public.RiskFlag.create({
            entityType: "order",
            entityId: order.id,
            reason: "High-value order from a newly created account",
            severity: "high",
          });
        }

        const pastOrders = await db.orm.public.Order.where({ buyerId: buyerForRisk.id, orderType: "store_order" }).all();
        const previousOrders = pastOrders.filter((o: any) => o.id !== order.id);

        if (previousOrders.length >= 3) {
          const avgAmount = previousOrders.reduce((sum: number, o: any) => sum + o.amount, 0) / previousOrders.length;
          if (avgAmount > 0 && totalAmount > avgAmount * 5) {
            await db.orm.public.RiskFlag.create({
              entityType: "order",
              entityId: order.id,
              reason: "Order amount far exceeds this buyer's usual order size",
              severity: "medium",
            });
          }
        }
      }
    } catch (riskError) {
      console.error("Risk evaluation failed (non-blocking):", riskError);
    }

    res.status(201).json({
      ...order,
      items: validatedItems,
      subtotal,
      deliveryFeeAmount,
      discountAmount,
      totalAmount,
      couponApplied: appliedCoupon
        ? { code: appliedCoupon.code, rewardType: appliedCoupon.rewardType, amount: appliedCoupon.discountAmount }
        : null,
      devCheckoutOtp: hasJewellery ? checkoutOtp : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_STOCK:")) {
      return res.status(400).json({ error: "One or more items went out of stock during checkout" });
    }
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/orders/:id/verify-checkout-otp", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    const { otp } = req.body;

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyerId !== req.userId) {
      return res.status(403).json({ error: "You are not the buyer for this order" });
    }

    if (!order.otpRequired) {
      return res.status(400).json({ error: "This order does not require OTP verification" });
    }

    if (order.checkoutOtpVerifiedAt) {
      return res.status(400).json({ error: "This order's checkout OTP has already been verified" });
    }

    if (!otp || otp !== order.checkoutOtp) {
      return res.status(400).json({ error: "Incorrect OTP" });
    }

    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({
      checkoutOtpVerifiedAt: new Date().toISOString(),
      checkoutOtp: null,
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/service-bookings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { professionalSkillId, scheduleType, hoursBooked, scheduledFor } = req.body;

    const allowedSchedules = ["instant", "today", "tomorrow", "weekly", "monthly"];

    if (!professionalSkillId) {
      return res.status(400).json({ error: "professionalSkillId is required" });
    }

    if (!scheduleType || !allowedSchedules.includes(scheduleType)) {
      return res.status(400).json({ error: `scheduleType must be one of: ${allowedSchedules.join(", ")}` });
    }

    if (typeof hoursBooked !== "number" || hoursBooked <= 0) {
      return res.status(400).json({ error: "hoursBooked must be a positive number" });
    }

    const skill = await db.orm.public.ProfessionalSkill.where({ id: professionalSkillId, isActive: true }).first();

    if (!skill) {
      return res.status(404).json({ error: "This skill is not available" });
    }

    const amount = skill.hourlyRate * hoursBooked;

    const order = await db.orm.public.Order.create({
      orderType: "service_booking",
      professionalSkillId,
      scheduleType,
      scheduledFor: scheduledFor || null,
      hoursBooked,
      buyerId: req.userId!,
      sellerId: skill.professionalId,
      amount,
      status: "confirmed",
    });

    await db.orm.public.Notification.create({
      message: `New booking for "${skill.skillName}" (${scheduleType}, ${hoursBooked}h)`,
      type: "new_service_booking",
      userId: skill.professionalId,
    });

    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/orders/:id/complete", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.orderType !== "service_booking") {
      return res.status(400).json({ error: "This route is only for service bookings" });
    }

    if (order.sellerId !== req.userId) {
      return res.status(403).json({ error: "You are not the professional for this booking" });
    }

    if (order.status !== "confirmed") {
      return res.status(400).json({ error: `Cannot complete a booking with status "${order.status}"` });
    }

    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({ status: "completed" });

    await db.orm.public.Notification.create({
      message: `Your booking #${order.id} has been marked as completed`,
      type: "service_completed",
      userId: order.buyerId,
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/logistics-bookings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      vehicleType,
      pickupLatitude,
      pickupLongitude,
      pickupAddress,
      dropLatitude,
      dropLongitude,
      dropAddress,
      isFreight,
      weightKg,
      sizeCategory,
    } = req.body;

    const allowedVehicles = ["2w", "3w", "4w"];

    if (!vehicleType || !allowedVehicles.includes(vehicleType)) {
      return res.status(400).json({ error: `vehicleType must be one of: ${allowedVehicles.join(", ")}` });
    }

    if (!pickupLatitude || !pickupLongitude || !dropLatitude || !dropLongitude) {
      return res.status(400).json({ error: "pickupLatitude, pickupLongitude, dropLatitude, and dropLongitude are required" });
    }

    const allowedSizes = ["small", "medium", "large"];

    if (isFreight && sizeCategory && !allowedSizes.includes(sizeCategory)) {
      return res.status(400).json({ error: `sizeCategory must be one of: ${allowedSizes.join(", ")}` });
    }

    if (isFreight && (typeof weightKg !== "number" || weightKg <= 0)) {
      return res.status(400).json({ error: "weightKg must be a positive number for freight bookings" });
    }

    const VEHICLE_RATES: Record<string, { base: number; perKm: number; freeWeightKg: number; extraPerKg: number }> = {
      "2w": { base: 20, perKm: 8, freeWeightKg: 5, extraPerKg: 2 },
      "3w": { base: 30, perKm: 12, freeWeightKg: 20, extraPerKg: 1.5 },
      "4w": { base: 50, perKm: 18, freeWeightKg: 50, extraPerKg: 1 },
    };

    const SIZE_MULTIPLIER: Record<string, number> = {
      small: 1,
      medium: 1.15,
      large: 1.3,
    };

    const distanceKm = await calculateRoadDistanceKm(pickupLatitude, pickupLongitude, dropLatitude, dropLongitude);
    const rate = VEHICLE_RATES[vehicleType]!;
    let amount = rate.base + Math.round(distanceKm * rate.perKm);

    if (isFreight) {
      const extraWeight = Math.max(0, (weightKg as number) - rate.freeWeightKg);
      const weightSurcharge = Math.round(extraWeight * rate.extraPerKg);
      const multiplier = sizeCategory ? SIZE_MULTIPLIER[sizeCategory as string]! : 1;
      amount = Math.round((amount + weightSurcharge) * multiplier);
    }

    const availablePeople = await db.orm.public.User.where({
      role: "delivery",
      isAvailableForDelivery: true,
    }).all();

    if (availablePeople.length === 0) {
      return res.status(400).json({ error: "No delivery partners are currently available. Please try again shortly." });
    }

    let chosenPerson = availablePeople[0]!;

    const withDistance = availablePeople
      .filter((p) => p.currentLatitude !== null && p.currentLongitude !== null)
      .map((p) => {
        const R = 6371;
        const dLat = ((p.currentLatitude! - pickupLatitude) * Math.PI) / 180;
        const dLon = ((p.currentLongitude! - pickupLongitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((pickupLatitude * Math.PI) / 180) *
            Math.cos((p.currentLatitude! * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { person: p, distanceKm: R * c };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (withDistance.length > 0) {
      chosenPerson = withDistance[0]!.person;
    }

    const rideOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const order = await db.transaction(async (tx) => {
      const newOrder = await tx.orm.public.Order.create({
        orderType: "logistics_booking",
        vehicleType,
        pickupLatitude,
        pickupLongitude,
        pickupAddress: pickupAddress || undefined,
        dropLatitude,
        dropLongitude,
        dropAddress: dropAddress || undefined,
        isFreight: Boolean(isFreight),
        weightKg: isFreight ? weightKg : undefined,
        sizeCategory: isFreight ? sizeCategory || undefined : undefined,
        rideOtp,
        buyerId: req.userId!,
        sellerId: chosenPerson.id,
        amount,
        status: "confirmed",
      });

      await tx.orm.public.DeliveryAssignment.create({
        orderId: newOrder.id,
        deliveryPersonId: chosenPerson.id,
      });

      return newOrder;
    });

    await db.orm.public.Notification.create({
      message: `New ${vehicleType.toUpperCase()}${isFreight ? " freight" : ""} request assigned to you`,
      type: "new_logistics_booking",
      userId: chosenPerson.id,
    });

    res.status(201).json({ ...order, distanceKm: Math.round(distanceKm * 10) / 10, assignedTo: chosenPerson.name, devRideOtp: rideOtp });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/printout-orders", requireAuth, upload.single("document"), async (req: AuthRequest, res) => {
  try {
    const { storeId, pages, copies, isColorPrint } = req.body;
    const documentFile = req.file;

    if (!documentFile) {
      return res.status(400).json({ error: "Please attach the document to print" });
    }

    const pagesNum = Number(pages);
    const copiesNum = Number(copies);
    const isColor = isColorPrint === "true" || isColorPrint === true;

    if (!storeId || !pagesNum || pagesNum <= 0 || !copiesNum || copiesNum <= 0) {
      fs.unlink(documentFile.path, () => {});
      return res.status(400).json({ error: "storeId, pages, and copies are required and must be positive" });
    }

    const store = await db.orm.public.Store.where({ id: Number(storeId) }).first();

    if (!store || !store.offersPrintService) {
      fs.unlink(documentFile.path, () => {});
      return res.status(404).json({ error: "This store does not offer print service" });
    }

    const perPageRate = isColor ? store.printPricePerPageColor : store.printPricePerPageBw;

    if (!perPageRate) {
      fs.unlink(documentFile.path, () => {});
      return res.status(400).json({ error: "This store has not set pricing for that print type" });
    }

    const amount = perPageRate * pagesNum * copiesNum;

    const order = await db.orm.public.Order.create({
      orderType: "printout_order",
      storeId: store.id,
      pages: pagesNum,
      copies: copiesNum,
      isColorPrint: isColor,
      printFilePath: documentFile.filename,
      buyerId: req.userId!,
      sellerId: store.sellerId,
      amount,
      status: "confirmed",
    });

    await db.orm.public.Notification.create({
      message: `New print order received at "${store.name}" (${pagesNum} pages x ${copiesNum} copies, ${isColor ? "color" : "B&W"})`,
      type: "new_printout_order",
      userId: store.sellerId,
    });

    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/printout-orders/:id/document", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order || order.orderType !== "printout_order") {
      return res.status(404).json({ error: "Print order not found" });
    }

    if (order.buyerId !== req.userId && order.sellerId !== req.userId) {
      return res.status(403).json({ error: "You are not part of this order" });
    }

    if (!order.printFilePath) {
      return res.status(404).json({ error: "This document is no longer available" });
    }

    res.setHeader("Content-Disposition", "inline");
    res.sendFile(order.printFilePath, { root: "uploads" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/orders/:id/print-complete", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order || order.orderType !== "printout_order") {
      return res.status(404).json({ error: "Print order not found" });
    }

    if (order.sellerId !== req.userId) {
      return res.status(403).json({ error: "You are not the store owner for this order" });
    }

    if (order.status !== "confirmed") {
      return res.status(400).json({ error: `Cannot complete a print order with status "${order.status}"` });
    }

    if (order.printFilePath) {
      const filePath = path.join("uploads", order.printFilePath);
      fs.unlink(filePath, (err) => {
        if (err) console.error("Failed to delete print file:", err);
      });
    }

    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({
      status: "completed",
      printFilePath: null,
    });

    await db.orm.public.Notification.create({
      message: `Your print order #${order.id} is complete`,
      type: "printout_completed",
      userId: order.buyerId,
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/vehicle-rentals", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { vehicleType, pickupLatitude, pickupLongitude, pickupAddress, rentalHours } = req.body;

    const allowedVehicles = ["2w", "3w", "4w"];

    if (!vehicleType || !allowedVehicles.includes(vehicleType)) {
      return res.status(400).json({ error: `vehicleType must be one of: ${allowedVehicles.join(", ")}` });
    }

    if (!pickupLatitude || !pickupLongitude) {
      return res.status(400).json({ error: "pickupLatitude and pickupLongitude are required" });
    }

    if (typeof rentalHours !== "number" || rentalHours <= 0) {
      return res.status(400).json({ error: "rentalHours must be a positive number" });
    }

    const RENTAL_HOURLY_RATES: Record<string, number> = {
      "2w": 80,
      "3w": 120,
      "4w": 200,
    };

    const amount = RENTAL_HOURLY_RATES[vehicleType]! * rentalHours;

    const availablePeople = await db.orm.public.User.where({
      role: "delivery",
      isAvailableForDelivery: true,
    }).all();

    if (availablePeople.length === 0) {
      return res.status(400).json({ error: "No drivers are currently available. Please try again shortly." });
    }

    let chosenPerson = availablePeople[0]!;

    const withDistance = availablePeople
      .filter((p) => p.currentLatitude !== null && p.currentLongitude !== null)
      .map((p) => {
        const R = 6371;
        const dLat = ((p.currentLatitude! - pickupLatitude) * Math.PI) / 180;
        const dLon = ((p.currentLongitude! - pickupLongitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((pickupLatitude * Math.PI) / 180) *
            Math.cos((p.currentLatitude! * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { person: p, distanceKm: R * c };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (withDistance.length > 0) {
      chosenPerson = withDistance[0]!.person;
    }

    const rentalStartOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const rentalEndOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const order = await db.transaction(async (tx) => {
      const newOrder = await tx.orm.public.Order.create({
        orderType: "vehicle_rental",
        vehicleType,
        pickupLatitude,
        pickupLongitude,
        pickupAddress: pickupAddress || undefined,
        rentalHours,
        rentalStartOtp,
        rentalEndOtp,
        buyerId: req.userId!,
        sellerId: chosenPerson.id,
        amount,
        status: "confirmed",
      });

      await tx.orm.public.DeliveryAssignment.create({
        orderId: newOrder.id,
        deliveryPersonId: chosenPerson.id,
      });

      return newOrder;
    });

    await db.orm.public.Notification.create({
      message: `New ${vehicleType.toUpperCase()} rental request assigned to you (${rentalHours}h)`,
      type: "new_vehicle_rental",
      userId: chosenPerson.id,
    });

    res.status(201).json({
      ...order,
      assignedTo: chosenPerson.name,
      devRentalStartOtp: rentalStartOtp,
      devRentalEndOtp: rentalEndOtp,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/co-supplier/stores", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Co-supplier access required" });
    }

    const accesses = await db.orm.public.StoreAccess.where({ userId: req.userId! }).all();
    const stores = await Promise.all(
      accesses.map((a) => db.orm.public.Store.where({ id: a.storeId }).first())
    );

    res.status(200).json(stores.filter((s) => s !== null));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/employee/tasks", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "employee") {
      return res.status(403).json({ error: "Employee access required" });
    }

    const tasks = await db.orm.public.Task.where({ assignedToId: req.userId! }).all();

    res.status(200).json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/employee/tasks/:id/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "employee") {
      return res.status(403).json({ error: "Employee access required" });
    }

    const taskId = Number(req.params.id);
    const { status, notes } = req.body;

    const allowedStatuses = ["pending", "in_progress", "completed"];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowedStatuses.join(", ")}` });
    }

    const task = await db.orm.public.Task.where({ id: taskId }).first();

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (task.assignedToId !== req.userId) {
      return res.status(403).json({ error: "This task is not assigned to you" });
    }

    const updatedTask = await db.orm.public.Task.where({ id: taskId }).update({
      status,
      notes: notes !== undefined ? notes : task.notes,
    });

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/orders/:id/invoice-data", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);

    const order = await db.orm.public.Order.where({ id: orderId }).first();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.buyerId !== req.userId && order.sellerId !== req.userId) {
      return res.status(403).json({ error: "You are not part of this order" });
    }

    const buyer = await db.orm.public.User.where({ id: order.buyerId }).first();
    const seller = await db.orm.public.User.where({ id: order.sellerId }).first();

    if (order.orderType !== "store_order") {
      return res.status(200).json({
        orderId: order.id,
        orderType: order.orderType,
        createdAt: order.createdAt,
        buyerName: buyer?.name ?? "Unknown",
        buyerEmail: buyer?.email ?? "",
        sellerName: seller?.name ?? "Unknown",
        sellerEmail: seller?.email ?? "",
        isSimple: true,
        grandTotal: order.amount,
      });
    }

    const orderItems = await db.orm.public.OrderItem.where({ orderId: order.id }).all();
    const gstRates = await db.orm.public.GstRate.where({}).all();

    let subtotal = 0;
    let totalGst = 0;

    const items = await Promise.all(
      orderItems.map(async (item) => {
        const product = await db.orm.public.Product.where({ id: item.productId }).first();
        const lineTotal = item.priceAtPurchase * item.quantity;
        const category = product?.category ?? null;
        const matchedRate = gstRates.find((r) => r.category === category);
        const gstRatePercent = matchedRate ? matchedRate.ratePercent : 0;
        const gstAmount = Math.round(lineTotal * (gstRatePercent / 100) * 100) / 100;

        subtotal += lineTotal;
        totalGst += gstAmount;

        return {
          name: product?.name ?? "Unknown product",
          category: category ?? "uncategorized",
          quantity: item.quantity,
          unitPrice: item.priceAtPurchase,
          lineTotal,
          gstRatePercent,
          gstAmount,
        };
      })
    );

    res.status(200).json({
      orderId: order.id,
      orderType: order.orderType,
      createdAt: order.createdAt,
      buyerName: buyer?.name ?? "Unknown",
      buyerEmail: buyer?.email ?? "",
      sellerName: seller?.name ?? "Unknown",
      sellerEmail: seller?.email ?? "",
      isSimple: false,
      items,
      subtotal,
      totalGst,
      grandTotal: subtotal + totalGst,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/store-orders/:id", requireAuth, async (req: AuthRequest, res) => {
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

router.get("/earnings/mine", requireAuth, async (req: AuthRequest, res) => {
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
