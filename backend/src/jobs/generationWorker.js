import { updateJob } from "./jobStore.js";

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

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
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

function buildInitialProgress(config) {
  return {
    progress_current: 0,
    progress_total: config.endpointCount,
    processed_batches: 0,
    total_batches: 0,
    inserted_cases: 0,
    needs_review: 0,
    endpoint_count: 0,
  };
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

  try {
    updateJob(jobId, {
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
    const totalBatches = batches.length;

    let processedEndpoints = 0;
    let insertedCases = 0;
    let needsReviewCount = 0;

    updateJob(jobId, {
      status: "running",
      updated_at: nowIso(),
      progress: {
        ...buildInitialProgress(config),
        total_batches: totalBatches,
        message: `Starting ${totalBatches} batch${totalBatches === 1 ? "" : "es"}`,
      },
    });

    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i];
      const batchCases = Array.isArray(batch?.cases) ? batch.cases : [];
      const batchEndpoints = Number(batch?.endpoints_count || 0);

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
      processedEndpoints += batchEndpoints;

      await updateRunProgress(config.runId, processedEndpoints);

      updateJob(jobId, {
        status: "running",
        updated_at: nowIso(),
        progress: {
          progress_current: processedEndpoints,
          progress_total: config.endpointCount,
          processed_batches: i + 1,
          total_batches: totalBatches,
          inserted_cases: insertedCases,
          needs_review: needsReviewCount,
          endpoint_count: config.endpointCount,
          message: `Processed batch ${i + 1} of ${totalBatches}`,
        },
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

    updateJob(jobId, {
      status: "completed",
      completed_at: nowIso(),
      progress: {
        progress_current: config.endpointCount,
        progress_total: config.endpointCount,
        processed_batches: totalBatches,
        total_batches: totalBatches,
        inserted_cases: totalCases,
        needs_review: needsReviewCount,
        endpoint_count: config.endpointCount,
        message: "Generation completed",
      },
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

    updateJob(jobId, {
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
  }
}
