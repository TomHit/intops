import express from "express";

import { generateTestPlan } from "./src/services/generator.js";
import { renderCsvFromTestPlan } from "./src/services/csvRenderer.js";

import { loadOpenApiDoc } from "./src/services/openapiLoader.js";
import { extractEndpoints } from "./src/services/openapiParser.js";

process.on("uncaughtException", (err) =>
  console.error("UNCAUGHT EXCEPTION:", err),
);
process.on("unhandledRejection", (err) =>
  console.error("UNHANDLED REJECTION:", err),
);

const app = express();
app.use(express.json({ limit: "2mb" }));

// increase timeouts a bit for local ollama
app.use((req, res, next) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  next();
});

// Health
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Projects (static MVP)
app.get("/api/projects", async (req, res) => {
  res.json([
    {
      project_id: "xtl-api",
      project_name: "XTL API",
      docs_status: "ok",
      env_count: 1,
      last_generated_at: null,
    },
  ]);
});

// Endpoints list from OpenAPI
app.get("/api/projects/:id/endpoints", async (req, res) => {
  try {
    const projectId = req.params.id;
    const { doc } = await loadOpenApiDoc(projectId);
    const endpoints = extractEndpoints(doc);

    res.json(
      endpoints.map((e) => ({
        id: e.id,
        method: e.method,
        path: e.path,
        tags: e.tags || [],
        summary: e.summary || "",
        response: e.response || null,
      })),
    );
  } catch (e) {
    console.error("ENDPOINTS ERROR:", e);
    res.status(400).json({ message: e?.message || String(e) });
  }
});

// Core: generate
app.post("/api/generate", async (req, res) => {
  try {
    const payload = req.body || {};

    console.log("POST /api/generate", {
      project_id: payload?.project_id,
      env: payload?.env,
      auth_profile: payload?.auth_profile,
      include: payload?.include,
      ai: payload?.ai,
      endpoints_n: Array.isArray(payload?.endpoints)
        ? payload.endpoints.length
        : null,
      guidance_len: payload?.guidance ? String(payload.guidance).length : 0,
    });

    const out = await generateTestPlan(payload);
    const csv = renderCsvFromTestPlan(out.testplan);

    res.json({
      run_id: out.run_id,
      testplan: out.testplan,
      report: out.report,
      csv,
    });
  } catch (e) {
    console.error("GENERATE ERROR:", e);

    const status =
      e?.name === "AjvValidationError" ||
      e?.code === "SCHEMA_INVALID" ||
      e?.details
        ? 400
        : 500;

    res.status(status).json({
      message: e?.message || String(e),
      details: e?.details || null,
      ...(status === 500 ? { stack: e?.stack || null } : {}),
    });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
app.listen(PORT, () => {
  console.log(`Generator backend running on http://127.0.0.1:${PORT}`);
  console.log(`Health: http://127.0.0.1:${PORT}/api/health`);
});
