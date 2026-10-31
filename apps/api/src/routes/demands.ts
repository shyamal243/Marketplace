import express, { Router } from "express";
import fs from "fs";
import path from "path";
import { db } from "../prisma/db";
import {
  type AuthRequest,
  requireAuth,
  paginate,
  adjustWallet,
  upload,
} from "../lib/shared";

export const router: Router = Router();

router.get("/demands/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const demands = await db.orm.public.Demand.where({ buyerId: req.userId! }).all();
    res.status(200).json(demands);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/bids/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const bids = await db.orm.public.Bid.where({ sellerId: req.userId! }).all();
    res.status(200).json(bids);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/demands", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { title, description, budget, durationHours, category, hoursNeeded } = req.body;
    if (req.userRole !== "buyer") {
      return res.status(403).json({ error: "Only buyers can post demands" });
    }
        if (budget !== undefined && budget !== null && (typeof budget !== "number" || budget <= 0)) {
      return res.status(400).json({ error: "budget must be a positive number" });
    }

    if (typeof title !== "string" || !title.trim() || title.length > 200) {
      return res.status(400).json({ error: "title is required (max 200 characters)" });
    }

    if (description !== undefined && description !== null && (typeof description !== "string" || description.length > 5000)) {
      return res.status(400).json({ error: "description must be text up to 5000 characters" });
    }

    const allowedDurations = [1, 2, 3, 6, 12, 24];

    if (!durationHours || !allowedDurations.includes(durationHours)) {
      return res.status(400).json({ error: `durationHours must be one of: ${allowedDurations.join(", ")}` });
    }

    const feeSetting = await db.orm.public.PlatformSetting.where({ key: "booking_fee" }).first();
    const bookingFeeAmount = feeSetting ? Number(feeSetting.value) : 10;

    const bidWindowExpiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

    const demand = await db.orm.public.Demand.create({
      title,
      description,
      budget,
      category,
      hoursNeeded,
      buyerId: req.userId!,
      status: "pending_payment",
      bookingFeeAmount,
      bookingFeePaid: false,
      bidWindowExpiresAt,
    });

    res.status(201).json(demand);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/demands/ai-draft", requireAuth, upload.single("photo"), async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "buyer") {
      return res.status(403).json({ error: "Only buyers can draft demands" });
    }

    const { text } = req.body;
    const photoFile = req.file;

    if (!text && !photoFile) {
      return res.status(400).json({ error: "Provide some text or a photo describing what you need" });
    }

    const parts: Array<Record<string, unknown>> = [];

    const promptText = `The buyer typed or said: "${text || "(no text provided, see photo)"}"

Based on this (and the photo if provided), draft a demand posting for a reverse-marketplace platform. Correct any typos. Respond ONLY with JSON in this exact shape, no other text, no markdown fences:
{
  "title": "short corrected title",
  "description": "a clear 1-3 sentence description",
  "category": "a single lowercase category word, e.g. clothing, cleaning, electronics, maid, carpentry, medicines",
  "budget": null or a number if a budget was mentioned or reasonably inferable,
  "hoursNeeded": null or a number if this is an hourly service request
}`;

    parts.push({ text: promptText });

    if (photoFile) {
      const imageBuffer = fs.readFileSync(photoFile.path);
      const base64Image = imageBuffer.toString("base64");
      const ext = path.extname(photoFile.originalname).toLowerCase();
      const mimeTypeMap: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
      };
      const mimeType = mimeTypeMap[ext] || "image/jpeg";
      parts.push({
        inline_data: { mime_type: mimeType, data: base64Image },
      });
    }

    async function callGemini(): Promise<Response> {
      const maxAttempts = 3;
      let lastResponse: Response | null = null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": process.env.GEMINI_API_KEY!,
            },
            body: JSON.stringify({
              contents: [{ parts }],
            }),
          }
        );

        if (response.ok) return response;

        lastResponse = response;
        if (response.status === 503 || response.status === 429) {
          const waitMs = 500 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        break;
      }

      return lastResponse!;
    }

    const aiResponse = await callGemini();

    if (photoFile) {
      fs.unlink(photoFile.path, () => {});
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Gemini API error:", errText);
      const isOverloaded = aiResponse.status === 503 || aiResponse.status === 429;
      return res.status(502).json({
        error: isOverloaded
          ? "The AI drafting service is busy right now (free tier gets high demand at times) — please try again in a moment, or just fill the form in manually below."
          : "AI drafting service is unavailable right now",
      });
    }

    const aiData = await aiResponse.json();
    const rawText =
      aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let draft;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      draft = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", rawText);
      return res
        .status(502)
        .json({ error: "Could not understand the AI response, please try again or type your demand manually" });
    }

    res.json(draft);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/demands/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  try {
    const demandId = Number(req.params.id);

    const demand = await db.orm.public.Demand.where({ id: demandId }).first();

    if (!demand) {
      return res.status(404).json({ error: "Demand not found" });
    }

    if (demand.buyerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this demand" });
    }

    if (demand.status !== "open") {
      return res.status(400).json({ error: `Cannot cancel a demand with status "${demand.status}"` });
    }

    const bids = await db.orm.public.Bid.where({ demandId: demand.id }).all();

    if (bids.length > 0) {
      return res.status(400).json({ error: "Cannot cancel a demand that has received bids" });
    }

    const user = await db.orm.public.User.where({ id: req.userId! }).first();

    if (user && demand.bookingFeePaid && demand.bookingFeeAmount) {
      const refundAmount = demand.bookingFeeAmount;
      const closed = await db.transaction(async (tx) => {
        // Re-check inside the transaction so a repeated cancel cannot refund twice.
        const fresh = await tx.orm.public.Demand.where({ id: demand.id }).first();
        if (!fresh || fresh.status !== "open") return null;

        await adjustWallet(tx, user.id, refundAmount);
        await tx.orm.public.WalletTransaction.create({
          amount: refundAmount,
          type: "credit",
          reason: "booking_fee_refund",
          userId: user.id,
        });
        return tx.orm.public.Demand.where({ id: demand.id }).update({ status: "closed" });
      });

      if (!closed) {
        return res.status(400).json({ error: "Demand can no longer be cancelled" });
      }
      return res.status(200).json(closed);
    }

    const updatedDemand = await db.orm.public.Demand.where({ id: demand.id }).update({ status: "closed" });

    res.status(200).json(updatedDemand);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/demands", async (req, res) => {
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

    const result = paginate(demands, req.query);
    res.setHeader("X-Total-Count", String(result.total));
    res.status(200).json(result.items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/bids", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { demandId, amount, message, productId } = req.body;
        if (req.userRole !== "seller" && req.userRole !== "professional") {
      return res.status(403).json({ error: "Only sellers or professionals can submit bids" });
    }
        if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    // STEP 1: Look up the demand FIRST (new)
    const targetDemand = await db.orm.public.Demand.where({ id: demandId }).first();

    if (!targetDemand) {
      return res.status(404).json({ error: "Demand not found" });
    }

    // STEP 2: Check if the bidding deadline has passed (new)
    if (targetDemand.bidWindowExpiresAt && new Date(targetDemand.bidWindowExpiresAt) < new Date()) {
      return res.status(400).json({ error: "The bidding window for this demand has closed" });
    }
    if (targetDemand.status !== "open") {
      return res.status(400).json({ error: `Cannot bid on a demand with status "${targetDemand.status}"` });
    }

    let linkedProductId: number | null = null;

    if (productId !== undefined && productId !== null) {
      const linkedProduct = await db.orm.public.Product.where({ id: productId }).first();

      if (!linkedProduct) {
        return res.status(404).json({ error: "Linked product not found" });
      }

      const productStore = await db.orm.public.Store.where({ id: linkedProduct.storeId }).first();
      const isOwner = productStore?.sellerId === req.userId;
      const hasAccess =
        isOwner ||
        (await db.orm.public.StoreAccess.where({ storeId: linkedProduct.storeId, userId: req.userId! }).first()) !== null;

      if (!hasAccess) {
        return res.status(403).json({ error: "You can only link a product from your own store" });
      }

      linkedProductId = linkedProduct.id;
    }

    // STEP 3: Only now do we create the bid (same as before)
    const bid = await db.orm.public.Bid.create({
      demandId,
      amount,
      message,
      sellerId: req.userId!,
      linkedProductId,
    });

    // STEP 4: Look up demand again for the notification (same as before, kept for the message text)
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

router.get("/demands/:id/bids", requireAuth, async (req: AuthRequest, res) => {
  try {
    const demandId = Number(req.params.id);

    const demand = await db.orm.public.Demand.where({ id: demandId }).first();

    if (!demand) {
      return res.status(404).json({ error: "Demand not found" });
    }

    const allBids = await db.orm.public.Bid.where({ demandId }).all();

    const linkedProductIds = Array.from(
      new Set(allBids.map((b: any) => b.linkedProductId).filter((id: any) => id !== null && id !== undefined))
    );

    const linkedProducts = await Promise.all(
      linkedProductIds.map((productId: number) => db.orm.public.Product.where({ id: productId }).first())
    );

    const productById = new Map<number, any>();
    linkedProducts.forEach((p: any) => {
      if (p) productById.set(p.id, p);
    });

    const enrichedBids = allBids.map((b: any) => ({
      ...b,
      linkedProduct: b.linkedProductId ? productById.get(b.linkedProductId) ?? null : null,
    }));

    if (demand.buyerId === req.userId) {
      return res.status(200).json(enrichedBids);
    }

    const ownBidOnly = enrichedBids.filter((b: any) => b.sellerId === req.userId);
    res.status(200).json(ownBidOnly);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/bids/:id/accept", requireAuth, async (req: AuthRequest, res) => {
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

    if (bid.status !== "pending") {
      return res.status(400).json({ error: `Cannot accept a bid with status "${bid.status}"` });
    }

    if (demand.status !== "open") {
      return res.status(400).json({ error: `Cannot accept a bid on a demand with status "${demand.status}"` });
    }

    const gstRate = demand.category
      ? await db.orm.public.GstRate.where({ category: demand.category }).first()
      : null;

    const ratePercent = gstRate?.ratePercent ?? 0;
    const gstAmount = Math.round((bid.amount * ratePercent) / (100 + ratePercent));
    const commissionSetting = await db.orm.public.PlatformSetting.where({ key: "commission_percent" }).first();
    const commissionPercent = commissionSetting ? Number(commissionSetting.value) : 0;
    const commissionAmount = Math.round((bid.amount * commissionPercent) / 100);

    const order = await db.transaction(async (tx) => {
      const newOrder = await tx.orm.public.Order.create({
        demandId: demand.id,
        bidId: bid.id,
        buyerId: demand.buyerId,
        sellerId: bid.sellerId,
        amount: bid.amount,
        gstCategory: demand.category ?? null,
        gstRatePercent: ratePercent,
        gstAmount,
        commissionAmount,
      });
            if (commissionAmount > 0) {
        await tx.orm.public.PlatformEarning.create({
          type: "commission",
          amount: commissionAmount,
          orderId: newOrder.id,
        });
      }

      await tx.orm.public.Bid.where({ id: bid.id }).update({ status: "accepted" });
      await tx.orm.public.Demand.where({ id: demand.id }).update({ status: "fulfilled" });

      return newOrder;
    });

    await db.orm.public.Notification.create({
      message: `Your bid of ₹${bid.amount} on "${demand.title}" was accepted!`,
      type: "bid_accepted",
      userId: bid.sellerId,
    });

    const buyerAccount = await db.orm.public.User.where({ id: demand.buyerId }).first();

    if (buyerAccount && buyerAccount.referredBy && !buyerAccount.referralRewarded) {
      const REFERRAL_REWARD = 50;

      await db.transaction(async (tx) => {
        const referrer = await tx.orm.public.User.where({ id: buyerAccount.referredBy! }).first();

        if (referrer) {
          await adjustWallet(tx, referrer.id, REFERRAL_REWARD);
          await tx.orm.public.WalletTransaction.create({
            amount: REFERRAL_REWARD,
            type: "credit",
            reason: "referral_reward",
            userId: referrer.id,
          });
        }

        await adjustWallet(tx, buyerAccount.id, REFERRAL_REWARD);
        await tx.orm.public.User.where({ id: buyerAccount.id }).update({ referralRewarded: true });
        await tx.orm.public.WalletTransaction.create({
          amount: REFERRAL_REWARD,
          type: "credit",
          reason: "referral_reward",
          userId: buyerAccount.id,
        });
      });
    }

    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/bids/:id/reject", requireAuth, async (req: AuthRequest, res) => {
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

    const remainingPendingBids = await db.orm.public.Bid.where({
      demandId: demand.id,
      status: "pending",
    }).all();

    if (remainingPendingBids.length === 0) {
      await db.orm.public.Demand.where({ id: demand.id }).update({ status: "closed" });
    }

    res.status(200).json(updatedBid);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
