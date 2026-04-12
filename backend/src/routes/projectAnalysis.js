import express from "express";
import { analyzeInput } from "../core/intelligence/analyzeInput.js";

const router = express.Router();

router.post("/project-analysis", async (req, res) => {
  console.log("HIT /api/project-analysis");
  console.log("headers content-type:", req.headers["content-type"]);
  console.log("body keys:", Object.keys(req.body || {}));
  console.log("raw body:", req.body);

  try {
    const {
      api_spec_link,
      project_notes,
      documents_text,
      prd_text,
      jira_text,
      story_text,
      acceptance_criteria_text,
      comments_text,
      extra_texts,
    } = req.body || {};

    let openapi = null;

    if (api_spec_link) {
      console.log("fetching spec:", api_spec_link);
      const specRes = await fetch(api_spec_link);
      console.log("spec status:", specRes.status, specRes.statusText);
      openapi = await specRes.json();
    }

    console.log("calling analyzeInput...");
    const result = await analyzeInput({
      openapi,
      projectNotes: project_notes || "",
      documentsText: documents_text || "",
      prdText: prd_text || "",
      jiraUrl: req.body?.jiraUrl || req.body?.jira_url || "",
      storyText: story_text || "",
      acceptanceCriteriaText: acceptance_criteria_text || "",
      commentsText: comments_text || "",
      extraTexts: Array.isArray(extra_texts) ? extra_texts : [],
    });
    console.log("analyzeInput done");

    return res.status(200).json(result);
  } catch (err) {
    console.error("POST /api/project-analysis failed:", err);
    return res.status(500).json({
      status: "failed",
      message: err?.message || "Analysis failed",
      stack: err?.stack || null,
    });
  }
});

export default router;
