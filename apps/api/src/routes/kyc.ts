import express, { Router } from "express";

import { db } from "../prisma/db";
import {
  type AuthRequest,
  requireAuth,
  maskDocumentNumber,
  upload,
} from "../lib/shared";

export const router: Router = Router();

router.post("/kyc/upload", requireAuth, upload.single("document"), async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "seller" && req.userRole !== "delivery") {
      return res.status(403).json({ error: "KYC is only required for sellers and delivery persons" });
    }

    const { documentType, documentNumber } = req.body;

    if (typeof documentType !== "string" || !documentType) {
      return res.status(400).json({ error: "documentType is required" });
    }

    if (documentNumber !== undefined && (typeof documentNumber !== "string" || documentNumber.length > 30)) {
      return res.status(400).json({ error: "documentNumber must be text up to 30 characters" });
    }

    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const doc = await db.transaction(async (tx) => {
      const kycDoc = await tx.orm.public.KycDocument.create({
        documentType,
        documentNumber,
        fileUrl,
        userId: req.userId!,
      });

      await tx.orm.public.User.where({ id: req.userId! }).update({ kycStatus: "pending" });

      return kycDoc;
    });

    res.status(201).json(maskDocumentNumber(doc));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/kyc/file/:docId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const docId = Number(req.params.docId);

    const doc = await db.orm.public.KycDocument.where({ id: docId }).first();

    if (!doc || !doc.fileUrl) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (doc.userId !== req.userId && req.userRole !== "admin") {
      return res.status(403).json({ error: "You do not have permission to view this document" });
    }

    const filePath = doc.fileUrl.replace("/uploads/", "");
    res.sendFile(filePath, { root: "uploads" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.get("/kyc/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const docs = await db.orm.public.KycDocument.where({ userId: req.userId! }).all();
    const user = await db.orm.public.User.where({ id: req.userId! }).first();

    res.status(200).json({ kycStatus: user?.kycStatus, documents: docs.map(maskDocumentNumber) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});
