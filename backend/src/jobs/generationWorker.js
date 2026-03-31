import { updateJob } from "./jobStore.js";

import { generateTestPlan } from "../services/generator.js";
import { renderCsvFromTestPlan } from "../services/csvRenderer.js";

function nowIso() {
  return new Date().toISOString();
}

export async function runGenerationJob(jobId, requestBody) {
  try {
    updateJob(jobId, {
      status: "running",
      started_at: nowIso(),
      error: null,
    });

    const payload = requestBody || {};

    const out = await generateTestPlan(payload);
    const csv = renderCsvFromTestPlan(out.testplan);

    updateJob(jobId, {
      status: "completed",
      completed_at: nowIso(),
      result: {
        run_id: out.run_id,
        generation_mode: out.generation_mode,
        spec_quality: out.spec_quality,
        blocked_endpoints: out.blocked_endpoints,
        eligible_endpoints: out.eligible_endpoints,
        testplan: out.testplan,
        report: out.report,
        csv,
      },
    });
  } catch (error) {
    console.error("GENERATION JOB ERROR:", error);

    const status =
      error?.name === "AjvValidationError" ||
      error?.code === "SCHEMA_INVALID" ||
      error?.details
        ? "failed"
        : "failed";

    updateJob(jobId, {
      status,
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
