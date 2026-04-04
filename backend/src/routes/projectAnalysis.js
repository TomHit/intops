import express from "express";
import { analyzeProject } from "../core/intelligence/analyzeProject.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { api_spec_link, project_notes } = req.body;

    let openapi = null;

    if (api_spec_link) {
      const specRes = await fetch(api_spec_link);
      openapi = await specRes.json();
    }

    const result = await analyzeProject({
      openapi,
      projectNotes: project_notes,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({
      message: err.message || "Analysis failed",
    });
  }
});

export default router;
