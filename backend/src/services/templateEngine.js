import { buildScenarioPlans, validateScenarioCase } from "./scenarioEngine.js";
import { resolveEndpointTestData } from "./testDataResolver.js";

// CONTRACT
import {
  makeContractSuccessTemplate,
  makeContractStatusCodeTemplate,
  makeContractRequiredFieldsTemplate,
  makeContractContentTypeTemplate,
  makeContractResponseHeadersTemplate,
  makeContractQueryParamsTemplate,
  makeContractPathParamsTemplate,
  makeContractRequestBodyTemplate,
  makeContractErrorResponseTemplate,
} from "../templates/contractTemplates.js";

// SCHEMA
import {
  makeSchemaResponseTemplate,
  makeSchemaRequiredFieldsTemplate,
  makeSchemaFieldTypesTemplate,
  makeSchemaEnumTemplate,
  makeSchemaNestedObjectsTemplate,
  makeSchemaArrayTemplate,
  makeSchemaFormatTemplate,
  makeSchemaNumericConstraintsTemplate,
  makeSchemaStringConstraintsTemplate,
  makeSchemaPatternTemplate,
  makeSchemaCompositionTemplate,
  makeSchemaRequestBodyTemplate,
} from "../templates/schemaTemplates.js";

const DEFAULT_INCLUDE = ["contract", "schema", "negative", "auth"];

function normalizeInclude(include) {
  if (!Array.isArray(include) || include.length === 0) {
    return [...DEFAULT_INCLUDE];
  }

  return [
    ...new Set(
      include.map((x) => String(x).toLowerCase().trim()).filter(Boolean),
    ),
  ];
}

function buildDedupKey(tc) {
  const bodyKeys = Object.keys(tc?.test_data?.request_body || {})
    .sort()
    .join(",");

  const queryKeys = Object.keys(tc?.test_data?.query_params || {})
    .sort()
    .join(",");

  const pathKeys = Object.keys(tc?.test_data?.path_params || {})
    .sort()
    .join(",");

  return [
    tc?.api_details?.method,
    tc?.api_details?.path,
    tc?.test_type,
    tc?.title,
    bodyKeys,
    queryKeys,
    pathKeys,
  ]
    .map((x) =>
      String(x || "")
        .toLowerCase()
        .trim(),
    )
    .join("|");
}

function pushUniqueCases(targetCases, dedup, candidateCases = []) {
  for (const tc of candidateCases) {
    if (!tc || typeof tc !== "object") continue;

    const key = buildDedupKey(tc);

    if (!dedup.has(key)) {
      dedup.add(key);
      targetCases.push(tc);
    }
  }
}

function generateTemplateCases(endpoint, profile, include) {
  const cases = [];

  // CONTRACT
  if (include.includes("contract")) {
    cases.push(makeContractSuccessTemplate(endpoint));
    cases.push(makeContractStatusCodeTemplate(endpoint));
    cases.push(makeContractRequiredFieldsTemplate(endpoint));
    cases.push(makeContractContentTypeTemplate(endpoint));
    cases.push(makeContractResponseHeadersTemplate(endpoint));
    cases.push(makeContractQueryParamsTemplate(endpoint));
    cases.push(makeContractPathParamsTemplate(endpoint));

    if (profile.hasRequestBody) {
      cases.push(makeContractRequestBodyTemplate(endpoint));
    }

    cases.push(makeContractErrorResponseTemplate(endpoint));
  }

  // SCHEMA
  if (include.includes("schema")) {
    cases.push(makeSchemaResponseTemplate(endpoint));
    cases.push(makeSchemaRequiredFieldsTemplate(endpoint));
    cases.push(makeSchemaFieldTypesTemplate(endpoint));
    cases.push(makeSchemaEnumTemplate(endpoint));
    cases.push(makeSchemaNestedObjectsTemplate(endpoint));
    cases.push(makeSchemaArrayTemplate(endpoint));
    cases.push(makeSchemaFormatTemplate(endpoint));
    cases.push(makeSchemaNumericConstraintsTemplate(endpoint));
    cases.push(makeSchemaStringConstraintsTemplate(endpoint));
    cases.push(makeSchemaPatternTemplate(endpoint));

    if (profile.hasResponseSchema) {
      cases.push(makeSchemaCompositionTemplate(endpoint));
    }

    if (profile.hasRequestBody) {
      cases.push(makeSchemaRequestBodyTemplate(endpoint));
    }
  }

  return cases.filter(Boolean);
}

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
    hasRequestBody: !!resolvedData.valid?.body,
    hasResponseSchema: !!resolvedData.response_schema,
    requiresAuth: resolvedData.auth === "required",
    requestBodySchema:
      endpoint?.requestBody?.content?.["application/json"]?.schema,
    requestBodyRequired: !!endpoint?.requestBody?.required,
  };

  const cases = [];
  const dedup = new Set();

  // 1) Contract + Schema template cases
  const templateCases = generateTemplateCases(
    enrichedEndpoint,
    profile,
    include,
  );
  pushUniqueCases(cases, dedup, templateCases);

  // 2) Scenario engine cases (negative + auth, or whatever buildScenarioPlans returns)
  let scenarioPlans = buildScenarioPlans(enrichedEndpoint, profile, []);

  scenarioPlans = scenarioPlans.filter((plan) =>
    include.includes(String(plan?.test_type || "").toLowerCase()),
  );

  for (const plan of scenarioPlans) {
    if (!plan || typeof plan.build !== "function") continue;

    const tc = plan.build(enrichedEndpoint, profile);
    const validation = validateScenarioCase(tc, profile, plan);

    if (!validation?.is_valid) continue;

    pushUniqueCases(cases, dedup, [tc]);
  }

  return cases;
}

export async function generateCasesForEndpoints(endpoints = [], options = {}) {
  const out = [];

  for (const endpoint of endpoints) {
    const cases = await generateCasesForEndpoint(endpoint, options);
    out.push(...cases);
    await new Promise((resolve) => setImmediate(resolve));
  }

  return out;
}
