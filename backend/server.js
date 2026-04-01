import express from "express";
import fs from "fs/promises";
import path from "path";
import cors from "cors";

import { loadOpenApiDoc } from "./src/services/openapiLoader.js";
import {
  extractEndpointsLite,
  extractEndpointsFull,
} from "./src/services/openapiParser.js";
import { pool, testDbConnection } from "./src/db/postgres.js";
import { createJob, getJob, listJobs } from "./src/jobs/jobStore.js";
import { runGenerationJob } from "./src/jobs/generationWorker.js";

import { validateSpecQuality } from "./src/services/specQualityValidator.js";

import {
  createGenerationRun,
  completeGenerationRun,
  failGenerationRun,
} from "./src/repositories/runsRepo.js";
import {
  insertGeneratedCases,
  countCasesByRun,
  deleteCasesByRun,
  getCasesByRunPaginated,
} from "./src/repositories/casesRepo.js";
import {
  createProjectRecord,
  getProjectById,
  setProjectCurrentRun,
  setProjectGenerationStatus,
} from "./src/repositories/projectsRepo.js";
import { generateTestPlan } from "./src/services/generator.js";

process.on("uncaughtException", (err) =>
  console.error("UNCAUGHT EXCEPTION:", err),
);
process.on("unhandledRejection", (err) =>
  console.error("UNHANDLED REJECTION:", err),
);

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// increase timeouts a bit for local ollama
app.use((req, res, next) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  next();
});

const PROJECTS_DIR = path.join(process.cwd(), "projects");

function summarizeGenerateRequest(payload = {}) {
  return {
    project_id: payload?.project_id || null,
    env: payload?.env || null,
    auth_profile: payload?.auth_profile || "",
    include: Array.isArray(payload?.include) ? payload.include : [],
    ai: !!payload?.ai,
    endpoints_n: Array.isArray(payload?.endpoints)
      ? payload.endpoints.length
      : null,
    guidance_len: payload?.guidance ? String(payload.guidance).length : 0,
  };
}

async function ensureProjectsDir() {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
}

async function loadAllProjects() {
  await ensureProjectsDir();

  const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectFile = path.join(PROJECTS_DIR, entry.name, "project.json");

    try {
      const raw = await fs.readFile(projectFile, "utf-8");
      const parsed = JSON.parse(raw);

      projects.push({
        project_id: parsed.project_id,
        project_name: parsed.project_name,
        env_count: parsed.env_count ?? 1,
        docs_status: parsed.docs_status || "missing",
        description: parsed.description || "",
        spec_source_type: parsed.spec_source_type || "url",
        spec_source: parsed.spec_source || parsed?.openapi?.value || "",
        spec_format: parsed.spec_format || "auto",
        last_generated_at: parsed.last_generated_at || null,
      });
    } catch (err) {
      console.error("PROJECT READ ERROR:", projectFile, err);
    }
  }

  return projects.sort((a, b) =>
    String(a.project_name || "").localeCompare(String(b.project_name || "")),
  );
}

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Projects list from disk
app.get("/api/projects", async (_req, res) => {
  try {
    const projects = await loadAllProjects();
    res.json(projects);
  } catch (e) {
    console.error("PROJECTS ERROR:", e);
    res.status(500).json({ message: e?.message || String(e) });
  }
});

// Create new project
app.post("/api/projects", async (req, res) => {
  try {
    await ensureProjectsDir();

    const body = req.body || {};
    const projectName = String(body.project_name || "").trim();
    const orgId = String(body.org_id || "").trim();

    if (!projectName) {
      return res.status(400).json({ message: "project_name is required" });
    }

    if (!orgId) {
      return res.status(400).json({ message: "org_id is required" });
    }

    const projectId = `proj_${Date.now()}`;
    const projectDir = path.join(PROJECTS_DIR, projectId);

    await fs.mkdir(projectDir, { recursive: true });

    const envCount = Number(body.env_count) || 1;
    const description = String(body.description || "").trim();
    const specSourceType = String(body.spec_source_type || "url").trim();
    const specSource = String(body.spec_source || "").trim();
    const specFormat = String(body.spec_format || "auto").trim();

    const projectConfig = {
      project_id: projectId,
      project_name: projectName,
      env_count: envCount,
      description,
      docs_status: specSource ? "ok" : "missing",
      spec_source_type: specSourceType,
      spec_source: specSource,
      spec_format: specFormat,
      last_generated_at: null,
      openapi: {
        mode: specSourceType === "file" ? "file" : "url",
        value: specSource,
        format: specFormat,
      },
    };

    await fs.writeFile(
      path.join(projectDir, "project.json"),
      JSON.stringify(projectConfig, null, 2),
      "utf-8",
    );

    await createProjectRecord({
      projectId,
      orgId,
      name: projectName,
      specSource,
    });

    res.status(201).json(projectConfig);
  } catch (e) {
    console.error("PROJECT CREATE ERROR:", e);
    res.status(500).json({ message: e?.message || String(e) });
  }
});

// Endpoints list from OpenAPI
app.get("/api/projects/:id/endpoints", async (req, res) => {
  try {
    const projectId = req.params.id;
    const specSource = String(req.query.spec_source || "").trim();

    const { doc } = await loadOpenApiDoc(projectId, {
      specSourceOverride: specSource || null,
    });

    const endpoints = extractEndpointsLite(doc);

    console.log("ENDPOINTS COUNT:", endpoints.length);

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

// Optional full endpoint details if needed later
app.get("/api/projects/:id/endpoints/full", async (req, res) => {
  try {
    const projectId = req.params.id;
    const specSource = String(req.query.spec_source || "").trim();

    const { doc } = await loadOpenApiDoc(projectId, {
      specSourceOverride: specSource || null,
    });

    const endpoints = extractEndpointsFull(doc);
    const quality = validateSpecQuality(doc, { mode: "balanced" });

    const statusMap = new Map(
      (quality?.endpoint_results || []).map((e) => [e.endpoint_id, e]),
    );

    const enriched = endpoints.map((e) => {
      const q = statusMap.get(e.id) || {};

      return {
        ...e,
        issues: q.issues || [],
        issues_count: q.issues_count || 0,
        status: q.status || "unknown",
      };
    });

    res.json(enriched);
  } catch (e) {
    console.error("FULL ENDPOINTS ERROR:", e);
    res.status(400).json({ message: e?.message || String(e) });
  }
});

// Core: generate async job
app.post("/api/generate", async (req, res) => {
  try {
    const payload = req.body || {};
    const summary = summarizeGenerateRequest(payload);

    console.log("POST /api/generate", summary);

    const job = createJob({
      type: "generate_test_plan",
      request_summary: summary,
    });

    setImmediate(() => {
      runGenerationJob(job.job_id, payload);
    });

    return res.status(202).json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
      created_at: job.created_at,
      message: "Generation job accepted",
    });
  } catch (e) {
    console.error("GENERATE JOB CREATE ERROR:", e);
    return res.status(500).json({
      ok: false,
      message: e?.message || String(e),
      stack: e?.stack || null,
    });
  }
});

// Job status
app.get("/api/jobs/:jobId", (req, res) => {
  try {
    const job = getJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({
        ok: false,
        message: "Job not found",
      });
    }

    return res.json({
      ok: true,
      job: {
        job_id: job.job_id,
        status: job.status,
        created_at: job.created_at,
        updated_at: job.updated_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        error: job.error,
        meta: job.meta,
        has_result: !!job.result,
      },
    });
  } catch (e) {
    console.error("JOB STATUS ERROR:", e);
    return res.status(500).json({
      ok: false,
      message: e?.message || String(e),
    });
  }
});

// Job result
app.get("/api/jobs/:jobId/result", (req, res) => {
  try {
    const job = getJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({
        ok: false,
        message: "Job not found",
      });
    }

    if (job.status !== "completed") {
      return res.status(409).json({
        ok: false,
        message: `Job is ${job.status}`,
        error: job.error || null,
      });
    }

    return res.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
      result: job.result,
    });
  } catch (e) {
    console.error("JOB RESULT ERROR:", e);
    return res.status(500).json({
      ok: false,
      message: e?.message || String(e),
    });
  }
});

// List jobs
app.get("/api/jobs", (_req, res) => {
  try {
    const jobs = listJobs().map((job) => ({
      job_id: job.job_id,
      status: job.status,
      created_at: job.created_at,
      updated_at: job.updated_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      error: job.error,
      has_result: !!job.result,
      meta: job.meta,
    }));

    return res.json({
      ok: true,
      jobs,
    });
  } catch (e) {
    console.error("JOBS LIST ERROR:", e);
    return res.status(500).json({
      ok: false,
      message: e?.message || String(e),
    });
  }
});
app.get("/api/runs/:runId/cases", async (req, res) => {
  try {
    const runId = String(req.params.runId || "").trim();

    if (!runId) {
      return res.status(400).json({
        ok: false,
        message: "runId is required",
      });
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(
      1,
      Math.min(500, Number(req.query.page_size || 100)),
    );

    const result = await getCasesByRunPaginated(runId, page, pageSize);

    const cases = (result.cases || []).map((row) => row.payload);

    return res.json({
      ok: true,
      run_id: runId,
      page,
      page_size: pageSize,
      total_cases: result.total || 0,
      cases,
    });
  } catch (e) {
    console.error("RUN CASES DB ERROR:", e);
    return res.status(500).json({
      ok: false,
      message: e?.message || String(e),
    });
  }
});

app.get("/api/db-health", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS now, current_database() AS db, version() AS version",
    );

    return res.json({
      ok: true,
      db: result.rows[0].db,
      now: result.rows[0].now,
      version: result.rows[0].version,
    });
  } catch (e) {
    console.error("DB HEALTH ERROR:", e);
    return res.status(500).json({
      ok: false,
      message: e?.message || String(e),
    });
  }
});

testDbConnection()
  .then((row) => {
    console.log("PostgreSQL connected:", row);
  })
  .catch((err) => {
    console.error("PostgreSQL connection failed:", err);
  });

app.post("/api/generate-db-test", async (req, res) => {
  try {
    const payload = req.body || {};
    const projectId = String(payload.project_id || "").trim();
    const createdBy = String(payload.created_by || "").trim();

    if (!projectId || !createdBy) {
      return res.status(400).json({
        ok: false,
        message: "project_id and created_by are required",
      });
    }

    const project = await getProjectById(projectId);
    if (!project) {
      return res.status(404).json({
        ok: false,
        message: "Project not found",
      });
    }

    await setProjectGenerationStatus(projectId, "running");

    const run = await createGenerationRun({
      projectId,
      orgId: project.org_id,
      createdBy,
      generationMode: payload.generation_mode || "balanced",
      includeTypes: payload.include || ["contract", "schema"],
      env: payload.env || "staging",
      authProfile: payload.auth_profile || "",
      endpointCount: Number(payload.endpoints_n || 0),
    });

    try {
      const result = await generateTestPlan(payload);

      const caseRows = (Array.isArray(result?.cases) ? result.cases : []).map(
        (tc) => ({
          case_id: tc.id,
          run_id: run.run_id,
          project_id: projectId,
          org_id: project.org_id,
          method: String(tc?.api_details?.method || "GET").toUpperCase(),
          path: tc?.api_details?.path || "/",
          test_type: tc.test_type || "contract",
          priority: tc.priority || null,
          title: tc.title || "",
          module: tc.module || null,
          payload: tc,
        }),
      );

      await insertGeneratedCases(caseRows);

      const totalCases = await countCasesByRun(run.run_id);
      const previousRunId = project.current_run_id;

      await completeGenerationRun(run.run_id, totalCases);
      await setProjectCurrentRun(projectId, run.run_id);

      if (previousRunId) {
        await deleteCasesByRun(previousRunId);
      }

      return res.json({
        ok: true,
        run_id: run.run_id,
        case_count: totalCases,
      });
    } catch (err) {
      await failGenerationRun(run.run_id, err?.message || "Generation failed");
      await setProjectGenerationStatus(projectId, "idle");
      throw err;
    }
  } catch (e) {
    console.error("GENERATE DB TEST ERROR:", e);
    return res.status(500).json({
      ok: false,
      message: e?.message || String(e),
    });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
app.listen(PORT, () => {
  console.log(`Generator backend running on http://127.0.0.1:${PORT}`);
  console.log(`Health: http://127.0.0.1:${PORT}/api/health`);
});
