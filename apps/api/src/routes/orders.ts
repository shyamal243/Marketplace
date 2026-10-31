import express, { Router } from "express";

import { db } from "../prisma/db";
import {
  type AuthRequest,
  requireAuth,
  calculateRoadDistanceKm,
  InsufficientFundsError,
  adjustWallet,
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
    res.status(200).json(assignments);
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
        });
      });

      await db.orm.public.Notification.create({
        message: `You've been auto-assigned a local delivery for order #${order.id}`,
        type: "delivery_assigned",
        userId: chosenPerson.id,
      });

      return res.status(200).json({ ...updatedOrder, assignedTo: chosenPerson.name });
    }

    if (!trackingNumber || !courierName) {
      return res.status(400).json({ error: "trackingNumber and courierName are required for courier delivery" });
    }

    const updatedOrder = await db.orm.public.Order.where({ id: order.id }).update({
      status: "shipped",
      deliveryMode: "courier",
      trackingNumber,
      courierName,
    });

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

router.get("/notifications", requireAuth, async (req: AuthRequest, res) => {
  try {
    const notifications = await db.orm.public.Notification.where({ userId: req.userId! }).all();
    res.status(200).json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/notifications/:id/read", requireAuth, async (req: AuthRequest, res) => {
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

    const totalAmount = subtotal + deliveryFeeAmount;

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
      });

            if (commissionAmount > 0) {
        await tx.orm.public.PlatformEarning.create({
          type: "commission",
          amount: commissionAmount,
          orderId: newOrder.id,
        });
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

    res.status(201).json({ ...order, items: validatedItems, subtotal, deliveryFeeAmount, totalAmount });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_STOCK:")) {
      return res.status(400).json({ error: "One or more items went out of stock during checkout" });
    }
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
