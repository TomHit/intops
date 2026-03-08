import { loadRuleCatalog } from "../rules/loadRuleCatalog.js";
import { RULE_CONDITION_MAP } from "../rules/ruleConditionMap.js";
import { TEMPLATE_REGISTRY } from "./templateRegistry.js";
import { resolveEndpointTestData } from "./testDataResolver.js";
function firstItem(list) {
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

function firstByLocation(list, location) {
  const items = Array.isArray(list) ? list : [];
  return items.find((x) => x?.location === location) || items[0] || null;
}
function mergeObjects(base, extra) {
  return {
    ...(base && typeof base === "object" ? base : {}),
    ...(extra && typeof extra === "object" ? extra : {}),
  };
}

function inferResolvedTestData(templateKey, endpoint) {
  const resolved =
    endpoint?._resolvedTestData || resolveEndpointTestData(endpoint);

  const validRequest = {
    path_params: resolved?.valid?.path || {},
    query_params: resolved?.valid?.query || {},
    headers: resolved?.valid?.headers || {},
    request_body: resolved?.valid?.body,
  };

  switch (templateKey) {
    case "negative.missing_required_query":
      return (
        firstByLocation(resolved?.negative?.missingRequired, "query")
          ?.request || validRequest
      );

    case "negative.missing_required_path":
      return (
        firstByLocation(resolved?.negative?.missingRequired, "path")?.request ||
        validRequest
      );

    case "negative.empty_body":
      return (
        firstByLocation(resolved?.negative?.missingRequired, "body")
          ?.request || {
          ...validRequest,
          request_body: undefined,
        }
      );

    case "negative.invalid_query_type":
      return (
        firstItem(resolved?.negative?.invalidType)?.request || validRequest
      );

    case "negative.invalid_enum":
      return (
        firstItem(resolved?.negative?.invalidEnum)?.request || validRequest
      );

    case "negative.invalid_format":
      return (
        firstItem(resolved?.negative?.invalidFormat)?.request || validRequest
      );

    case "negative.string_too_long":
      return (
        firstItem(resolved?.negative?.stringTooLong)?.request || validRequest
      );

    case "negative.numeric_above_maximum":
      return (
        firstItem(resolved?.negative?.numericAboveMaximum)?.request ||
        validRequest
      );

    case "negative.invalid_content_type":
      return {
        ...validRequest,
        headers: {
          ...(validRequest.headers || {}),
          "Content-Type": "text/plain",
        },
      };

    case "negative.malformed_json":
      return {
        ...validRequest,
        headers: {
          ...(validRequest.headers || {}),
          "Content-Type": "application/json",
        },
        request_body: "{invalid-json",
      };

    case "negative.null_required_field": {
      const body = resolved?.valid?.body;
      if (body && typeof body === "object" && !Array.isArray(body)) {
        const firstField = Object.keys(body)[0];
        if (firstField) {
          return {
            ...validRequest,
            request_body: {
              ...body,
              [firstField]: null,
            },
          };
        }
      }
      return validRequest;
    }

    case "negative.additional_property": {
      const body = resolved?.valid?.body;
      if (body && typeof body === "object" && !Array.isArray(body)) {
        return {
          ...validRequest,
          request_body: {
            ...body,
            unexpectedProperty: "extra-value",
          },
        };
      }
      return validRequest;
    }

    default:
      return validRequest;
  }
}
function normalizeMethod(method) {
  return String(method || "").toUpperCase();
}

function methodMatchesFilter(endpoint, methodFilter) {
  if (!methodFilter) return true;

  const endpointMethod = normalizeMethod(endpoint?.method);
  const allowed = String(methodFilter)
    .split("|")
    .map((m) => normalizeMethod(m.trim()))
    .filter(Boolean);

  if (allowed.length === 0) return true;
  return allowed.includes(endpointMethod);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensureObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function annotateCase(tc, rule, endpoint) {
  if (!tc) return null;

  tc.references = ensureArray(tc.references);
  tc.preconditions = ensureArray(tc.preconditions);
  tc.steps = ensureArray(tc.steps);
  tc.expected_results = ensureArray(tc.expected_results);
  tc.validation_focus = ensureArray(tc.validation_focus);
  tc.test_data = ensureObject(tc.test_data);

  tc.api_details = {
    method: normalizeMethod(
      tc?.api_details?.method || endpoint?.method || "GET",
    ),
    path: tc?.api_details?.path || endpoint?.path || "/",
  };

  if (rule?.rule_id) {
    tc.references.push(`rule_id:${rule.rule_id}`);
  }
  if (rule?.scenario) {
    tc.references.push(`scenario:${rule.scenario}`);
  }

  const resolvedTemplateKey = getTemplateKey(rule);
  if (resolvedTemplateKey) {
    tc.references.push(`template_key:${resolvedTemplateKey}`);
  }

  if (rule?.category && !tc.test_type) {
    tc.test_type = String(rule.category).toLowerCase();
  }

  if (!tc.module) {
    tc.module =
      (Array.isArray(endpoint?.tags) && endpoint.tags[0]) ||
      String(endpoint?.path || "")
        .split("/")
        .filter(Boolean)[0] ||
      "Default";
  }

  if (typeof tc.review_notes !== "string") {
    tc.review_notes = rule?.notes ? String(rule.notes) : "";
  } else if (!tc.review_notes && rule?.notes) {
    tc.review_notes = String(rule.notes);
  }

  if (typeof tc.needs_review !== "boolean") {
    tc.needs_review = false;
  }

  const resolvedData = inferResolvedTestData(resolvedTemplateKey, endpoint);
  tc.test_data = {
    path_params: mergeObjects(
      resolvedData?.path_params,
      tc?.test_data?.path_params,
    ),
    query_params: mergeObjects(
      resolvedData?.query_params,
      tc?.test_data?.query_params,
    ),
    headers: mergeObjects(resolvedData?.headers, tc?.test_data?.headers),
    request_body:
      tc?.test_data?.request_body !== undefined
        ? tc.test_data.request_body
        : resolvedData?.request_body,
  };

  return tc;
}
function resolveLegacyTemplateKey(rule) {
  const category = String(rule.category || "").toLowerCase();
  const appliesWhen = String(rule.applies_when || "").trim();
  const ruleId = String(rule.rule_id || "").trim();

  if (category === "contract") {
    if (
      ruleId === "CONTRACT_001" ||
      appliesWhen === "endpoint_exists" ||
      appliesWhen === "success_response_documented"
    ) {
      return "contract.success";
    }

    if (
      ruleId === "CONTRACT_005" ||
      appliesWhen === "response_has_required_fields"
    ) {
      return "contract.required_fields";
    }

    if (
      ruleId === "CONTRACT_002" ||
      appliesWhen === "response_content_type_documented"
    ) {
      return "contract.content_type";
    }

    if (
      ruleId === "CONTRACT_003" ||
      appliesWhen === "response_headers_documented"
    ) {
      return "contract.response_headers";
    }

    if (
      ruleId === "CONTRACT_008" ||
      appliesWhen === "endpoint_has_query_params" ||
      appliesWhen === "query_params_documented"
    ) {
      return "contract.query_params";
    }

    if (
      ruleId === "CONTRACT_009" ||
      appliesWhen === "endpoint_has_path_params" ||
      appliesWhen === "path_params_documented"
    ) {
      return "contract.path_params";
    }

    if (
      ruleId === "CONTRACT_010" ||
      appliesWhen === "request_body_schema_exists" ||
      appliesWhen === "request_body_documented"
    ) {
      return "contract.request_body";
    }

    if (
      ruleId === "CONTRACT_012" ||
      ruleId === "CONTRACT_013" ||
      appliesWhen === "error_responses_documented" ||
      appliesWhen === "operation_metadata_exists"
    ) {
      return "contract.error_response";
    }

    return "contract.success";
  }

  if (category === "schema") {
    if (
      appliesWhen === "request_body_schema_exists" ||
      appliesWhen === "request_body_has_required_fields" ||
      appliesWhen === "method_is_post_and_has_request_body" ||
      appliesWhen === "method_is_put_or_patch_and_has_request_body"
    ) {
      return "schema.request_body";
    }

    if (ruleId === "SCHEMA_001" || appliesWhen === "response_schema_exists") {
      return "schema.response";
    }

    if (
      ruleId === "SCHEMA_002" ||
      appliesWhen === "response_schema_has_required_fields"
    ) {
      return "schema.required_fields";
    }

    if (
      ruleId === "SCHEMA_003" ||
      appliesWhen === "response_schema_has_typed_fields"
    ) {
      return "schema.field_types";
    }

    if (
      ruleId === "SCHEMA_004" ||
      appliesWhen === "response_schema_has_enum_fields"
    ) {
      return "schema.enum";
    }

    if (
      ruleId === "SCHEMA_005" ||
      appliesWhen === "response_schema_has_nested_objects"
    ) {
      return "schema.nested_objects";
    }

    if (
      ruleId === "SCHEMA_006" ||
      appliesWhen === "response_schema_has_array_fields"
    ) {
      return "schema.array";
    }

    if (
      ruleId === "SCHEMA_007" ||
      appliesWhen === "response_schema_has_format_fields"
    ) {
      return "schema.format";
    }

    if (
      ruleId === "SCHEMA_008" ||
      appliesWhen === "response_schema_has_numeric_constraints"
    ) {
      return "schema.numeric_constraints";
    }

    if (
      ruleId === "SCHEMA_009" ||
      appliesWhen === "response_schema_has_string_constraints"
    ) {
      return "schema.string_constraints";
    }

    if (
      ruleId === "SCHEMA_010" ||
      appliesWhen === "response_schema_has_pattern_fields"
    ) {
      return "schema.pattern";
    }

    if (ruleId === "SCHEMA_011" || appliesWhen === "schema_has_composition") {
      return "schema.composition";
    }

    return "schema.response";
  }

  if (category === "negative") {
    if (
      ruleId === "NEGATIVE_001" ||
      appliesWhen === "endpoint_has_required_query"
    ) {
      return "negative.missing_required_query";
    }

    if (
      ruleId === "NEGATIVE_002" ||
      appliesWhen === "endpoint_has_path_params"
    ) {
      return "negative.missing_required_path";
    }

    if (ruleId === "NEGATIVE_018" || appliesWhen === "endpoint_exists") {
      return "negative.unsupported_method";
    }

    if (
      ruleId === "NEGATIVE_019" ||
      ruleId === "NEGATIVE_107" ||
      appliesWhen === "request_body_schema_exists"
    ) {
      return "negative.invalid_content_type";
    }

    if (ruleId === "NEGATIVE_020" || ruleId === "NEGATIVE_113") {
      return "negative.malformed_json";
    }

    if (ruleId === "NEGATIVE_021" || appliesWhen === "request_body_required") {
      return "negative.empty_body";
    }

    if (
      ruleId === "NEGATIVE_024" ||
      appliesWhen === "endpoint_has_resource_identifier"
    ) {
      return "negative.resource_not_found";
    }
    if (ruleId === "NEGATIVE_014" || appliesWhen === "endpoint_requires_auth") {
      return "auth.missing_credentials";
    }

    if (ruleId === "NEGATIVE_015") {
      return "auth.invalid_credentials";
    }

    if (ruleId === "NEGATIVE_016") {
      return "auth.expired_credentials";
    }

    if (
      ruleId === "NEGATIVE_017" ||
      appliesWhen === "endpoint_requires_role_scope"
    ) {
      return "auth.forbidden_role";
    }

    return "negative.missing_required_query";
  }

  if (category === "auth") {
    if (ruleId === "AUTH_001" || appliesWhen === "endpoint_requires_auth") {
      return "auth.missing_credentials";
    }

    if (ruleId === "AUTH_002") {
      return "auth.invalid_credentials";
    }

    if (ruleId === "AUTH_003") {
      return "auth.expired_credentials";
    }

    if (
      ruleId === "AUTH_004" ||
      appliesWhen === "endpoint_requires_role_scope"
    ) {
      return "auth.forbidden_role";
    }

    return "auth.missing_credentials";
  }

  return "";
}

function getTemplateKey(rule) {
  const direct = String(rule?.template_key || "").trim();
  if (direct) return direct;
  return resolveLegacyTemplateKey(rule);
}

function buildCaseFromCsvRule(rule, endpoint) {
  const templateKey = getTemplateKey(rule);
  const fn = TEMPLATE_REGISTRY[templateKey];

  if (!fn) {
    console.warn(
      `No template found for rule ${rule?.rule_id || "UNKNOWN"} using template_key=${templateKey}`,
    );
    return null;
  }

  return annotateCase(fn(endpoint), rule, endpoint);
}

function buildDedupKey(tc) {
  return JSON.stringify({
    title: String(tc?.title || "")
      .trim()
      .toLowerCase(),
    test_type: String(tc?.test_type || "")
      .trim()
      .toLowerCase(),
    priority: String(tc?.priority || "")
      .trim()
      .toUpperCase(),
    objective: String(tc?.objective || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase(),
    method: String(tc?.api_details?.method || "")
      .trim()
      .toUpperCase(),
    path: String(tc?.api_details?.path || "").trim(),
    steps: ensureArray(tc?.steps).map((x) =>
      String(x || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase(),
    ),
    expected_results: ensureArray(tc?.expected_results).map((x) =>
      String(x || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase(),
    ),
    validation_focus: ensureArray(tc?.validation_focus).map((x) =>
      String(x || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase(),
    ),
  });
}

function dedupeCases(cases) {
  const out = [];
  const seen = new Set();

  for (const tc of ensureArray(cases)) {
    const key = buildDedupKey(tc);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tc);
  }

  return out;
}

async function resolveCsvRules(endpoint, options = {}) {
  const include = Array.isArray(options?.include)
    ? options.include.map((x) => String(x).toLowerCase())
    : ["contract", "schema"];

  const catalog = await loadRuleCatalog();
  const matchedRules = [];
  const skippedNoCondition = [];
  const skippedConditionFalse = [];

  for (const rule of catalog) {
    const category = String(rule.category || "").toLowerCase();
    if (!include.includes(category)) continue;

    if (!methodMatchesFilter(endpoint, rule.method_filter)) continue;

    const conditionKey = String(rule.applies_when || "").trim();
    const conditionFn = RULE_CONDITION_MAP[conditionKey];

    if (!conditionFn) {
      skippedNoCondition.push({
        rule_id: rule.rule_id,
        applies_when: conditionKey,
      });
      continue;
    }

    try {
      if (conditionFn(endpoint, options)) {
        matchedRules.push(rule);
      } else {
        skippedConditionFalse.push({
          rule_id: rule.rule_id,
          applies_when: conditionKey,
        });
      }
    } catch (err) {
      console.error(`CSV rule evaluation failed: ${rule.rule_id}`, err);
    }
  }

  console.log(
    `MATCHED CSV RULES for ${endpoint?.method} ${endpoint?.path}:`,
    matchedRules.map(
      (r) =>
        `${r.rule_id} | ${r.category} | ${r.scenario} | template=${getTemplateKey(r)}`,
    ),
  );

  if (skippedNoCondition.length > 0) {
    console.log(
      "CSV rules skipped because applies_when not mapped:",
      skippedNoCondition,
    );
  }

  if (skippedConditionFalse.length > 0) {
    console.log(
      `CSV rules condition=false for ${endpoint?.method} ${endpoint?.path}:`,
      skippedConditionFalse,
    );
  }

  return matchedRules;
}

export async function generateCasesForEndpoint(endpoint, options = {}) {
  const enrichedEndpoint = {
    ...endpoint,
    _resolvedTestData: resolveEndpointTestData(endpoint),
  };

  const matchedRules = await resolveCsvRules(enrichedEndpoint, options);
  const cases = [];

  for (const rule of matchedRules) {
    try {
      const tc = buildCaseFromCsvRule(rule, enrichedEndpoint);
      if (tc) cases.push(tc);
    } catch (err) {
      console.error(`Template build failed for CSV rule: ${rule.rule_id}`, err);
    }
  }

  return dedupeCases(cases);
}

export async function generateCasesForEndpoints(endpoints, options = {}) {
  const eps = Array.isArray(endpoints) ? endpoints : [];
  const allCases = [];

  for (const endpoint of eps) {
    const cases = await generateCasesForEndpoint(endpoint, options);
    allCases.push(...cases);
  }

  return allCases;
}
