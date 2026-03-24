import { loadRuleCatalog } from "../rules/loadRuleCatalog.js";
import { RULE_CONDITION_MAP } from "../rules/ruleConditionMap.js";
//import { evaluateRules } from "../rules/evaluateRules.js";
import { buildScenarioPlans } from "./scenarioEngine.js";
import { getTemplateBuilder } from "./templateRegistry.js";

const DEFAULT_INCLUDE = ["contract", "schema", "negative", "auth"];

/* =========================================================
   UTILS
========================================================= */

function normalizeInclude(include) {
  if (!Array.isArray(include) || include.length === 0) {
    return [...DEFAULT_INCLUDE];
  }
  return [...new Set(include.map((x) => String(x).toLowerCase().trim()))];
}

function normalizeDedupText(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

function getReferenceValue(tc, prefix) {
  const refs = Array.isArray(tc?.references) ? tc.references : [];
  const found = refs.find((r) =>
    String(r).toLowerCase().startsWith(prefix.toLowerCase()),
  );
  return found || "";
}

function dedupeRefs(refs = []) {
  return [...new Set(refs.map((x) => String(x).trim()).filter(Boolean))];
}

function hasScenarioSource(tc) {
  const refs = Array.isArray(tc?.references) ? tc.references : [];
  return refs.some((r) => String(r).toLowerCase() === "source:scenario_engine");
}

function getTemplateKeyFromCase(tc) {
  const ref = getReferenceValue(tc, "template_key:");
  return ref
    .replace(/^template_key:/i, "")
    .trim()
    .toLowerCase();
}

function getScenarioIdFromCase(tc) {
  const ref = getReferenceValue(tc, "scenario_id:");
  return ref
    .replace(/^scenario_id:/i, "")
    .trim()
    .toLowerCase();
}

function isScenarioOwnedTemplateKey(templateKey) {
  if (!templateKey) return false;
  return templateKey.startsWith("negative.") || templateKey.startsWith("auth.");
}

function cleanScenarioReferences(tc) {
  const refs = Array.isArray(tc?.references) ? tc.references : [];

  const templateKey = getReferenceValue(tc, "template_key:");
  const scenarioId = getReferenceValue(tc, "scenario_id:");

  const kept = refs.filter((r) => {
    const v = String(r || "").toLowerCase();
    return (
      v === "source:scenario_engine" ||
      v.startsWith("template_key:") ||
      v.startsWith("scenario_id:")
    );
  });

  if (templateKey) kept.push(templateKey);
  if (scenarioId) kept.push(scenarioId);
  kept.push("source:scenario_engine");

  tc.references = dedupeRefs(kept);
  return tc;
}

/* =========================================================
   DEDUP
========================================================= */

function buildDedupKey(tc) {
  const method = String(
    tc?.api_details?.method || tc?.method || "GET",
  ).toUpperCase();

  const path = String(tc?.api_details?.path || tc?.path || "/").trim();
  const testType = normalizeDedupText(tc?.test_type);
  const title = normalizeDedupText(tc?.title);
  const objective = normalizeDedupText(tc?.objective);
  const testData = JSON.stringify(tc?.test_data || {});
  const scenarioId = normalizeDedupText(getScenarioIdFromCase(tc));
  const source = normalizeDedupText(getReferenceValue(tc, "source:"));

  return `${method}|${path}|${testType}|${title}|${objective}|${testData}|${scenarioId}|${source}`;
}

/* =========================================================
   TEMPLATE ANNOTATION (SAFE)
========================================================= */

function annotateCase(tc, rule, endpoint) {
  if (!tc) return null;

  tc.references = Array.isArray(tc.references) ? tc.references : [];

  const templateKey = getTemplateKeyFromCase(tc);

  const scenarioOwned =
    hasScenarioSource(tc) ||
    isScenarioOwnedTemplateKey(templateKey) ||
    tc?.meta?.scenario_id;

  if (!scenarioOwned) {
    if (rule?.rule_id) tc.references.push(`rule_id:${rule.rule_id}`);
    if (rule?.scenario) tc.references.push(`scenario:${rule.scenario}`);
    if (templateKey) tc.references.push(`template_key:${templateKey}`);
  } else {
    tc.references.push("source:scenario_engine");
  }

  tc.references = dedupeRefs(tc.references);

  if (!tc.api_details) {
    tc.api_details = {
      method: String(endpoint?.method || "GET").toUpperCase(),
      path: endpoint?.path || "/",
    };
  }

  return tc;
}

/* =========================================================
   FORMAT OUTPUT
========================================================= */

function formatGeneratedCase(tc) {
  const refs = Array.isArray(tc?.references) ? tc.references : [];
  const method = String(tc?.api_details?.method || "GET").toUpperCase();
  const testType = String(tc?.test_type || "").toLowerCase();

  const isScenarioCase = refs.some(
    (r) => String(r).toLowerCase() === "source:scenario_engine",
  );

  if (isScenarioCase && (testType === "negative" || testType === "auth")) {
    const cleaned = {
      ...tc,
      test_data: { ...(tc?.test_data || {}) },
      references: [...refs],
    };

    cleanScenarioReferences(cleaned);

    if (method === "GET" && cleaned?.test_data) {
      delete cleaned.test_data.request_body;
    }

    return cleaned;
  }

  return tc;
}

/* =========================================================
   MAIN ENGINE
========================================================= */

export async function generateCasesForEndpoint(endpoint, options = {}) {
  const include = normalizeInclude(options.include);

  const enrichedEndpoint = {
    ...endpoint,
  };

  const profile = {};
  const matchedRules = [];

  const cases = [];
  const dedup = new Set();

  /* =========================
     SCENARIO ENGINE (PRIMARY)
  ========================= */

  const scenarioPlans = buildScenarioPlans(
    enrichedEndpoint,
    profile,
    matchedRules,
  );

  const scenarioTemplateKeys = new Set();

  for (const plan of scenarioPlans) {
    const tc = plan.build(endpoint, profile);

    tc.references = [
      ...(tc.references || []),
      `template_key:${plan.template_key}`,
      `scenario_id:${plan.scenario_id}`,
      "source:scenario_engine",
    ];

    scenarioTemplateKeys.add(plan.template_key);

    const key = buildDedupKey(tc);
    if (!dedup.has(key)) {
      dedup.add(key);
      cases.push(formatGeneratedCase(tc));
    }
  }

  /* =========================
     TEMPLATE ENGINE (FALLBACK ONLY)
  ========================= */

  const rulesCatalog = await loadRuleCatalog();

  for (const rule of rulesCatalog) {
    if (!include.includes(rule.category)) continue;

    const templateKey = rule.template_key;

    // 🚫 SKIP scenario-owned templates
    if (scenarioTemplateKeys.has(templateKey)) continue;

    const conditionFn = RULE_CONDITION_MAP[rule.condition];
    if (conditionFn && !conditionFn(enrichedEndpoint, profile)) continue;

    const builder = getTemplateBuilder(templateKey);
    if (typeof builder !== "function") continue;

    const tc = builder(enrichedEndpoint, profile, rule);
    if (!tc) continue;

    const annotated = annotateCase(tc, rule, enrichedEndpoint);

    const key = buildDedupKey(annotated);
    if (!dedup.has(key)) {
      dedup.add(key);
      cases.push(formatGeneratedCase(annotated));
    }
  }

  return cases;
}
export async function generateCasesForEndpoints(endpoints = [], options = {}) {
  const out = [];

  for (const endpoint of Array.isArray(endpoints) ? endpoints : []) {
    const cases = await generateCasesForEndpoint(endpoint, options);
    out.push(...(Array.isArray(cases) ? cases : []));
  }

  return out;
}
