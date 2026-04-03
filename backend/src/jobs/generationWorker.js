import { updateJob } from "./jobStore.js";
import {
  acquireProjectLock,
  extendProjectLock,
  releaseProjectLock,
} from "./projectLock.js";

import { generateTestPlan } from "../services/generator.js";
import {
  completeGenerationRun,
  failGenerationRun,
  updateRunProgress,
} from "../repositories/runsRepo.js";
import {
  insertGeneratedCases,
  countCasesByRun,
  deleteCasesByRun,
} from "../repositories/casesRepo.js";
import {
  getProjectById,
  setProjectCurrentRun,
  setProjectGenerationStatus,
} from "../repositories/projectsRepo.js";

const DEFAULT_GENERATION_MODE = "balanced";
const DEFAULT_INCLUDE_TYPES = ["contract", "schema", "auth", "negative"];
const DEFAULT_ENV = "staging";
const DEFAULT_INSERT_CHUNK_SIZE = 200;
const PROJECT_LOCK_TTL_MS = 30 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function buildProgressSnapshot({
  processedEndpoints,
  endpointCount,
  processedBatches,
  totalBatches,
  insertedCases,
  needsReviewCount,
  message,
}) {
  const safeTotal = Math.max(0, Number(endpointCount || 0));
  const safeCurrent = Math.min(
    safeTotal,
    Math.max(0, Number(processedEndpoints || 0)),
  );
  const percent =
    safeTotal > 0
      ? Math.min(100, Math.round((safeCurrent / safeTotal) * 100))
      : 0;

  return {
    progress_current: safeCurrent,
    progress_total: safeTotal,
    percent,
    processed_batches: processedBatches,
    total_batches: totalBatches,
    inserted_cases: insertedCases,
    needs_review: needsReviewCount,
    endpoint_count: safeTotal,
    message,
  };
}

function normalizeArray(value, fallback = []) {
  return Array.isArray(value) && value.length > 0 ? value : fallback;
}

function normalizeMethod(value) {
  return normalizeString(value, "UNKNOWN").toUpperCase();
}

function normalizePath(value) {
  const path = normalizeString(value, "");
  return path || null;
}

function buildRunConfig(payload = {}) {
  const endpoints = Array.isArray(payload.endpoints) ? payload.endpoints : [];

  return {
    runId: normalizeString(payload.run_id),
    projectId: normalizeString(payload.project_id),
    createdBy: normalizeString(payload.created_by),
    generationMode: normalizeString(
      payload.generation_mode,
      DEFAULT_GENERATION_MODE,
    ),
    includeTypes: normalizeArray(payload.include, DEFAULT_INCLUDE_TYPES),
    env: normalizeString(payload.env, DEFAULT_ENV),
    authProfile: normalizeString(payload.auth_profile),
    endpoints,
    endpointCount: endpoints.length,
  };
}

function buildCaseRows({ cases, runId, projectId, orgId }) {
  return (Array.isArray(cases) ? cases : []).map((tc) => {
    const apiDetails = tc?.api_details || {};

    return {
      case_id: normalizeString(tc?.id),
      run_id: runId,
      project_id: projectId,
      org_id: orgId,
      method: normalizeMethod(apiDetails.method),
      path: normalizePath(apiDetails.path),
      test_type: normalizeString(tc?.test_type, null),
      priority: normalizeString(tc?.priority, null),
      title: normalizeString(tc?.title),
      module: normalizeString(tc?.module, null),
      payload: tc,
    };
  });
}

function buildInitialProgress(config, totalBatches = 0) {
  return buildProgressSnapshot({
    processedEndpoints: 0,
    endpointCount: config.endpointCount,
    processedBatches: 0,
    totalBatches,
    insertedCases: 0,
    needsReviewCount: 0,
    message: `Starting ${totalBatches} batch${totalBatches === 1 ? "" : "es"}`,
  });
}
function buildJobResult({
  runId,
  out,
  totalCases,
  endpointCount,
  needsReviewCount,
  totalBatches,
}) {
  return {
    run_id: runId,
    generation_mode: out?.generation_mode || DEFAULT_GENERATION_MODE,
    spec_quality: out?.spec_quality || null,
    blocked_endpoints: Array.isArray(out?.blocked_endpoints)
      ? out.blocked_endpoints
      : [],
    partial_endpoints: Array.isArray(out?.partial_endpoints)
      ? out.partial_endpoints
      : [],
    eligible_endpoints: Array.isArray(out?.eligible_endpoints)
      ? out.eligible_endpoints
      : [],
    case_count: totalCases,
    endpoint_count: endpointCount || 0,
    needs_review: needsReviewCount,
    total_batches: totalBatches,
    status: "completed",
  };
}

export async function runGenerationJob(jobId, requestBody) {
  let project = null;
  let config = null;
  let lockAcquired = false;
  const lockOwner = jobId;

  try {
    await updateJob(jobId, {
      status: "running",
      started_at: nowIso(),
      error: null,
      progress: null,
    });

    config = buildRunConfig(requestBody);

    if (!config.projectId) {
      throw new Error("project_id is required");
    }

    if (!config.runId) {
      throw new Error("run_id is required");
    }

    if (!config.createdBy) {
      throw new Error("created_by is required");
    }

    lockAcquired = await acquireProjectLock(
      config.projectId,
      lockOwner,
      PROJECT_LOCK_TTL_MS,
    );

    if (!lockAcquired) {
      throw new Error("Generation already in progress for this project");
    }

    project = await getProjectById(config.projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    await setProjectGenerationStatus(config.projectId, "running");
    await updateRunProgress(config.runId, 0);

    const out = await generateTestPlan({
      ...requestBody,
      generation_mode: config.generationMode,
      include: config.includeTypes,
      env: config.env,
      auth_profile: config.authProfile,
      endpoints_n: config.endpointCount,
    });

    const batches = Array.isArray(out?.batches) ? out.batches : [];
    console.log(
      "FIRST BATCH SAMPLE:",
      JSON.stringify(batches[0] || {}, null, 2),
    );
    const totalBatches = batches.length;

    let processedEndpoints = 0;
    let insertedCases = 0;
    let needsReviewCount = 0;
    const seenEndpoints = new Set();

    await updateJob(jobId, {
      status: "running",
      updated_at: nowIso(),
      progress: buildInitialProgress(config, totalBatches),
    });

    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i];
      const batchCases = Array.isArray(batch?.cases) ? batch.cases : [];

      await extendProjectLock(config.projectId, lockOwner, PROJECT_LOCK_TTL_MS);

      const caseRows = buildCaseRows({
        cases: batchCases,
        runId: config.runId,
        projectId: config.projectId,
        orgId: project.org_id,
      });

      const inserted = await insertGeneratedCases(caseRows, {
        chunkSize: DEFAULT_INSERT_CHUNK_SIZE,
      });

      insertedCases += inserted;
      needsReviewCount += batchCases.filter((tc) => !!tc?.needs_review).length;
      batchCases.forEach((tc) => {
        const method = tc?.api_details?.method || "";
        const path = tc?.api_details?.path || "";
        const key = `${method}-${path}`;

        if (method && path) {
          seenEndpoints.add(key);
        }
      });

      processedEndpoints = seenEndpoints.size;

      await updateRunProgress(config.runId, processedEndpoints);

      await updateJob(jobId, {
        status: "running",
        updated_at: nowIso(),
        progress: buildProgressSnapshot({
          processedEndpoints,
          endpointCount: config.endpointCount,
          processedBatches: i + 1,
          totalBatches,
          insertedCases,
          needsReviewCount,
          message: `Processed batch ${i + 1} of ${totalBatches}`,
        }),
      });

      await new Promise((resolve) => setImmediate(resolve));
    }

    const totalCases = await countCasesByRun(config.runId);
    const previousRunId = project.current_run_id;

    await completeGenerationRun(config.runId, totalCases);
    await setProjectCurrentRun(config.projectId, config.runId);
    await setProjectGenerationStatus(config.projectId, "idle");

    if (previousRunId && previousRunId !== config.runId) {
      await deleteCasesByRun(previousRunId);
    }

    await updateJob(jobId, {
      status: "completed",
      completed_at: nowIso(),
      progress: buildProgressSnapshot({
        processedEndpoints: config.endpointCount,
        endpointCount: config.endpointCount,
        processedBatches: totalBatches,
        totalBatches,
        insertedCases: totalCases,
        needsReviewCount,
        message: "Generation completed",
      }),
      result: buildJobResult({
        runId: config.runId,
        out,
        totalCases,
        endpointCount: config.endpointCount,
        needsReviewCount,
        totalBatches,
      }),
    });
  } catch (error) {
    console.error("GENERATION JOB ERROR:", error);

    if (config?.runId) {
      try {
        await failGenerationRun(
          config.runId,
          error?.message || "Generation failed",
        );
      } catch (innerErr) {
        console.error("FAIL RUN UPDATE ERROR:", innerErr);
      }
    }

    if (config?.projectId) {
      try {
        await setProjectGenerationStatus(config.projectId, "idle");
      } catch (innerErr) {
        console.error("PROJECT STATUS RESET ERROR:", innerErr);
      }
    }

    await updateJob(jobId, {
      status: "failed",
      completed_at: nowIso(),
      error: {
        message: error?.message || "Unknown generation error",
        details: error?.details || null,
        code: error?.code || null,
        stack:
          process.env.NODE_ENV === "development" ? error?.stack || null : null,
      },
    });
  } finally {
    if (lockAcquired && config?.projectId) {
      try {
        await releaseProjectLock(config.projectId, lockOwner);
      } catch (innerErr) {
        console.error("PROJECT LOCK RELEASE ERROR:", innerErr);
      }
    }
  }
}
