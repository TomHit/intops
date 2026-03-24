import { buildScenarioPlans, validateScenarioCase } from "./scenarioEngine.js";
import { resolveEndpointTestData } from "./testDataResolver.js";

const DEFAULT_INCLUDE = ["contract", "schema", "negative", "auth"];

/* =========================
   INCLUDE NORMALIZATION
========================= */
function normalizeInclude(include) {
  if (!Array.isArray(include) || include.length === 0) {
    return [...DEFAULT_INCLUDE];
  }
  return [...new Set(include.map((x) => String(x).toLowerCase().trim()))];
}

/* =========================
   DEDUP KEY
========================= */
function buildDedupKey(tc) {
  return [
    tc?.api_details?.method,
    tc?.api_details?.path,
    tc?.test_type,
    tc?.title,
    JSON.stringify(tc?.test_data || {}),
  ]
    .map((x) =>
      String(x || "")
        .toLowerCase()
        .trim(),
    )
    .join("|");
}

/* =========================
   MAIN ENGINE
========================= */
export async function generateCasesForEndpoint(endpoint, options = {}) {
  const include = normalizeInclude(options.include);

  const resolvedData = resolveEndpointTestData(endpoint);

  const enrichedEndpoint = {
    ...endpoint,
    _resolvedTestData: resolvedData,
  };

  const profile = {
    endpoint_type: resolvedData.endpoint_type,
    auth: resolvedData.auth,
    success_status: resolvedData.success_status_candidates,
    hasRequestBody: !!resolvedData.valid.body,
    hasResponseSchema: !!resolvedData.response_schema,
    requiresAuth: resolvedData.auth === "required",
    requestBodySchema:
      endpoint?.requestBody?.content?.["application/json"]?.schema,
    requestBodyRequired: !!endpoint?.requestBody?.required,
  };

  const cases = [];
  const dedup = new Set();

  let scenarioPlans = buildScenarioPlans(enrichedEndpoint, profile, []);

  scenarioPlans = scenarioPlans.filter((plan) =>
    include.includes(String(plan?.test_type || "").toLowerCase()),
  );

  for (const plan of scenarioPlans) {
    const tc = plan.build(enrichedEndpoint, profile);
    const validation = validateScenarioCase(tc, profile, plan);

    if (!validation.is_valid) {
      continue;
    }

    const key = buildDedupKey(tc);

    if (!dedup.has(key)) {
      dedup.add(key);
      cases.push(tc);
    }
  }

  return cases;
}

/* =========================
   MULTI ENDPOINT
========================= */
export async function generateCasesForEndpoints(endpoints = [], options = {}) {
  const out = [];

  for (const endpoint of endpoints) {
    const cases = await generateCasesForEndpoint(endpoint, options);
    out.push(...cases);
  }

  return out;
}
