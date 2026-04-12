import express from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";

import { ingestDocument } from "../core/intelligence/documentIngestion.js";
import { analyzeInput } from "../core/intelligence/analyzeInput.js";

const router = express.Router();

const upload = multer({
  dest: path.join(process.cwd(), "tmp", "uploads"),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

router.post("/analyze-document", upload.single("file"), async (req, res) => {
  let tempPath = "";

  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: "file is required",
        data: null,
        meta: {},
        error: {
          code: "FILE_REQUIRED",
          details: null,
        },
      });
    }

    tempPath = req.file.path;

    const ingested = await ingestDocument(tempPath, {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    if (!ingested?.text || !String(ingested.text).trim()) {
      return res.status(400).json({
        ok: false,
        message: "No readable text could be extracted from file",
        ingestion: {
          kind: ingested?.kind || null,
          hasTextLayer:
            typeof ingested?.hasTextLayer === "boolean"
              ? ingested.hasTextLayer
              : null,
          warnings: ingested?.warnings || [],
        },
      });
    }

    const result = await analyzeInput({
      openapi: null,
      projectNotes: String(req.body?.project_notes || ""),
      documentsText: ingested.text,

      jiraUrl: String(req.body?.jira_url || req.body?.jiraUrl || ""),
      story: String(req.body?.story || ""),
      acceptanceCriteria: String(req.body?.acceptance_criteria || ""),
      comments: String(req.body?.comments || ""),
    });

    return res.status(200).json({
      ok: true,
      message: "Document analyzed successfully",
      data: {
        file: {
          original_name: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
        ingestion: {
          kind: ingested.kind || null,
          hasTextLayer:
            typeof ingested.hasTextLayer === "boolean"
              ? ingested.hasTextLayer
              : null,
          warnings: ingested.warnings || [],
          text_length: String(ingested.text || "").length,
        },
        analysis: result,
      },
      meta: {},
      error: null,
    });
  } catch (err) {
    console.error("POST /api/analyze-document failed:", err);
    return res.status(500).json({
      ok: false,
      message: err?.message || "Document analysis failed",
      data: null,
      meta: {},
      error: {
        code: "ANALYZE_DOCUMENT_FAILED",
        details: err?.stack || null,
      },
    });
  } finally {
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
});

export default router;
