import { loadOpenApiDoc } from "./openapiLoader.js";
import { extractEndpoints } from "./openapiParser.js";
import { buildGeneratorPrompt, buildRepairPrompt } from "./prompt.js";
import { getAIProvider } from "../providers/ai/index.js";
import { generateCasesForEndpoints } from "./templateEngine.js";
import { validateTestPlanOrThrow } from "./schemaValidate.js";
import { buildReport } from "./report.js";
import { createCaseIdGenerator } from "./caseIdGenerator.js";

const SCHEMA_SHAPE_GUIDE = `
Return ONLY JSON.
Top keys: project, generation, suites.
Each suite: suite_id,name,endpoints[],cases[].
Each case: id,title,module,test_type,priority,objective,preconditions[],test_data{path_params,query_params,headers,request_body},steps[],expected_results[],api_details{method,path},validation_focus[],references[],needs_review,review_notes.
Rules: method uppercase. test_type must be one of contract/schema/negative/auth. review_notes must be a string. Max 4 cases per endpoint.
`.trim();

function nowIso() {
  return new Date().toISOString();
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

function enrichSuitesWithCaseIds(plan, allEndpoints) {
  if (!plan || !Array.isArray(plan.suites)) return plan;

  const endpointMap = buildEndpointMap(allEndpoints);
  const gen = createCaseIdGenerator(allEndpoints);

  for (const suite of plan.suites) {
    suite.endpoints = ensureArray(suite.endpoints);
    suite.cases = ensureArray(suite.cases);

    const perEndpointSeq = new Map();

    suite.cases = suite.cases.map((testCase) => {
      const endpoint = inferCaseEndpoint(
        testCase,
        suite.endpoints,
        endpointMap,
      );
      const epKey = endpointKey(endpoint.method, endpoint.path);
      const nextSeq = (perEndpointSeq.get(epKey) || 0) + 1;
      perEndpointSeq.set(epKey, nextSeq);

      const scenarioName =
        testCase?.title ||
        testCase?.objective ||
        testCase?.name ||
        testCase?.scenario ||
        "";

      const meta = gen.buildCaseMeta(endpoint, nextSeq, scenarioName);

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
        api_details: {
          method: String(
            rest?.api_details?.method || endpoint?.method || "GET",
          ).toUpperCase(),
          path: rest?.api_details?.path || endpoint?.path || "/",
        },
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
  console.dir(cases, { depth: null });

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
        api_details: {
          method: String(
            rest?.api_details?.method || endpoint?.method || "GET",
          ).toUpperCase(),
          path: rest?.api_details?.path || endpoint?.path || "/",
        },
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

export async function generateTestPlan(payload) {
  const project_id = payload?.project_id;
  if (!project_id) throw new Error("project_id is required");

  const include = Array.isArray(payload?.include)
    ? payload.include
    : ["contract", "schema"];

  const env = payload?.env || "staging";
  const auth_profile = payload?.auth_profile || "device";
  const guidance = payload?.guidance || "";

  // Load OpenAPI + project config
  const { cfg, doc } = await loadOpenApiDoc(project_id, {
    specSourceOverride: payload?.spec_source || null,
  });

  // Parse endpoints catalog
  const allEndpoints = extractEndpoints(doc);

  // Selected endpoints from UI
  const selected = Array.isArray(payload?.endpoints) ? payload.endpoints : [];
  let endpointRecords = allEndpoints;

  if (selected.length > 0) {
    const keyset = new Set(
      selected.map((e) => `${String(e.method).toUpperCase()} ${e.path}`),
    );

    endpointRecords = allEndpoints.filter((e) =>
      keyset.has(`${String(e.method).toUpperCase()} ${e.path}`),
    );
  }

  if (endpointRecords.length === 0) {
    const err = new Error(
      "No endpoints matched selection. Check OpenAPI or selection payload.",
    );
    err.details = {
      selected,
      endpoints_found: allEndpoints.length,
    };
    throw err;
  }

  console.log("GENERATOR ENDPOINTS COUNT:", allEndpoints.length);
  console.log(
    "GENERATOR ENDPOINT PATHS:",
    allEndpoints.map((e) => `${String(e.method).toUpperCase()} ${e.path}`),
  );
  console.log(
    "SELECTED PAYLOAD ENDPOINTS:",
    selected.map((e) => `${String(e.method).toUpperCase()} ${e.path}`),
  );

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
    endpointRecords,
    schemaText: SCHEMA_SHAPE_GUIDE,
  });

  const caseIdGen = createCaseIdGenerator(allEndpoints);

  // ------------------------------
  // Deterministic-first baseline
  // ------------------------------
  let obj = null;

  const deterministic = await buildDeterministicTestPlan({
    project: projectBlock,
    options,
    endpoints: endpointRecords,
    caseIdGen,
  });

  // ------------------------------
  // Optional AI enrichment
  // ------------------------------
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

  // fallback to deterministic if AI disabled / failed
  if (!obj) {
    obj = deterministic;
    obj.generation = obj.generation || {};
    obj.generation.ai_provider = ai.name;
    obj.generation.ai_skipped = !wantAI;
  }

  // final enrichment
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

  obj = enrichSuitesWithCaseIds(obj, allEndpoints);

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
      "No test cases were generated for the selected endpoints and include types",
    );
    err.details = {
      selected_endpoints: endpointRecords.map(
        (e) => `${String(e.method).toUpperCase()} ${e.path}`,
      ),
      include,
    };
    throw err;
  }

  await validateTestPlanOrThrow(obj);

  const report = buildReport(obj);

  return {
    run_id: `run_${Date.now()}`,
    testplan: obj,
    report,
  };
}
