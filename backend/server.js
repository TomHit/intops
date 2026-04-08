import express from "express";

import projectAnalysisRoute from "./src/routes/projectAnalysis.js";
import fs from "fs/promises";
import path from "path";
import cors from "cors";
import crypto from "crypto";

import { loadOpenApiDoc } from "./src/services/openapiLoader.js";
import {
  extractEndpointsLite,
  extractEndpointsFull,
} from "./src/services/openapiParser.js";
import documentAnalysisRoute from "./src/routes/documentAnalysis.js";
import { pool, testDbConnection } from "./src/db/postgres.js";
import { createJob, getJob, listJobs } from "./src/jobs/jobStore.js";
import { subscribeJob } from "./src/jobs/jobEvents.js";

import { validateSpecQuality } from "./src/services/specQualityValidator.js";

import { createGenerationRun } from "./src/repositories/runsRepo.js";
import { getCasesByRunPaginated } from "./src/repositories/casesRepo.js";
import {
  createProjectRecord,
  getProjectById,
  listAllProjects,
} from "./src/repositories/projectsRepo.js";
import { enqueueGenerationJob } from "./src/jobs/generationQueue.js";
import "./src/workers/generationWorkerProcess.js";

function sendSuccess(res, data = {}, status = 200) {
  return res.status(status).json({
    ok: true,
    data,
  });
}

function sendError(res, message = "Something went wrong", status = 500) {
  return res.status(status).json({
    ok: false,
    message,
  });
}

process.on("uncaughtException", (err) =>
  console.error("UNCAUGHT EXCEPTION:", err),
);
process.on("unhandledRejection", (err) =>
  console.error("UNHANDLED REJECTION:", err),
);

const app = express();

app.use(cors());

app.use((req, res, next) => {
  console.log(
    "INCOMING:",
    req.method,
    req.url,
    "| content-type:",
    req.headers["content-type"],
  );
  next();
});

app.use(express.json({ limit: "2mb" }));

app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      ok: false,
      message: "Invalid JSON body",
      error: {
        type: "INVALID_JSON",
        detail: err.message,
      },
    });
  }

  return res.status(500).json({
    ok: false,
    message: "Internal server error",
    error: {
      type: "INTERNAL_ERROR",
      detail: err?.message || "Unknown error",
    },
  });
  return next(err);
});

// increase timeouts a bit for local ollama
app.use((req, res, next) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  next();
});
app.use("/api", documentAnalysisRoute);
app.use("/api/project-analysis", projectAnalysisRoute);

const PROJECTS_DIR = path.join(process.cwd(), "projects");

function normalizeOrgNameFromEmail(email = "") {
  const domain = String(email).split("@")[1] || "";
  const base = domain.split(".")[0] || "organization";
  return (
    base.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ||
    "Organization"
  );
}
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
app.get("/api/health", (_req, res) => {
  return sendSuccess(res, { status: "healthy" });
});

app.post("/api/auth/org-login", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "").trim();

    if (!email) {
      return res.status(400).json({ ok: false, message: "email is required" });
    }

    if (!password) {
      return res
        .status(400)
        .json({ ok: false, message: "password is required" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const domain = email.split("@")[1] || "";
      const orgSlug = domain ? domain.replace(/\./g, "_") : "default_org";
      const orgName = normalizeOrgNameFromEmail(email);
      const fullName = email.split("@")[0] || "User";

      let org = null;
      const orgLookup = await client.query(
        `SELECT * FROM organizations WHERE slug = $1 LIMIT 1`,
        [orgSlug],
      );

      if (orgLookup.rows.length > 0) {
        org = orgLookup.rows[0];
      } else {
        const orgId = crypto.randomUUID();
        const orgInsert = await client.query(
          `
          INSERT INTO organizations (org_id, name, slug)
          VALUES ($1, $2, $3)
          RETURNING *
          `,
          [orgId, orgName, orgSlug],
        );
        org = orgInsert.rows[0];
      }

      let user = null;
      const userLookup = await client.query(
        `SELECT * FROM users WHERE email = $1 LIMIT 1`,
        [email],
      );

      if (userLookup.rows.length > 0) {
        user = userLookup.rows[0];
      } else {
        const userId = crypto.randomUUID();
        const userInsert = await client.query(
          `
          INSERT INTO users (user_id, email, full_name)
          VALUES ($1, $2, $3)
          RETURNING *
          `,
          [userId, email, fullName],
        );
        user = userInsert.rows[0];
      }

      const membershipLookup = await client.query(
        `
        SELECT * FROM organization_members
        WHERE org_id = $1 AND user_id = $2
        LIMIT 1
        `,
        [org.org_id, user.user_id],
      );

      if (membershipLookup.rows.length === 0) {
        await client.query(
          `
          INSERT INTO organization_members (org_id, user_id, role)
          VALUES ($1, $2, $3)
          `,
          [org.org_id, user.user_id, "owner"],
        );
      }

      await client.query("COMMIT");

      return res.json({
        ok: true,
        user: {
          user_id: user.user_id,
          email: user.email,
          full_name: user.full_name || "",
        },
        organization: {
          org_id: org.org_id,
          name: org.name,
          slug: org.slug || "",
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("ORG LOGIN ERROR:", e);
    return res.status(500).json({
      ok: false,
      message: e?.message || String(e),
    });
  }
});
// Projects list from disk
app.get("/api/projects", async (_req, res) => {
  try {
    const rows = await listAllProjects();

    const projects = rows.map((p) => ({
      project_id: p.project_id,
      org_id: p.org_id,
      project_name: p.name,
      env_count: p.env_count ?? 1,
      docs_status: p.docs_status || "missing",
      description: p.description || "",
      spec_source_type: p.spec_source_type || "url",
      spec_source: p.spec_source || "",
      spec_format: p.spec_format || "auto",
      last_generated_at: p.last_generated_at || null,
      current_run_id: p.current_run_id || null,
      generation_status: p.generation_status || "idle",
    }));

    return sendSuccess(res, { projects });
  } catch (e) {
    console.error("PROJECTS ERROR:", e);
    res.status(500).json({ message: e?.message || String(e) });
  }
});

// Create new project
app.post("/api/projects", async (req, res) => {
  try {
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

    const envCount = Number(body.env_count) || 1;
    const description = String(body.description || "").trim();
    const specSourceType = String(body.spec_source_type || "url").trim();
    const specSource = String(body.spec_source || "").trim();
    const specFormat = String(body.spec_format || "auto").trim();
    const docsStatus = specSource ? "ok" : "missing";

    const created = await createProjectRecord({
      projectId,
      orgId,
      name: projectName,
      description,
      specSourceType,
      specSource,
      specFormat,
      docsStatus,
    });

    return sendSuccess(
      res,
      {
        project_id: created.project_id,
        org_id: created.org_id,
        project_name: created.name,
        env_count: envCount,
        description: created.description || "",
        docs_status: created.docs_status || docsStatus,
        spec_source_type: created.spec_source_type || specSourceType,
        spec_source: created.spec_source || specSource,
        spec_format: created.spec_format || specFormat,
        last_generated_at: created.last_generated_at || null,
        current_run_id: created.current_run_id || null,
        generation_status: created.generation_status || "idle",
      },
      201,
    );
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
    return sendSuccess(res, {
      endpoints: endpoints.map((e) => ({
        id: e.id,
        method: e.method,
        path: e.path,
        tags: e.tags || [],
        summary: e.summary || "",
        response: e.response || null,
      })),
    });
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

    return sendSuccess(res, { endpoints: enriched });
  } catch (e) {
    console.error("FULL ENDPOINTS ERROR:", e);
    res.status(400).json({ message: e?.message || String(e) });
  }
});

// Core: generate async job
app.post("/api/generate", async (req, res) => {
  try {
    const payload = req.body || {};

    const projectId = String(payload.project_id || "").trim();
    if (!projectId) {
      return res.status(400).json({ message: "project_id is required" });
    }

    const project = await getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // 🔥 IMPORTANT: backend owns identity (replace later with auth)

    const createdBy = String(payload.created_by || "").trim();
    if (!createdBy) {
      return res
        .status(400)
        .json({ ok: false, message: "created_by is required" });
    }

    const endpoints = Array.isArray(payload.endpoints) ? payload.endpoints : [];

    const run = await createGenerationRun({
      projectId,
      orgId: project.org_id,
      createdBy,
      generationMode: payload.generation_mode || "balanced",
      includeTypes: payload.include || ["contract", "schema"],
      env: payload.env || "staging",
      authProfile: payload.auth_profile || "",
      endpointCount: endpoints.length,
    });

    const job = await createJob({
      type: "generate_test_plan",
      request_summary: summarizeGenerateRequest(payload),
      meta: { run_id: run.run_id, project_id: projectId },
    });

    await enqueueGenerationJob({
      job_id: job.job_id,
      request_body: {
        ...payload,
        created_by: createdBy,
        run_id: run.run_id,
      },
    });

    return res.status(202).json({
      ok: true,
      job_id: job.job_id,
      run_id: run.run_id, // 👈 CRITICAL
      status: "queued",
    });
  } catch (e) {
    console.error("GENERATE ERROR:", e);
    return res.status(500).json({
      ok: false,
      message: e?.message || String(e),
    });
  }
});

app.get("/api/jobs/:jobId/progress", async (req, res) => {
  try {
    const job = await getJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({
        ok: false,
        message: "Job not found",
      });
    }

    return res.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
      progress: job.progress || {
        progress_current: 0,
        progress_total: 0,
        percent: 0,
        processed_batches: 0,
        total_batches: 0,
        inserted_cases: 0,
        needs_review: 0,
        endpoint_count: 0,
        message: job.status === "queued" ? "Queued" : "",
      },
      error: job.error || null,
      has_result: !!job.result,
    });
  } catch (e) {
    console.error("JOB PROGRESS ERROR:", e);
    return res.status(500).json({
      ok: false,
      message: e?.message || String(e),
    });
  }
});
// Job status
app.get("/api/jobs/:jobId", async (req, res) => {
  try {
    const job = await getJob(req.params.jobId);

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

app.get("/api/jobs/:jobId/events", async (req, res) => {
  try {
    const jobId = String(req.params.jobId || "").trim();
    if (!jobId) {
      return res.status(400).json({ ok: false, message: "jobId is required" });
    }

    const job = await getJob(jobId);
    if (!job) {
      return res.status(404).json({ ok: false, message: "Job not found" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    const send = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send("snapshot", {
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
        result: job.result,
        progress: job.progress || null,
        has_result: !!job.result,
      },
    });

    const unsubscribe = subscribeJob(jobId, (payload) => {
      send("progress", payload);
    });

    const heartbeat = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  } catch (e) {
    console.error("JOB EVENTS ERROR:", e);
    if (!res.headersSent) {
      return res.status(500).json({
        ok: false,
        message: e?.message || String(e),
      });
    }
    res.end();
  }
});

// Job result
app.get("/api/jobs/:jobId/result", async (req, res) => {
  try {
    const job = await getJob(req.params.jobId);

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
app.get("/api/jobs", async (_req, res) => {
  try {
    const jobsRaw = await listJobs();

    const jobs = jobsRaw.map((job) => ({
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

    return sendSuccess(res, {
      run_id,
      page,
      page_size,
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

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
app.listen(PORT, () => {
  console.log(`Generator backend running on http://127.0.0.1:${PORT}`);
  console.log(`Health: http://127.0.0.1:${PORT}/api/health`);
});
