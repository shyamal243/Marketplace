import express, { Router } from "express";

import { db } from "../prisma/db";
import {
  type AuthRequest,
  requireAuth,
} from "../lib/shared";

export const router: Router = Router();

router.post("/stores", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller") {
      return res.status(403).json({ error: "Only sellers can create stores" });
    }

    const { name, address, latitude, longitude, deliveryFeeBase, deliveryFeePerKm } = req.body;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const store = await db.orm.public.Store.create({
      name,
      address,
      latitude,
      longitude,
      deliveryFeeBase: deliveryFeeBase ?? 0,
      deliveryFeePerKm: deliveryFeePerKm ?? 0,
      sellerId: req.userId!,
    });

    res.status(201).json(store);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/sellers/:id/stores", async (req, res) => {
  try {
    const sellerId = Number(req.params.id);
    const stores = await db.orm.public.Store.where({ sellerId, isActive: true }).all();
    res.status(200).json(stores);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/products", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller") {
      return res.status(403).json({ error: "Only sellers can add products" });
    }

    const { storeId, name, description, price, stock } = req.body;

    if (!storeId) {
      return res.status(400).json({ error: "storeId is required" });
    }

    if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({ error: "price must be a positive number" });
    }

    if (stock !== undefined && (typeof stock !== "number" || stock < 0)) {
      return res.status(400).json({ error: "stock must be a non-negative number" });
    }

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store || store.sellerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this store" });
    }

    const product = await db.orm.public.Product.create({
      name,
      description,
      price,
      stock: stock ?? 0,
      storeId,
    });

    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/products/:id/remove", requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.id);

    const product = await db.orm.public.Product.where({ id: productId }).first();

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

       const store = await db.orm.public.Store.where({ id: product.storeId }).first();

    if (!store || store.sellerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this product" });
    }

    const updated = await db.orm.public.Product.where({ id: product.id }).update({ isActive: false });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/stores/:id/products", async (req, res) => {
  try {
    const storeId = Number(req.params.id);
    const { search } = req.query;

    let products = await db.orm.public.Product.where({ storeId, isActive: true }).all();

    if (search) {
      const term = String(search).toLowerCase();
      products = products.filter((p) => p.name.toLowerCase().includes(term));
    }

    res.status(200).json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/stores/nearby", async (req, res) => {
  try {
    const { latitude, longitude, radiusKm } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: "latitude and longitude are required" });
    }

    const lat = Number(latitude);
    const lon = Number(longitude);
    const maxRadius = radiusKm ? Number(radiusKm) : 10;

    const allStores = await db.orm.public.Store.where({ isActive: true }).all();

    const nearby = allStores
      .filter((s) => s.latitude !== null && s.longitude !== null)
      .map((s) => {
        const R = 6371;
        const dLat = ((s.latitude! - lat) * Math.PI) / 180;
        const dLon = ((s.longitude! - lon) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat * Math.PI) / 180) *
            Math.cos((s.latitude! * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { ...s, distanceKm: Math.round(R * c * 10) / 10 };
      })
      .filter((s) => s.distanceKm <= maxRadius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.status(200).json(nearby);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/products/search", async (req, res) => {
  try {
    const { search, maxPrice } = req.query;

    let products = await db.orm.public.Product.where({ isActive: true }).all();

    if (search) {
      const term = String(search).toLowerCase();
      products = products.filter(
        (p) => p.name.toLowerCase().includes(term) || (p.description ?? "").toLowerCase().includes(term)
      );
    }

    if (maxPrice) {
      const max = Number(maxPrice);
      products = products.filter((p) => p.price <= max);
    }

    res.status(200).json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/products/:id/rate", requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.id);
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const product = await db.orm.public.Product.where({ id: productId }).first();

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const existing = await db.orm.public.ProductRating.where({
      productId,
      customerId: req.userId!,
    }).first();

    if (existing) {
      return res.status(400).json({ error: "You have already rated this product" });
    }

    const productRating = await db.orm.public.ProductRating.create({
      rating,
      comment,
      productId,
      customerId: req.userId!,
    });

    res.status(201).json(productRating);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const productId = Number(req.params.id);

    const product = await db.orm.public.Product.where({ id: productId }).first();

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const ratings = await db.orm.public.ProductRating.where({ productId }).all();

    const averageRating =
      ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : null;

    res.status(200).json({
      ...product,
      averageRating,
      totalRatings: ratings.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/stores/:id/analytics", requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.id);

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    if (store.sellerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this store" });
    }

    const orders = await db.orm.public.Order.where({ storeId }).all();
    const products = await db.orm.public.Product.where({ storeId }).all();

    const totalSales = orders
      .filter((o) => o.status === "delivered")
      .reduce((sum, o) => sum + o.amount, 0);

    const orderItemsByProduct: Record<number, number> = {};

    for (const order of orders) {
      const items = await db.orm.public.OrderItem.where({ orderId: order.id }).all();
      for (const item of items) {
        orderItemsByProduct[item.productId] = (orderItemsByProduct[item.productId] ?? 0) + item.quantity;
      }
    }

    const bestSelling = Object.entries(orderItemsByProduct)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([productId, quantitySold]) => {
        const product = products.find((p) => p.id === Number(productId));
        return { productId: Number(productId), name: product?.name ?? "Unknown", quantitySold };
      });

    res.status(200).json({
      totalOrders: orders.length,
      totalSales,
      deliveredOrders: orders.filter((o) => o.status === "delivered").length,
      cancelledOrders: orders.filter((o) => o.status === "cancelled").length,
      totalProducts: products.length,
      bestSellingProducts: bestSelling,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/favorites", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { storeId, productId } = req.body;

    if (!storeId && !productId) {
      return res.status(400).json({ error: "Either storeId or productId is required" });
    }

    const existing = await db.orm.public.Favorite.where({
      userId: req.userId!,
      storeId: storeId ?? null,
      productId: productId ?? null,
    }).first();

    if (existing) {
      return res.status(400).json({ error: "Already in your favorites" });
    }

    const favorite = await db.orm.public.Favorite.create({
      userId: req.userId!,
      storeId: storeId ?? null,
      productId: productId ?? null,
    });

    res.status(201).json(favorite);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/favorites/:id/remove", requireAuth, async (req: AuthRequest, res) => {
  try {
    const favoriteId = Number(req.params.id);

    const favorite = await db.orm.public.Favorite.where({ id: favoriteId }).first();

    if (!favorite || favorite.userId !== req.userId) {
      return res.status(404).json({ error: "Favorite not found" });
    }

    await db.orm.public.Favorite.where({ id: favoriteId }).delete();

    res.status(200).json({ message: "Removed from favorites" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/favorites/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const favorites = await db.orm.public.Favorite.where({ userId: req.userId! }).all();
    res.status(200).json(favorites);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
