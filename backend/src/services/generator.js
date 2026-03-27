import { loadOpenApiDoc } from "./openapiLoader.js";
import {
  extractEndpointsFull,
  extractEndpointsFullSelected,
} from "./openapiParser.js";
import { buildGeneratorPrompt, buildRepairPrompt } from "./prompt.js";
import { getAIProvider } from "../providers/ai/index.js";
import { generateCasesForEndpoints } from "./templateEngine.js";
import { validateTestPlanOrThrow } from "./schemaValidate.js";
import { buildReport } from "./report.js";
import { createCaseIdGenerator } from "./caseIdGenerator.js";
import { validateSpecQuality } from "./specQualityValidator.js";

const SCHEMA_SHAPE_GUIDE = `
Return ONLY JSON.
Top keys: project, generation, suites.
Each suite: suite_id,name,endpoints[],cases[].
Each case: id,title,module,test_type,priority,objective,preconditions[],test_data{path_params,query_params,headers,cookies,request_body},steps[],expected_results[],api_details{method,path},validation_focus[],references[],needs_review,review_notes.
Rules: method uppercase. test_type must be one of contract/schema/negative/auth. review_notes must be a string. Max 4 cases per endpoint.
`.trim();

function nowIso() {
  return new Date().toISOString();
}
function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
function normalizePriority(priority) {
  const p = String(priority || "")
    .toUpperCase()
    .trim();

  if (["P0", "P1", "P2", "P3"].includes(p)) return p;

  const low = String(priority || "")
    .toLowerCase()
    .trim();
  if (low === "critical") return "P0";
  if (low === "high") return "P1";
  if (low === "medium") return "P2";
  if (low === "low") return "P3";

  return "P2";
}

function normalizeTestData(testData = {}) {
  return {
    path_params: testData.path_params || {},
    query_params: testData.query_params || {},
    headers: testData.headers || {},
    cookies: testData.cookies || {},
    request_body:
      testData.request_body !== undefined ? testData.request_body : {},
  };
}
function ensureCaseId(tc, suiteId = "suite", index = 1) {
  if (tc.id && String(tc.id).trim()) return tc.id;

  const method = tc.api_details?.method || "API";
  const path = (tc.api_details?.path || "endpoint")
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

  return `TC_${suiteId.toUpperCase()}_${method}_${path}_${String(index).padStart(3, "0")}`;
}
function safeParseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function tryExtractJsonObject(text) {
  if (!text) return null;
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return safeParseJson(text.slice(first, last + 1));
}

function endpointKey(method, path) {
  return `${String(method || "GET").toUpperCase()} ${String(path || "")}`;
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function trimLeadingSlash(value) {
  return String(value || "").replace(/^\/+/, "");
}

function joinUrlParts(base, path) {
  const b = trimTrailingSlash(base);
  const p = trimLeadingSlash(path);
  if (!b) return path || "/";
  if (!p) return b || "/";
  return `${b}/${p}`;
}

function buildBaseUrlFromEndpoint(endpoint) {
  const serverUrl =
    Array.isArray(endpoint?.servers) && endpoint.servers.length > 0
      ? endpoint.servers[0]?.url
      : "";

  if (serverUrl) return trimTrailingSlash(serverUrl);

  const scheme =
    Array.isArray(endpoint?.schemes) && endpoint.schemes.length > 0
      ? endpoint.schemes[0]
      : "https";

  const host = String(endpoint?.host || "").trim();
  const basePath = String(endpoint?.basePath || "").trim();

  if (host) return trimTrailingSlash(`${scheme}://${host}${basePath}`);
  return trimTrailingSlash(basePath);
}

function buildApiDetails(
  endpoint,
  existingApiDetails = {},
  fallbackBaseUrl = "",
) {
  const method = String(
    existingApiDetails?.method || endpoint?.method || "GET",
  ).toUpperCase();

  const path = existingApiDetails?.path || endpoint?.path || "/";

  const baseUrl =
    existingApiDetails?.base_url ||
    buildBaseUrlFromEndpoint(endpoint) ||
    trimTrailingSlash(fallbackBaseUrl || "");

  return {
    ...existingApiDetails,
    method,
    path,
    base_url: baseUrl || "",
    full_url_template:
      existingApiDetails?.full_url_template || joinUrlParts(baseUrl, path),
    full_url_resolved:
      existingApiDetails?.full_url_resolved || joinUrlParts(baseUrl, path),
  };
}

function buildEndpointMap(endpoints) {
  const map = new Map();
  for (const e of endpoints || []) {
    map.set(endpointKey(e.method, e.path), e);
  }
  return map;
}

function inferCaseEndpoint(testCase, suiteEndpoints, endpointMap) {
  const method =
    testCase?.api_details?.method ||
    testCase?.method ||
    testCase?.request?.method ||
    "GET";

  const path =
    testCase?.api_details?.path ||
    testCase?.path ||
    testCase?.request?.path ||
    "";

  if (path) {
    const exact = endpointMap.get(endpointKey(method, path));
    if (exact) return exact;
  }

  const suiteList = Array.isArray(suiteEndpoints) ? suiteEndpoints : [];
  if (suiteList.length === 1) {
    const only = suiteList[0];
    return (
      endpointMap.get(endpointKey(only.method, only.path)) || {
        method: only.method,
        path: only.path,
        tags: [],
      }
    );
  }

  return {
    method: String(method || "GET").toUpperCase(),
    path: String(path || "/"),
    tags: [],
  };
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}
function detectResponseProfile(endpoint) {
  const responses = endpoint?.responses || {};

  for (const [code, response] of Object.entries(responses)) {
    if (!/^2\d\d$/.test(String(code))) continue;

    const content = response?.content || {};
    const contentTypes = Object.keys(content);
    const contentType = String(contentTypes[0] || "").toLowerCase();

    if (String(code) === "204" || contentTypes.length === 0) {
      return { kind: "empty", contentType, status: String(code) };
    }

    if (contentType.includes("text/html")) {
      return { kind: "html", contentType, status: String(code) };
    }

    if (
      contentType.includes("application/json") ||
      contentType.includes("+json")
    ) {
      return { kind: "json", contentType, status: String(code) };
    }

    if (
      contentType.includes("application/pdf") ||
      contentType.includes("application/octet-stream") ||
      contentType.includes("image/") ||
      contentType.includes("text/csv") ||
      contentType.includes("application/zip")
    ) {
      return { kind: "binary", contentType, status: String(code) };
    }

    return { kind: "other", contentType, status: String(code) };
  }

  const fallbackStatus = String(endpoint?.response?.status || "");
  const fallbackContentType = String(
    endpoint?.response?.contentType || "",
  ).toLowerCase();

  if (fallbackStatus === "204" || !fallbackContentType) {
    return {
      kind: "empty",
      contentType: fallbackContentType,
      status: fallbackStatus,
    };
  }

  if (fallbackContentType.includes("text/html")) {
    return {
      kind: "html",
      contentType: fallbackContentType,
      status: fallbackStatus,
    };
  }

  if (
    fallbackContentType.includes("application/json") ||
    fallbackContentType.includes("+json")
  ) {
    return {
      kind: "json",
      contentType: fallbackContentType,
      status: fallbackStatus,
    };
  }

  if (
    fallbackContentType.includes("application/pdf") ||
    fallbackContentType.includes("application/octet-stream") ||
    fallbackContentType.includes("image/") ||
    fallbackContentType.includes("text/csv") ||
    fallbackContentType.includes("application/zip")
  ) {
    return {
      kind: "binary",
      contentType: fallbackContentType,
      status: fallbackStatus,
    };
  }

  return {
    kind: "other",
    contentType: fallbackContentType,
    status: fallbackStatus,
  };
}

function buildCanonicalValidationByResponse(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const profile = detectResponseProfile(endpoint);

  const baseSteps = [
    "Open an API client such as Postman or any approved API testing tool.",
    `Select the ${method} method.`,
    `Enter the endpoint URL using the configured base URL and path ${path}.`,
  ];

  const hasPathParams =
    Array.isArray(endpoint?.params?.path) && endpoint.params.path.length > 0;
  const hasQueryParams =
    Array.isArray(endpoint?.params?.query) && endpoint.params.query.length > 0;
  const hasHeaders =
    Array.isArray(endpoint?.params?.header) &&
    endpoint.params.header.length > 0;
  const hasCookies =
    Array.isArray(endpoint?.params?.cookie) &&
    endpoint.params.cookie.length > 0;
  const hasBody = !!endpoint?.requestBody;

  if (hasPathParams) {
    baseSteps.push("Add all required path parameter values.");
  }
  if (hasQueryParams) {
    baseSteps.push("Add all required query parameter values.");
  }
  if (hasHeaders) {
    baseSteps.push("Add all required header values.");
  }
  if (hasCookies) {
    baseSteps.push("Add all required cookie values.");
  }
  if (hasBody) {
    baseSteps.push("Provide the request body using the generated test data.");
  }

  baseSteps.push("Send the request.");

  if (profile.kind === "html") {
    return {
      steps: baseSteps,
      expected_results: [
        `The API responds with HTTP ${profile.status || "200"}.`,
        `The response Content-Type contains "${profile.contentType || "text/html"}".`,
        "The response body is returned as an HTML document.",
        "The response body is not empty.",
        "The response contains HTML markup such as <html>, <head>, or <body>.",
      ],
      validation_focus: [
        "HTTP success status",
        "Response content type",
        "HTML document returned",
        "Response body presence",
      ],
    };
  }

  if (profile.kind === "json") {
    return {
      steps: baseSteps,
      expected_results: [
        `The API responds with HTTP ${profile.status || "200"}.`,
        `The response Content-Type contains "${profile.contentType || "application/json"}".`,
        "The response body is valid JSON.",
        "The response structure matches the documented API contract.",
      ],
      validation_focus: [
        "HTTP success status",
        "Response content type",
        "JSON contract validation",
        "Required response structure",
      ],
    };
  }

  if (profile.kind === "binary") {
    return {
      steps: baseSteps,
      expected_results: [
        `The API responds with HTTP ${profile.status || "200"}.`,
        `The response Content-Type contains "${profile.contentType}".`,
        "The response body is returned as a file or binary stream.",
        "The downloaded response is not empty.",
      ],
      validation_focus: [
        "HTTP success status",
        "Response content type",
        "Binary/file response validation",
        "Response size or presence",
      ],
    };
  }

  if (profile.kind === "empty") {
    return {
      steps: baseSteps,
      expected_results: [
        `The API responds with HTTP ${profile.status || "204"}.`,
        "The response body is empty.",
        "The operation completes successfully.",
      ],
      validation_focus: [
        "HTTP success status",
        "No-content response validation",
        "Operation success",
      ],
    };
  }

  return {
    steps: baseSteps,
    expected_results: [
      `The API responds with HTTP ${profile.status || "200"}.`,
      "The response matches the documented API contract.",
    ],
    validation_focus: ["HTTP success status", "Response contract validation"],
  };
}

function applyResponseAwareCaseNormalization(plan, endpoints) {
  if (!plan || !Array.isArray(plan.suites)) return plan;

  const endpointMap = buildEndpointMap(endpoints);

  for (const suite of plan.suites) {
    suite.cases = ensureArray(suite.cases).map((testCase) => {
      const method =
        testCase?.api_details?.method ||
        testCase?.method ||
        testCase?.request?.method ||
        "GET";

      const path =
        testCase?.api_details?.path ||
        testCase?.path ||
        testCase?.request?.path ||
        "";

      const endpoint = endpointMap.get(endpointKey(method, path));
      if (!endpoint) return testCase;

      const canonical = buildCanonicalValidationByResponse(endpoint);
      const profile = detectResponseProfile(endpoint);

      if (
        !Array.isArray(testCase?.steps) ||
        testCase.steps.length === 0 ||
        !Array.isArray(testCase?.expected_results) ||
        testCase.expected_results.length === 0 ||
        !Array.isArray(testCase?.validation_focus) ||
        testCase.validation_focus.length === 0
      ) {
        return {
          ...testCase,
          steps:
            Array.isArray(testCase?.steps) && testCase.steps.length > 0
              ? testCase.steps
              : canonical.steps,
          expected_results:
            Array.isArray(testCase?.expected_results) &&
            testCase.expected_results.length > 0
              ? testCase.expected_results
              : canonical.expected_results,
          validation_focus:
            Array.isArray(testCase?.validation_focus) &&
            testCase.validation_focus.length > 0
              ? testCase.validation_focus
              : canonical.validation_focus,
        };
      }

      return testCase;
    });
  }

  return plan;
}
function getManualSafetyMode(payload) {
  const mode = String(payload?.generation_mode || "balanced").toLowerCase();
  if (mode === "strict") return "strict";
  return "balanced";
}

function filterEndpointsByQuality(allEndpoints, quality, mode = "balanced") {
  const endpointStatusMap = new Map(
    (quality?.endpoint_results || []).map((r) => [r.endpoint_id, r.status]),
  );

  const allowedStatuses =
    mode === "strict" ? new Set(["ready"]) : new Set(["ready", "partial"]);

  return allEndpoints.filter((e) =>
    allowedStatuses.has(endpointStatusMap.get(e.id)),
  );
}

function summarizeBlockedQuality(quality, mode = "balanced") {
  const blockedStatuses =
    mode === "strict" ? new Set(["partial", "blocked"]) : new Set(["blocked"]);

  return (quality?.endpoint_results || []).filter((r) =>
    blockedStatuses.has(r.status),
  );
}

function summarizePartialQuality(quality) {
  return (quality?.endpoint_results || []).filter(
    (r) => r.status === "partial",
  );
}
function enrichSuitesWithCaseIds(plan, allEndpoints, fallbackBaseUrl = "") {
  if (!plan || !Array.isArray(plan.suites)) return plan;

  const endpointMap = buildEndpointMap(allEndpoints);
  const gen = createCaseIdGenerator(allEndpoints);

  for (const suite of plan.suites) {
    suite.endpoints = ensureArray(suite.endpoints);
    suite.cases = ensureArray(suite.cases);

    suite.cases = suite.cases.map((testCase) => {
      const endpoint = inferCaseEndpoint(
        testCase,
        suite.endpoints,
        endpointMap,
      );

      const scenarioName =
        testCase?.title ||
        testCase?.objective ||
        testCase?.name ||
        testCase?.scenario ||
        "";

      const meta = gen.buildCaseMeta(endpoint, 1, scenarioName);

      const { scenario, ...rest } = testCase || {};

      return {
        ...rest,
        id: rest?.id || meta.id,
        title: rest?.title || meta.title,
        module:
          rest?.module ||
          (Array.isArray(endpoint?.tags) && endpoint.tags.length > 0
            ? endpoint.tags[0]
            : endpoint?.path?.split("/").filter(Boolean)[0] || "Default"),
        api_details: buildApiDetails(
          endpoint,
          rest?.api_details,
          fallbackBaseUrl,
        ),
        preconditions: ensureArray(rest?.preconditions),
        steps: ensureArray(rest?.steps),
        expected_results: ensureArray(rest?.expected_results),
        validation_focus: ensureArray(rest?.validation_focus),
        references: ensureArray(rest?.references),
        review_notes:
          typeof rest?.review_notes === "string" ? rest.review_notes : "",
      };
    });
  }

  return plan;
}

/**
 * Build deterministic plan from template engine output
 */
async function buildDeterministicTestPlan({
  project,
  options,
  endpoints,
  caseIdGen,
  fallbackBaseUrl = "",
}) {
  const endpointRefs = endpoints.map((e) => ({
    method: String(e.method).toUpperCase(),
    path: e.path,
  }));

  let cases = await generateCasesForEndpoints(endpoints, options);

  console.log(
    "DETERMINISTIC CASES COUNT:",
    Array.isArray(cases) ? cases.length : "not-array",
  );

  if (Array.isArray(cases)) {
    const perEndpointSeq = new Map();

    cases = cases.map((testCase) => {
      const method =
        testCase?.api_details?.method ||
        testCase?.method ||
        endpoints?.[0]?.method ||
        "GET";
      const path =
        testCase?.api_details?.path ||
        testCase?.path ||
        endpoints?.[0]?.path ||
        "/";

      const endpoint = endpoints.find(
        (e) => endpointKey(e.method, e.path) === endpointKey(method, path),
      ) || {
        method: String(method).toUpperCase(),
        path,
        tags: [],
      };

      const epKey = endpointKey(endpoint.method, endpoint.path);
      const nextSeq = (perEndpointSeq.get(epKey) || 0) + 1;
      perEndpointSeq.set(epKey, nextSeq);

      const scenarioName =
        testCase?.title ||
        testCase?.objective ||
        testCase?.name ||
        testCase?.scenario ||
        "";

      const meta = caseIdGen.buildCaseMeta(endpoint, nextSeq, scenarioName);

      const { scenario, ...rest } = testCase || {};

      return {
        ...rest,
        id: rest?.id || meta.id,
        title: rest?.title || meta.title,
        module:
          rest?.module ||
          (Array.isArray(endpoint?.tags) && endpoint.tags.length > 0
            ? endpoint.tags[0]
            : endpoint?.path?.split("/").filter(Boolean)[0] || "Default"),
        api_details: buildApiDetails(
          endpoint,
          rest?.api_details,
          fallbackBaseUrl,
        ),
        preconditions: ensureArray(rest?.preconditions),
        steps: ensureArray(rest?.steps),
        expected_results: ensureArray(rest?.expected_results),
        validation_focus: ensureArray(rest?.validation_focus),
        references: ensureArray(rest?.references),
        review_notes:
          typeof rest?.review_notes === "string" ? rest.review_notes : "",
      };
    });
  }

  const suites =
    Array.isArray(cases) && cases.length > 0
      ? [
          {
            suite_id: "auto_generated",
            name: "Deterministic Generated Suite",
            endpoints: endpointRefs,
            cases,
          },
        ]
      : [];

  return {
    project,
    generation: {
      generated_at: nowIso(),
      generator_version: "v1",
      model: "deterministic",
      prompt_version: "p1",
      rag_enabled: false,
    },
    suites,
  };
}
function filterGeneratedPlanToEligibleEndpoints(plan, eligibleEndpoints) {
  if (!plan || !Array.isArray(plan.suites)) return plan;

  const eligibleSet = new Set(
    (eligibleEndpoints || []).map((e) => endpointKey(e.method, e.path)),
  );

  for (const suite of plan.suites) {
    suite.endpoints = ensureArray(suite.endpoints).filter((e) =>
      eligibleSet.has(endpointKey(e.method, e.path)),
    );

    suite.cases = ensureArray(suite.cases).filter((testCase) => {
      const method =
        testCase?.api_details?.method ||
        testCase?.method ||
        testCase?.request?.method ||
        "GET";

      const path =
        testCase?.api_details?.path ||
        testCase?.path ||
        testCase?.request?.path ||
        "";

      return eligibleSet.has(endpointKey(method, path));
    });
  }

  plan.suites = plan.suites.filter((s) => ensureArray(s.cases).length > 0);
  return plan;
}
function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function buildDedupKey(tc) {
  const method = String(
    tc?.api_details?.method || tc?.method || "GET",
  ).toUpperCase();

  const path = String(tc?.api_details?.path || tc?.path || "/").trim();

  const type = normalizeText(tc?.test_type);
  const title = normalizeText(tc?.title);
  const objective = normalizeText(tc?.objective);

  return `${method}|${path}|${type}|${title}|${objective}`;
}

function dedupeSuites(plan) {
  if (!plan || !Array.isArray(plan.suites)) return plan;

  const seen = new Set();

  for (const suite of plan.suites) {
    const unique = [];

    for (const tc of suite.cases || []) {
      const key = buildDedupKey(tc);

      if (seen.has(key)) continue;

      seen.add(key);
      unique.push(tc);
    }

    suite.cases = unique;
  }

  plan.suites = plan.suites.filter(
    (s) => Array.isArray(s.cases) && s.cases.length > 0,
  );

  return plan;
}
function stripCaseMeta(testPlan) {
  if (!testPlan || !Array.isArray(testPlan.suites)) return testPlan;

  return {
    ...testPlan,
    suites: testPlan.suites.map((suite) => ({
      ...suite,
      cases: Array.isArray(suite.cases)
        ? suite.cases.map((testCase) => {
            if (!testCase || typeof testCase !== "object") return testCase;
            const { meta, ...rest } = testCase;
            return rest;
          })
        : [],
    })),
  };
}

export async function generateTestPlan(payload) {
  const project_id = payload?.project_id;
  if (!project_id) throw new Error("project_id is required");

  const include = Array.isArray(payload?.include)
    ? payload.include
    : ["contract", "schema", "negative", "auth"];

  const env = payload?.env || "staging";
  const auth_profile = payload?.auth_profile || "device";
  const guidance = payload?.guidance || "";

  const { cfg, doc } = await loadOpenApiDoc(project_id, {
    specSourceOverride: payload?.spec_source || null,
  });

  const selected = Array.isArray(payload?.endpoints) ? payload.endpoints : [];

  const allEndpointsFull =
    selected.length > 0
      ? extractEndpointsFullSelected(doc, selected)
      : extractEndpointsFull(doc);

  let endpointRecordsFull = allEndpointsFull;

  if (endpointRecordsFull.length === 0) {
    const err = new Error(
      "No endpoints matched selection. Check OpenAPI or selection payload.",
    );
    err.details = {
      selected,
      endpoints_found: allEndpointsFull.length,
    };
    throw err;
  }

  // 🔥 optional safety cap for large runs when user did not explicitly select endpoints
  const requestedCount =
    Number.isFinite(Number(payload?.endpoints_n)) &&
    Number(payload.endpoints_n) > 0
      ? Number(payload.endpoints_n)
      : 0;

  if (selected.length === 0 && requestedCount > 0) {
    endpointRecordsFull = endpointRecordsFull.slice(0, requestedCount);
  }

  const generationMode = getManualSafetyMode(payload);
  const specQuality = validateSpecQuality(doc, endpointRecordsFull);

  const blockedForMode = summarizeBlockedQuality(specQuality, generationMode);
  const partialForUi = summarizePartialQuality(specQuality);
  const eligibleEndpointRecords = filterEndpointsByQuality(
    endpointRecordsFull,
    specQuality,
    generationMode,
  );

  console.log("SPEC QUALITY SUMMARY:", specQuality.summary);
  console.log(
    "SPEC QUALITY ENDPOINT STATUS:",
    (specQuality.endpoint_results || []).map((r) => ({
      endpoint_id: r.endpoint_id,
      status: r.status,
      issues_count: r.issues_count,
    })),
  );

  if (eligibleEndpointRecords.length === 0) {
    const err = new Error(
      generationMode === "strict"
        ? "No endpoints are eligible for strict generation. Spec improvement required."
        : "No endpoints are eligible for generation. Spec improvement required.",
    );

    err.details = {
      generation_mode: generationMode,
      spec_quality: specQuality,
      blocked_endpoints: blockedForMode,
      selected_endpoints: endpointRecordsFull.map(
        (e) => `${String(e.method).toUpperCase()} ${e.path}`,
      ),
    };

    throw err;
  }

  console.log("GENERATOR ENDPOINTS COUNT:", endpointRecordsFull.length);
  console.log("SELECTED ENDPOINTS COUNT:", selected.length);
  console.log(
    "SAMPLE ENDPOINTS:",
    endpointRecordsFull
      .slice(0, 5)
      .map((e) => `${String(e.method).toUpperCase()} ${e.path}`),
  );

  const fallbackBaseUrl =
    cfg?.base_url || cfg?.baseUrl || payload?.base_url || "";
  const projectBlock = {
    project_id: cfg.project_id || project_id,
    project_name: cfg.project_name || project_id,
    env,
    base_url_var: "BASE_URL",
    auth_profile,
    auth_vars: ["DEVICE_ID", "SESSION_COOKIE"],
  };

  const options = { include, env, auth_profile, guidance };
  const prompt = buildGeneratorPrompt({
    project: projectBlock,
    options,
    endpointRecords: eligibleEndpointRecords,
    schemaText: SCHEMA_SHAPE_GUIDE,
  });

  let obj = null;
  const BATCH_SIZE = 5; // 🔥 reduce memory pressure

  const endpointBatches = chunkArray(eligibleEndpointRecords, BATCH_SIZE);

  console.log("TOTAL ENDPOINTS:", eligibleEndpointRecords.length);
  console.log("TOTAL BATCHES:", endpointBatches.length);

  let mergedSuites = [];

  for (let i = 0; i < endpointBatches.length; i++) {
    const batch = endpointBatches[i];

    console.log(
      `Processing batch ${i + 1}/${endpointBatches.length} (${batch.length} endpoints)`,
    );

    const batchCaseIdGen = createCaseIdGenerator(batch);

    let batchPlan = await buildDeterministicTestPlan({
      project: projectBlock,
      options,
      endpoints: batch,
      caseIdGen: batchCaseIdGen,
      fallbackBaseUrl,
    });

    batchPlan = enrichSuitesWithCaseIds(batchPlan, batch, fallbackBaseUrl);

    // 🚀 merge only required data
    if (Array.isArray(batchPlan?.suites)) {
      mergedSuites.push(...batchPlan.suites);
    }

    // 🔥 MEMORY LOGGING (very important)
    const mem = process.memoryUsage();
    console.log(`MEMORY AFTER BATCH ${i + 1}:`, {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
    });

    // 🔥 release references
    batchPlan = null;

    // 🔥 allow GC to run
    await new Promise((resolve) => setImmediate(resolve));
  }

  const deterministic = {
    project: projectBlock,
    generation: {
      generated_at: nowIso(),
      generator_version: "v1",
      model: "deterministic",
      prompt_version: "p1",
      rag_enabled: false,
      batching: {
        enabled: true,
        batch_size: BATCH_SIZE,
        total_batches: endpointBatches.length,
      },
    },
    suites: mergedSuites,
  };

  const ai = getAIProvider();
  const wantAI = payload?.ai === true;

  if (wantAI && ai.enabled) {
    try {
      const raw1 = await ai.generate({ prompt, temperature: 0.3 });
      obj = tryExtractJsonObject(raw1);

      if (!obj) {
        const repairPrompt = buildRepairPrompt({
          badJsonText: raw1,
          schemaText: "",
        });

        const raw2 = await ai.generate({
          prompt: repairPrompt,
          temperature: 0.2,
        });

        obj = tryExtractJsonObject(raw2);

        if (!obj) {
          throw new Error("AI output not valid JSON after repair pass");
        }
      }

      obj.generation = obj.generation || {};
      obj.generation.model = obj.generation.model || ai.modelName || "unknown";
      obj.generation.ai_provider = ai.name;
      obj.generation.ai_skipped = false;
    } catch (e) {
      obj = null;
      deterministic.generation = deterministic.generation || {};
      deterministic.generation.ai_provider = ai.name;
      deterministic.generation.ai_skipped = false;
      deterministic.generation.ai_error = String(e?.message || e);
    }
  }

  if (!obj) {
    obj = deterministic;
    obj.generation = obj.generation || {};
    obj.generation.ai_provider = ai.name;
    obj.generation.ai_skipped = !wantAI;
  }

  obj.generation = obj.generation || {};
  obj.generation.generated_at = obj.generation.generated_at || nowIso();
  obj.generation.generator_version = obj.generation.generator_version || "v1";
  obj.generation.model = obj.generation.model || "deterministic";
  obj.generation.prompt_version = obj.generation.prompt_version || "p1";
  obj.generation.rag_enabled = obj.generation.rag_enabled ?? false;

  obj.project = obj.project || projectBlock;
  obj.project.project_id = obj.project.project_id || projectBlock.project_id;
  obj.project.project_name =
    obj.project.project_name || projectBlock.project_name;
  obj.project.env = obj.project.env || projectBlock.env;
  obj.project.base_url_var =
    obj.project.base_url_var || projectBlock.base_url_var;
  obj.project.auth_profile =
    obj.project.auth_profile || projectBlock.auth_profile;
  obj.project.auth_vars = Array.isArray(obj.project.auth_vars)
    ? obj.project.auth_vars
    : projectBlock.auth_vars;

  console.log(
    "SUITE CASE COUNTS:",
    (obj.suites || []).map((s) => ({
      suite_id: s.suite_id,
      name: s.name,
      cases: Array.isArray(s.cases) ? s.cases.length : "not-array",
    })),
  );

  if (!Array.isArray(obj.suites) || obj.suites.length === 0) {
    const err = new Error(
      "No test cases were generated for the eligible endpoints and include types",
    );
    err.details = {
      generation_mode: generationMode,
      selected_endpoints: endpointRecordsFull.map(
        (e) => `${String(e.method).toUpperCase()} ${e.path}`,
      ),
      eligible_endpoints: eligibleEndpointRecords.map(
        (e) => `${String(e.method).toUpperCase()} ${e.path}`,
      ),
      blocked_endpoints: blockedForMode,
      include,
      spec_quality: specQuality,
    };
    throw err;
  }

  obj.generation = {
    ...(obj.generation || {}),
    mode: payload.generation_mode || obj.generation?.mode || "balanced",
  };

  for (const suite of obj.suites || []) {
    suite.endpoints = (suite.endpoints || []).map((ep) => {
      if (typeof ep === "string") return ep;
      if (ep && ep.method && ep.path) {
        return `${String(ep.method).toUpperCase()} ${ep.path}`;
      }
      return String(ep || "");
    });

    (suite.cases || []).forEach((tc, idx) => {
      tc.id = ensureCaseId(tc, suite.suite_id || "suite", idx + 1);
      tc.priority = normalizePriority(tc.priority);
      tc.test_data = normalizeTestData(tc.test_data);
    });
  }

  obj = dedupeSuites(obj);

  for (const suite of obj.suites || []) {
    (suite.cases || []).forEach((tc, idx) => {
      tc.id = ensureCaseId(tc, suite.suite_id || "suite", idx + 1);
    });
  }

  const schemaSafeObj = stripCaseMeta(obj);

  await validateTestPlanOrThrow(schemaSafeObj);

  const report = buildReport(schemaSafeObj);

  return {
    run_id: `run_${Date.now()}`,
    generation_mode: generationMode,
    spec_quality: specQuality,

    blocked_endpoints: blockedForMode.map((ep) => ({
      endpoint_id: ep.endpoint_id,
      method: ep.method,
      path: ep.path,
      status: ep.status,
      issues_count: ep.issues_count,
      issues: Array.isArray(ep.issues) ? ep.issues : [],
    })),

    partial_endpoints: partialForUi.map((ep) => ({
      endpoint_id: ep.endpoint_id,
      method: ep.method,
      path: ep.path,
      status: ep.status,
      issues_count: ep.issues_count,
      issues: Array.isArray(ep.issues) ? ep.issues : [],
    })),

    eligible_endpoints: eligibleEndpointRecords.map((e) => ({
      method: String(e.method).toUpperCase(),
      path: e.path,
      id: e.id,
    })),

    testplan: schemaSafeObj,
    report,
  };
}
