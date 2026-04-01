import { updateJob } from "./jobStore.js";

import { generateTestPlan } from "../services/generator.js";
import {
  createGenerationRun,
  completeGenerationRun,
  failGenerationRun,
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

function nowIso() {
  return new Date().toISOString();
}

export async function runGenerationJob(jobId, requestBody) {
  let run = null;
  let project = null;

  try {
    updateJob(jobId, {
      status: "running",
      started_at: nowIso(),
      error: null,
    });

    const payload = requestBody || {};
    const projectId = String(payload?.project_id || "").trim();
    const createdBy = String(payload?.created_by || "").trim();

    if (!projectId) {
      throw new Error("project_id is required");
    }

    if (!createdBy) {
      throw new Error("created_by is required");
    }

    project = await getProjectById(projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    await setProjectGenerationStatus(projectId, "running");

    run = await createGenerationRun({
      projectId,
      orgId: project.org_id,
      createdBy,
      generationMode: payload?.generation_mode || "balanced",
      includeTypes: payload?.include || [
        "contract",
        "schema",
        "auth",
        "negative",
      ],
      env: payload?.env || "staging",
      authProfile: payload?.auth_profile || "",
      endpointCount: Number(payload?.endpoints_n || 0),
    });

    const out = await generateTestPlan(payload);

    const caseRows = (Array.isArray(out?.cases) ? out.cases : []).map((tc) => ({
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
    }));

    if (caseRows.length > 0) {
      await insertGeneratedCases(caseRows);
    }

    const totalCases = await countCasesByRun(run.run_id);
    const previousRunId = project.current_run_id;

    await completeGenerationRun(run.run_id, totalCases);
    await setProjectCurrentRun(projectId, run.run_id);

    if (previousRunId) {
      await deleteCasesByRun(previousRunId);
    }

    updateJob(jobId, {
      status: "completed",
      completed_at: nowIso(),
      result: {
        run_id: run.run_id,
        generation_mode: out.generation_mode,
        spec_quality: out.spec_quality,
        blocked_endpoints: out.blocked_endpoints,
        partial_endpoints: out.partial_endpoints,
        eligible_endpoints: out.eligible_endpoints,
        case_count: totalCases,
        status: "completed",
      },
    });
  } catch (error) {
    console.error("GENERATION JOB ERROR:", error);

    if (run?.run_id) {
      try {
        await failGenerationRun(
          run.run_id,
          error?.message || "Generation failed",
        );
      } catch (innerErr) {
        console.error("FAIL RUN UPDATE ERROR:", innerErr);
      }
    }

    if (project?.project_id) {
      try {
        await setProjectGenerationStatus(project.project_id, "idle");
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
