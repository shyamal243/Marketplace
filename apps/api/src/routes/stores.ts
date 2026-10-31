import express, { Router } from "express";
import fs from "fs";
import path from "path";
import { db } from "../prisma/db";
import {
  type AuthRequest,
  requireAuth,
  upload,
} from "../lib/shared";

export const router: Router = Router();

router.post("/stores", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
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

router.get("/products/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can view their own products" });
    }

    const ownedStores = await db.orm.public.Store.where({ sellerId: req.userId! }).all();
    const accessEntries = await db.orm.public.StoreAccess.where({ userId: req.userId! }).all();

    const storeIds = new Set<number>();
    ownedStores.forEach((s: any) => storeIds.add(s.id));
    accessEntries.forEach((a: any) => storeIds.add(a.storeId));

    const productsByStore = await Promise.all(
      Array.from(storeIds).map((storeId) => db.orm.public.Product.where({ storeId, isActive: true }).all())
    );

    res.status(200).json(productsByStore.flat());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/products", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can add products" });
    }

    const { storeId, name, description, category, price, stock } = req.body;

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

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const isOwner = store.sellerId === req.userId;
    const hasAccess = isOwner || (await db.orm.public.StoreAccess.where({ storeId: store.id, userId: req.userId! }).first()) !== null;

    if (!hasAccess) {
      return res.status(403).json({ error: "You do not have access to manage this store" });
    }

    const product = await db.orm.public.Product.create({
      name,
      description,
      category: category || undefined,
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

router.post("/stores/:id/hygiene-photo", requireAuth, upload.single("photo"), async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can upload a hygiene photo" });
    }

    const storeId = Number(req.params.id);
    const photoFile = req.file;

    if (!photoFile) {
      return res.status(400).json({ error: "Please attach a photo" });
    }

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      fs.unlink(photoFile.path, () => {});
      return res.status(404).json({ error: "Store not found" });
    }

    const isOwner = store.sellerId === req.userId;
    const hasAccess = isOwner || (await db.orm.public.StoreAccess.where({ storeId: store.id, userId: req.userId! }).first()) !== null;

    if (!hasAccess) {
      fs.unlink(photoFile.path, () => {});
      return res.status(403).json({ error: "You do not have access to manage this store" });
    }

    const photo = await db.orm.public.HygienePhoto.create({
      storeId: store.id,
      photoPath: photoFile.path,
    });

    res.status(201).json(photo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/stores/:id/hygiene-status", async (req, res) => {
  try {
    const storeId = Number(req.params.id);

    const photos = await db.orm.public.HygienePhoto.where({ storeId }).all();

    let latest: { uploadedAt: string } | null = null;
    for (const p of photos) {
      if (!latest || new Date(p.uploadedAt) > new Date(latest.uploadedAt)) {
        latest = p;
      }
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const uploadedToday = latest ? new Date(latest.uploadedAt) > twentyFourHoursAgo : false;

    res.status(200).json({ uploadedToday, latestUploadedAt: latest ? latest.uploadedAt : null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/products/bulk-upload/template", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can access this" });
    }

    const XLSX = require("xlsx");

    const headers = ["name", "description", "category", "price", "stock"];
    const sampleRow = ["Sample Product", "A short description of the product", "fmcg", 199.5, 25];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=product-upload-template.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/products/bulk-upload", requireAuth, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "co_supplier") {
      return res.status(403).json({ error: "Only sellers can bulk upload products" });
    }

    const { storeId } = req.body;
    const uploadedFile = req.file;

    if (!storeId) {
      if (uploadedFile) fs.unlink(uploadedFile.path, () => {});
      return res.status(400).json({ error: "storeId is required" });
    }

    if (!uploadedFile) {
      return res.status(400).json({ error: "Please attach an Excel (.xlsx) file" });
    }

    const store = await db.orm.public.Store.where({ id: Number(storeId) }).first();

    if (!store) {
      fs.unlink(uploadedFile.path, () => {});
      return res.status(404).json({ error: "Store not found" });
    }

    const isOwner = store.sellerId === req.userId;
    const hasAccess = isOwner || (await db.orm.public.StoreAccess.where({ storeId: store.id, userId: req.userId! }).first()) !== null;

    if (!hasAccess) {
      fs.unlink(uploadedFile.path, () => {});
      return res.status(403).json({ error: "You do not have access to manage this store" });
    }

    const XLSX = require("xlsx");
    const workbook = XLSX.readFile(uploadedFile.path);
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

    fs.unlink(uploadedFile.path, () => {});

    if (rows.length === 0) {
      return res.status(400).json({ error: "The uploaded file has no product rows" });
    }

    const created: any[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const name = row.name ? String(row.name).trim() : "";
      const description: string | null = row.description ? String(row.description).trim() : null;
      const category: string | null = row.category ? String(row.category).trim() : null;
      const price = Number(row.price);
      const stock = row.stock !== null && row.stock !== undefined ? Number(row.stock) : 0;

      if (!name) {
        errors.push({ row: rowNumber, error: "name is required" });
        continue;
      }

      if (!price || price <= 0 || Number.isNaN(price)) {
        errors.push({ row: rowNumber, error: "price must be a positive number" });
        continue;
      }

      if (Number.isNaN(stock) || stock < 0) {
        errors.push({ row: rowNumber, error: "stock must be a non-negative number" });
        continue;
      }

      try {
        const product = await db.orm.public.Product.create({
          name,
          description,
          category,
          price,
          stock,
          storeId: store.id,
        });
        created.push(product);
      } catch (err) {
        errors.push({ row: rowNumber, error: "Failed to create product" });
      }
    }

    res.status(200).json({
      createdCount: created.length,
      totalRows: rows.length,
      errors,
    });
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

router.get("/stores/:id", async (req, res) => {
  try {
    const storeId = Number(req.params.id);
    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    res.status(200).json({
      id: store.id,
      name: store.name,
      address: store.address,
      isActive: store.isActive,
      offersPrintService: store.offersPrintService,
      printPricePerPageBw: store.printPricePerPageBw,
      printPricePerPageColor: store.printPricePerPageColor,
      fssaiLicenseNumber: store.fssaiLicenseNumber,
      businessRegistrationNumber: store.businessRegistrationNumber,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/stores/:id/license-info", requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.id);
    const { fssaiLicenseNumber, businessRegistrationNumber } = req.body;

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const hasAccess =
      store.sellerId === req.userId ||
      (await db.orm.public.StoreAccess.where({ storeId, userId: req.userId! }).first()) !== null;

    if (!hasAccess) {
      return res.status(403).json({ error: "You do not have access to manage this store" });
    }

    const updated = await db.orm.public.Store.where({ id: storeId }).update({
      fssaiLicenseNumber: fssaiLicenseNumber || null,
      businessRegistrationNumber: businessRegistrationNumber || null,
    });

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

router.post("/products/prescription-scan", requireAuth, upload.single("photo"), async (req: AuthRequest, res) => {
  try {
    const photoFile = req.file;

    if (!photoFile) {
      return res.status(400).json({ error: "Please attach a photo of the prescription" });
    }

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

    const promptText = `This is a photo of a medical prescription. Read the medicine names written or printed on it. Respond ONLY with JSON in this exact shape, no other text, no markdown fences:
{
  "medicines": ["medicine name 1", "medicine name 2"]
}
If you cannot read any medicine names clearly, respond with { "medicines": [] }. Do not guess or invent medicine names that are not visible in the image.`;

    const parts = [
      { text: promptText },
      { inline_data: { mime_type: mimeType, data: base64Image } },
    ];

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
            body: JSON.stringify({ contents: [{ parts }] }),
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
    fs.unlink(photoFile.path, () => {});

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Gemini API error:", errText);
      const isOverloaded = aiResponse.status === 503 || aiResponse.status === 429;
      return res.status(502).json({
        error: isOverloaded
          ? "The scanning service is busy right now — please try again in a moment, or search manually."
          : "Could not scan the prescription right now",
      });
    }

    const aiData = await aiResponse.json();
    const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let result;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse prescription scan response:", rawText);
      return res.status(502).json({ error: "Could not read the prescription, please try a clearer photo" });
    }

    res.json({ medicines: Array.isArray(result.medicines) ? result.medicines : [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/products/search", async (req, res) => {
  try {
    const { search, maxPrice, category } = req.query;

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

    if (category) {
      const cat = String(category).toLowerCase();
      products = products.filter((p) => (p.category ?? "").toLowerCase() === cat);
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

router.post("/stores/:id/print-settings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.id);
    const { offersPrintService, printPricePerPageBw, printPricePerPageColor } = req.body;

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const hasAccess =
      store.sellerId === req.userId ||
      (await db.orm.public.StoreAccess.where({ storeId, userId: req.userId! }).first()) !== null;

    if (!hasAccess) {
      return res.status(403).json({ error: "You do not have access to manage this store" });
    }

    const updated = await db.orm.public.Store.where({ id: storeId }).update({
      offersPrintService: Boolean(offersPrintService),
      printPricePerPageBw: printPricePerPageBw ?? undefined,
      printPricePerPageColor: printPricePerPageColor ?? undefined,
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/stores/:id/assign-co-supplier", requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.id);
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    if (store.sellerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this store" });
    }

    const targetUser = await db.orm.public.User.where({ email }).first();

    if (!targetUser) {
      return res.status(404).json({ error: "No user found with that email" });
    }

    if (targetUser.id === req.userId) {
      return res.status(400).json({ error: "You cannot assign yourself as a co-supplier" });
    }

    const existing = await db.orm.public.StoreAccess.where({ storeId, userId: targetUser.id }).first();

    if (existing) {
      return res.status(400).json({ error: "This user already has access to this store" });
    }

    if (targetUser.role === "buyer") {
      await db.orm.public.User.where({ id: targetUser.id }).update({ role: "co_supplier" });
    }

    const access = await db.orm.public.StoreAccess.create({
      storeId,
      userId: targetUser.id,
      assignedBySellerId: req.userId!,
    });

    await db.orm.public.Notification.create({
      message: `You've been given access to manage "${store.name}"`,
      type: "co_supplier_assigned",
      userId: targetUser.id,
    });

    res.status(201).json(access);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/stores/:id/remove-co-supplier", requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.id);
    const { userId } = req.body;

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    if (store.sellerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this store" });
    }

    const access = await db.orm.public.StoreAccess.where({ storeId, userId }).first();

    if (!access) {
      return res.status(404).json({ error: "This user does not have access to this store" });
    }

    await db.orm.public.StoreAccess.where({ id: access.id }).delete();

    res.status(200).json({ removed: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/stores/:id/co-suppliers", requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.id);

    const store = await db.orm.public.Store.where({ id: storeId }).first();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    if (store.sellerId !== req.userId) {
      return res.status(403).json({ error: "You do not own this store" });
    }

    const accesses = await db.orm.public.StoreAccess.where({ storeId }).all();
    const results = await Promise.all(
      accesses.map(async (a) => {
        const u = await db.orm.public.User.where({ id: a.userId }).first();
        return { accessId: a.id, userId: a.userId, name: u?.name ?? "Unknown", email: u?.email ?? "" };
      })
    );

    res.status(200).json(results);
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
