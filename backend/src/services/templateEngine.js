import {
  makeContractSuccessTemplate,
  makeContractRequiredFieldsTemplate,
} from "../templates/contractTemplates.js";

import {
  makeSchemaResponseTemplate,
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

function annotateCase(tc, rule) {
  if (!tc) return null;

  tc.id = `${tc.id}__${rule.rule_id}`;

  tc.references = Array.isArray(tc.references) ? tc.references : [];
  tc.references.push(`rule_id:${rule.rule_id}`);
  tc.references.push(`scenario:${rule.scenario}`);

  if (!tc.review_notes && rule.notes) {
    tc.review_notes = String(rule.notes);
  }

  return tc;
}
function buildCaseFromCsvRule(rule, endpoint) {
  const category = String(rule.category || "").toLowerCase();
  const appliesWhen = String(rule.applies_when || "").trim();
  const ruleId = String(rule.rule_id || "").trim();

  if (category === "contract") {
    if (
      ruleId === "CONTRACT_005" ||
      appliesWhen === "response_has_required_fields"
    ) {
      return annotateCase(makeContractRequiredFieldsTemplate(endpoint), rule);
    }

    return annotateCase(makeContractSuccessTemplate(endpoint), rule);
  }

  if (category === "schema") {
    if (
      appliesWhen === "request_body_schema_exists" ||
      appliesWhen === "request_body_has_required_fields" ||
      appliesWhen === "method_is_post_and_has_request_body" ||
      appliesWhen === "method_is_put_or_patch_and_has_request_body"
    ) {
      return annotateCase(makeSchemaRequestBodyTemplate(endpoint), rule);
    }

    return annotateCase(makeSchemaResponseTemplate(endpoint), rule);
  }

  if (category === "negative") {
    if (
      ruleId === "NEGATIVE_001" ||
      appliesWhen === "endpoint_has_required_query"
    ) {
      return annotateCase(
        makeNegativeMissingRequiredQueryTemplate(endpoint),
        rule,
      );
    }

    if (
      ruleId === "NEGATIVE_002" ||
      appliesWhen === "endpoint_has_path_params"
    ) {
      return annotateCase(
        makeNegativeMissingRequiredPathTemplate(endpoint),
        rule,
      );
    }

    if (ruleId === "NEGATIVE_018" || appliesWhen === "endpoint_exists") {
      return annotateCase(
        makeNegativeUnsupportedMethodTemplate(endpoint),
        rule,
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
      );
    }

    if (ruleId === "NEGATIVE_020" || ruleId === "NEGATIVE_113") {
      return annotateCase(makeNegativeMalformedJsonTemplate(endpoint), rule);
    }

    if (ruleId === "NEGATIVE_021" || appliesWhen === "request_body_required") {
      return annotateCase(makeNegativeEmptyBodyTemplate(endpoint), rule);
    }

    if (
      ruleId === "NEGATIVE_024" ||
      appliesWhen === "endpoint_has_resource_identifier"
    ) {
      return annotateCase(makeNegativeResourceNotFoundTemplate(endpoint), rule);
    }

    if (appliesWhen === "endpoint_requires_auth") {
      return annotateCase(makeAuthMissingCredentialsTemplate(endpoint), rule);
    }

    return annotateCase(
      makeNegativeMissingRequiredQueryTemplate(endpoint),
      rule,
    );
  }
  return null;
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

  return cases;
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
