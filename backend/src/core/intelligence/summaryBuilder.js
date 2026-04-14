function normalizePhrase(value = "") {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/[□]/g, "→")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNormalized(items = []) {
  const seen = new Set();
  const result = [];

  for (const item of items || []) {
    const normalized = normalizePhrase(item);
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function limitList(items = [], limit = 6) {
  return uniqueNormalized(items).slice(0, limit);
}

function sentenceJoin(items = [], conjunction = "and") {
  const filtered = uniqueNormalized(items);

  if (filtered.length === 0) return "";
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2) {
    return `${filtered[0]} ${conjunction} ${filtered[1]}`;
  }

  return `${filtered.slice(0, -1).join(", ")}, ${conjunction} ${filtered[filtered.length - 1]}`;
}

function deriveLifecycleStages(summary = {}) {
  return uniqueNormalized(summary?.workflows?.primary || []);
}

function buildQaPlanningSummary(summary = {}, signals = {}) {
  const lifecycle = deriveLifecycleStages(summary);
  const workflowModel = uniqueNormalized(signals?.workflow_model || []);

  const functional = lifecycle.length
    ? [
        ...lifecycle.map((step) => `Validate ${step} stage behavior`),
        ...workflowModel.map((step) => `Validate ${step} workflow behavior`),
        ...(summary?.workflows?.secondary || []),
        ...(summary?.capabilities || []),
        ...(signals?.qa_signals?.functional || []),
      ]
    : [
        ...workflowModel.map((step) => `Validate ${step} workflow behavior`),
        ...(summary?.capabilities || []),
        ...(summary?.workflows?.secondary || []),
        ...(signals?.qa_signals?.functional || []),
      ];

  const integration = [
    ...(signals?.systems || []),
    ...(signals?.qa_signals?.integration || []),
  ];

  const database = [
    ...(signals?.data_entities || []),
    ...(signals?.qa_signals?.database || []),
  ];

  const reliability = [
    "Retry behavior",
    "Failure handling",
    "Timeout scenarios",
    ...(summary?.operations?.constraints || []),
    ...(signals?.constraints || []),
    ...(signals?.qa_signals?.reliability || []),
  ];

  const security = [
    "Authentication",
    "Authorization",
    "Data protection",
    ...(summary?.security_compliance?.auth || []),
    ...(summary?.security_compliance?.data_protection || []),
    ...(signals?.qa_signals?.security || []),
  ];

  const unknowns = [
    ...(summary?.testing?.open_questions || []),
    ...(signals?.unknowns || []),
  ];

  return {
    functional: uniqueNormalized(functional),
    integration: uniqueNormalized(integration),
    database: uniqueNormalized(database),
    reliability: uniqueNormalized(reliability),
    security: uniqueNormalized(security),
    unknowns: uniqueNormalized(unknowns),
  };
}

function buildIdentityText(summary = {}) {
  const systemType = normalizePhrase(
    summary?.system_identity?.system_type || "software system",
  );
  const domain = normalizePhrase(
    summary?.system_identity?.domain || "General Software",
  );
  const subtype = normalizePhrase(summary?.system_identity?.subtype || "");

  if (subtype) {
    return `This system is a ${systemType} in the ${domain} domain, specifically focused on ${subtype}.`;
  }

  return `This system is a ${systemType} in the ${domain} domain.`;
}

function buildActorsText(summary = {}) {
  const actors = limitList(summary?.actors || [], 4);

  if (!actors.length) return "";

  return `Primary actors include ${sentenceJoin(actors)}.`;
}

function buildCapabilitiesText(summary = {}) {
  const capabilities = limitList(summary?.capabilities || [], 8);

  if (!capabilities.length) return "";

  return `Core capabilities include ${sentenceJoin(capabilities)}.`;
}

function buildWorkflowText(summary = {}) {
  const primary = limitList(summary?.workflows?.primary || [], 6);
  const secondary = limitList(summary?.workflows?.secondary || [], 6);

  const parts = [];

  if (primary.length) {
    parts.push(`Its primary lifecycle follows ${primary.join(" → ")}.`);
  }

  if (secondary.length) {
    parts.push(
      `Supporting operational flows include ${sentenceJoin(secondary)}.`,
    );
  }

  return parts.join(" ");
}

function buildComplianceText(summary = {}) {
  const compliance = limitList(
    summary?.security_compliance?.compliance || [],
    6,
  );
  const auth = limitList(summary?.security_compliance?.auth || [], 3);
  const dataProtection = limitList(
    summary?.security_compliance?.data_protection || [],
    4,
  );

  const parts = [];

  if (compliance.length) {
    parts.push(
      `Relevant compliance requirements include ${sentenceJoin(compliance)}.`,
    );
  }

  const securitySignals = uniqueNormalized([...auth, ...dataProtection]);

  if (securitySignals.length) {
    parts.push(
      `Key security considerations include ${sentenceJoin(securitySignals)}.`,
    );
  }

  return parts.join(" ");
}

function buildNonFunctionalText(summary = {}) {
  const nonFunctionals = limitList(
    summary?.operations?.non_functionals || [],
    6,
  );

  if (!nonFunctionals.length) return "";

  return `Operational expectations include ${sentenceJoin(nonFunctionals)}.`;
}

function buildConstraintsText(summary = {}) {
  const constraints = limitList(summary?.operations?.constraints || [], 4);

  if (!constraints.length) return "";

  return `Notable operating constraints include ${sentenceJoin(constraints)}.`;
}

function buildTestingText(summary = {}) {
  const focusAreas = limitList(summary?.testing?.focus_areas || [], 6);

  if (!focusAreas.length) return "";

  return `Key testing concerns include ${sentenceJoin(focusAreas)}.`;
}

function buildFailureText(summary = {}) {
  const failures = limitList(summary?.testing?.failure_scenarios || [], 5);

  if (!failures.length) return "";

  return `Important failure scenarios include ${sentenceJoin(failures)}.`;
}

function buildOpenQuestionsText(summary = {}) {
  const openQuestions = limitList(summary?.testing?.open_questions || [], 5);

  if (!openQuestions.length) return "";

  return `Open questions remain around ${sentenceJoin(openQuestions)}.`;
}

function buildEvidenceText(summary = {}) {
  const snippets = limitList(summary?.evidence?.snippets || [], 4);

  if (!snippets.length) return "";

  return `Supporting evidence includes ${sentenceJoin(snippets)}.`;
}

function buildSystemNarrative(summary = {}) {
  const intent = normalizePhrase(summary?.intent?.user_goal || "");
  const actors = limitList(summary?.actors || [], 3);
  const workflow = deriveLifecycleStages(summary);
  const entities = limitList(summary?.data_entities || [], 4);
  const integrations = limitList(summary?.systems || [], 3);

  const parts = [];

  if (intent) {
    parts.push(`The system is designed to ${intent}.`);
  }

  if (actors.length) {
    parts.push(`It involves actors such as ${sentenceJoin(actors)}.`);
  }

  if (workflow.length) {
    parts.push(`The core lifecycle includes ${workflow.join(" → ")}.`);
  }

  if (entities.length) {
    parts.push(`It manages data entities like ${sentenceJoin(entities)}.`);
  }

  if (integrations.length) {
    parts.push(`The system interacts with ${sentenceJoin(integrations)}.`);
  }

  return parts.join(" ");
}

export function buildExecutiveSummary(summary = {}, signals = {}) {
  const systemProfile = signals?.system_profile || {};
  const composite = signals?.composite || {};

  const identity = buildIdentityText(summary);

  const intent = normalizePhrase(summary?.intent?.user_goal || "");

  const workflows = uniqueNormalized(
    summary?.workflows?.primary?.length
      ? summary.workflows.primary
      : systemProfile.primary_workflows || [],
  );

  const workflowText = workflows.length
    ? `The system operates through ${workflows.join(" → ")}.`
    : "";

  const actors = limitList(summary?.actors || [], 3);
  const actorsText = actors.length
    ? `Primary actors include ${sentenceJoin(actors)}.`
    : "";

  const risks = systemProfile.primary_risks || [];
  const riskText = risks.length
    ? `Key risks include ${sentenceJoin(risks)}.`
    : "";

  const aiText = composite.is_ai_system
    ? `The system includes intelligent or predictive capabilities.`
    : "";

  const parts = [
    identity,
    intent ? `The primary goal is to ${intent}.` : "",
    actorsText,
    workflowText,
    riskText,
    aiText,
    buildComplianceText(summary),
    buildNonFunctionalText(summary),
    buildTestingText(summary),
  ].filter(Boolean);

  return parts.join(" ");
}

export function buildQASummary(summary = {}, signals = {}) {
  const qa = buildQaPlanningSummary(summary, signals);

  function section(title, items) {
    const list = limitList(items, 8);
    if (!list.length) return "";
    return `${title}:\n${list.map((x) => `- ${normalizePhrase(x)}`).join("\n")}`;
  }

  const parts = [
    "QA Planning Summary",
    section("Functional", qa.functional),
    section("Integration", qa.integration),
    section("Database", qa.database),
    section("Reliability", qa.reliability),
    section("Security", qa.security),
    section("Needs clarification", qa.unknowns),
    "Note: This summary combines story, PRD, and inferred signals. Unknowns should not be assumed during test generation.",
  ].filter(Boolean);

  return parts.join("\n\n");
}

export function buildProjectSummary(summary = {}, signals = {}) {
  return buildExecutiveSummary(summary, signals);
}

export function buildDetailedSummary(summary = {}, signals = {}) {
  const parts = [
    buildExecutiveSummary(summary, signals),
    buildActorsText(summary),
    buildCapabilitiesText(summary),
    buildWorkflowText(summary),
    buildConstraintsText(summary),
    buildFailureText(summary),
    buildOpenQuestionsText(summary),
    buildEvidenceText(summary),
  ].filter(Boolean);

  return parts.join(" ");
}
