import {
  makeContractSuccessTemplate,
  makeContractRequiredFieldsTemplate,
  makeContractContentTypeTemplate,
  makeContractResponseHeadersTemplate,
  makeContractQueryParamsTemplate,
  makeContractPathParamsTemplate,
  makeContractRequestBodyTemplate,
  makeContractErrorResponseTemplate,
} from "../templates/contractTemplates.js";

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

import {
  makeNegativeMissingRequiredQueryTemplate,
  makeNegativeMissingRequiredPathTemplate,
  makeNegativeUnsupportedMethodTemplate,
  makeNegativeInvalidContentTypeTemplate,
  makeNegativeMalformedJsonTemplate,
  makeNegativeEmptyBodyTemplate,
  makeNegativeResourceNotFoundTemplate,
} from "../templates/negativeTemplates.js";
import { makeAuthMissingCredentialsTemplate } from "../templates/authTemplates.js";

import { loadRuleCatalog } from "../rules/loadRuleCatalog.js";
import { RULE_CONDITION_MAP } from "../rules/ruleConditionMap.js";

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

  return tc;
}

function buildCaseFromCsvRule(rule, endpoint) {
  const category = String(rule.category || "").toLowerCase();
  const appliesWhen = String(rule.applies_when || "").trim();
  const ruleId = String(rule.rule_id || "").trim();

  if (category === "contract") {
    if (
      ruleId === "CONTRACT_001" ||
      appliesWhen === "endpoint_exists" ||
      appliesWhen === "success_response_documented"
    ) {
      return annotateCase(
        makeContractSuccessTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (
      ruleId === "CONTRACT_005" ||
      appliesWhen === "response_has_required_fields"
    ) {
      return annotateCase(
        makeContractRequiredFieldsTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (
      ruleId === "CONTRACT_002" ||
      appliesWhen === "response_content_type_documented"
    ) {
      return annotateCase(
        makeContractContentTypeTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (
      ruleId === "CONTRACT_003" ||
      appliesWhen === "response_headers_documented"
    ) {
      return annotateCase(
        makeContractResponseHeadersTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (
      ruleId === "CONTRACT_008" ||
      appliesWhen === "endpoint_has_query_params" ||
      appliesWhen === "query_params_documented"
    ) {
      return annotateCase(
        makeContractQueryParamsTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (
      ruleId === "CONTRACT_009" ||
      appliesWhen === "endpoint_has_path_params" ||
      appliesWhen === "path_params_documented"
    ) {
      return annotateCase(
        makeContractPathParamsTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (
      ruleId === "CONTRACT_010" ||
      appliesWhen === "request_body_schema_exists" ||
      appliesWhen === "request_body_documented"
    ) {
      return annotateCase(
        makeContractRequestBodyTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (
      ruleId === "CONTRACT_012" ||
      ruleId === "CONTRACT_013" ||
      appliesWhen === "error_responses_documented" ||
      appliesWhen === "operation_metadata_exists"
    ) {
      return annotateCase(
        makeContractErrorResponseTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    return annotateCase(makeContractSuccessTemplate(endpoint), rule, endpoint);
  }

  if (category === "schema") {
    if (
      appliesWhen === "request_body_schema_exists" ||
      appliesWhen === "request_body_has_required_fields" ||
      appliesWhen === "method_is_post_and_has_request_body" ||
      appliesWhen === "method_is_put_or_patch_and_has_request_body"
    ) {
      return annotateCase(
        makeSchemaRequestBodyTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (ruleId === "SCHEMA_001" || appliesWhen === "response_schema_exists") {
      return annotateCase(makeSchemaResponseTemplate(endpoint), rule, endpoint);
    }

    if (
      ruleId === "SCHEMA_002" ||
      appliesWhen === "response_schema_has_required_fields"
    ) {
      return annotateCase(
        makeSchemaRequiredFieldsTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (
      ruleId === "SCHEMA_003" ||
      appliesWhen === "response_schema_has_typed_fields"
    ) {
      return annotateCase(
        makeSchemaFieldTypesTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (
      ruleId === "SCHEMA_004" ||
      appliesWhen === "response_schema_has_enum_fields"
    ) {
      return annotateCase(makeSchemaEnumTemplate(endpoint), rule, endpoint);
    }

    if (
      ruleId === "SCHEMA_005" ||
      appliesWhen === "response_schema_has_nested_objects"
    ) {
      return annotateCase(
        makeSchemaNestedObjectsTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (
      ruleId === "SCHEMA_006" ||
      appliesWhen === "response_schema_has_array_fields"
    ) {
      return annotateCase(makeSchemaArrayTemplate(endpoint), rule, endpoint);
    }

    if (
      ruleId === "SCHEMA_007" ||
      appliesWhen === "response_schema_has_format_fields"
    ) {
      return annotateCase(makeSchemaFormatTemplate(endpoint), rule, endpoint);
    }

    if (
      ruleId === "SCHEMA_008" ||
      appliesWhen === "response_schema_has_numeric_constraints"
    ) {
      return annotateCase(
        makeSchemaNumericConstraintsTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (
      ruleId === "SCHEMA_009" ||
      appliesWhen === "response_schema_has_string_constraints"
    ) {
      return annotateCase(
        makeSchemaStringConstraintsTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (
      ruleId === "SCHEMA_010" ||
      appliesWhen === "response_schema_has_pattern_fields"
    ) {
      return annotateCase(makeSchemaPatternTemplate(endpoint), rule, endpoint);
    }

    if (ruleId === "SCHEMA_011" || appliesWhen === "schema_has_composition") {
      return annotateCase(
        makeSchemaCompositionTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    return annotateCase(makeSchemaResponseTemplate(endpoint), rule, endpoint);
  }

  if (category === "negative") {
    if (
      ruleId === "NEGATIVE_001" ||
      appliesWhen === "endpoint_has_required_query"
    ) {
      return annotateCase(
        makeNegativeMissingRequiredQueryTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (
      ruleId === "NEGATIVE_002" ||
      appliesWhen === "endpoint_has_path_params"
    ) {
      return annotateCase(
        makeNegativeMissingRequiredPathTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (ruleId === "NEGATIVE_018" || appliesWhen === "endpoint_exists") {
      return annotateCase(
        makeNegativeUnsupportedMethodTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (
      ruleId === "NEGATIVE_019" ||
      ruleId === "NEGATIVE_107" ||
      appliesWhen === "request_body_schema_exists"
    ) {
      return annotateCase(
        makeNegativeInvalidContentTypeTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (ruleId === "NEGATIVE_020" || ruleId === "NEGATIVE_113") {
      return annotateCase(
        makeNegativeMalformedJsonTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (ruleId === "NEGATIVE_021" || appliesWhen === "request_body_required") {
      return annotateCase(
        makeNegativeEmptyBodyTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (
      ruleId === "NEGATIVE_024" ||
      appliesWhen === "endpoint_has_resource_identifier"
    ) {
      return annotateCase(
        makeNegativeResourceNotFoundTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    if (appliesWhen === "endpoint_requires_auth") {
      return annotateCase(
        makeAuthMissingCredentialsTemplate(endpoint),
        rule,
        endpoint,
      );
    }

    return annotateCase(
      makeNegativeMissingRequiredQueryTemplate(endpoint),
      rule,
      endpoint,
    );
  }

  if (category === "auth") {
    return annotateCase(
      makeAuthMissingCredentialsTemplate(endpoint),
      rule,
      endpoint,
    );
  }

  return null;
}

function buildDedupKey(tc) {
  return JSON.stringify({
    title: String(tc?.title || "").trim(),
    test_type: String(tc?.test_type || "").trim(),
    priority: String(tc?.priority || "").trim(),
    objective: String(tc?.objective || "").trim(),
    method: String(tc?.api_details?.method || "").trim(),
    path: String(tc?.api_details?.path || "").trim(),
    steps: ensureArray(tc?.steps),
    expected_results: ensureArray(tc?.expected_results),
    validation_focus: ensureArray(tc?.validation_focus),
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
    matchedRules.map((r) => `${r.rule_id} | ${r.category} | ${r.scenario}`),
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
  const matchedRules = await resolveCsvRules(endpoint, options);
  const cases = [];

  for (const rule of matchedRules) {
    try {
      const tc = buildCaseFromCsvRule(rule, endpoint);
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
