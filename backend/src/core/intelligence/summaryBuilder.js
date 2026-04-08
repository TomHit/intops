function normalizePhrase(value = "") {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function humanizeWorkflowStep(step = "") {
  return normalizePhrase(step);
}

function humanizeRisk(risk = "") {
  return normalizePhrase(risk);
}

function sentenceJoin(items = [], conjunction = "and") {
  const filtered = (items || []).filter(Boolean);
  if (filtered.length === 0) return "";
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2) {
    return `${filtered[0]} ${conjunction} ${filtered[1]}`;
  }
  return `${filtered.slice(0, -1).join(", ")}, ${conjunction} ${filtered[filtered.length - 1]}`;
}

function pickEvidence(card = {}, limit = 6) {
  const direct =
    card?.evidence_summary?.resource_terms?.length > 0
      ? card.evidence_summary.resource_terms
      : card?.domain_signals || [];

  return (direct || []).slice(0, limit);
}

function buildSystemDescription(card = {}) {
  const projectType = normalizePhrase(card.project_type || "");
  const domain = normalizePhrase(
    card.business_domain_label || "General Software",
  );

  if (projectType) {
    return `This project appears to be a ${projectType} in the ${domain} domain.`;
  }

  return `This project appears to be a software system in the ${domain} domain.`;
}

function buildEvidenceText(card = {}) {
  const evidence = pickEvidence(card, 6);
  const sourceEvidence = card?.source_evidence || {};
  const presentSources = [
    sourceEvidence.openapi === "present" ? "OpenAPI" : null,
    sourceEvidence.docs === "present" ? "documents" : null,
    sourceEvidence.github === "present" ? "GitHub/project code" : null,
    sourceEvidence.notes === "present" ? "project notes" : null,
  ].filter(Boolean);

  if (evidence.length === 0 && presentSources.length === 0) return "";

  if (evidence.length > 0 && presentSources.length > 0) {
    return `The classification is based on ${sentenceJoin(presentSources)} and supported by evidence such as ${sentenceJoin(evidence)}.`;
  }

  if (evidence.length > 0) {
    return `Key evidence includes ${sentenceJoin(evidence)}.`;
  }

  return `The classification is based on ${sentenceJoin(presentSources)}.`;
}

function buildWorkflowText(card = {}) {
  const docFlows = Array.isArray(card?.context_workflow?.business_flow_hints)
    ? card.context_workflow.business_flow_hints
    : [];

  if (docFlows.length === 0) return "";

  const normalized = docFlows
    .slice(0, 6)
    .map((step) => humanizeWorkflowStep(step))
    .filter(Boolean);

  if (normalized.length === 0) return "";

  if (normalized.length >= 3) {
    return `The documented workflow includes ${normalized.join(" → ")}.`;
  }

  return `The documented workflow includes ${sentenceJoin(normalized)}.`;
}

function buildRiskText(card = {}) {
  const risks = Array.isArray(card.risk_tags) ? card.risk_tags : [];
  if (risks.length === 0) return "";

  const normalized = risks.slice(0, 6).map(humanizeRisk).filter(Boolean);

  if (normalized.length === 0) return "";

  return `Primary testing concerns include ${sentenceJoin(normalized)}.`;
}

function buildMissingText(card = {}) {
  const missing = Array.isArray(card.missing) ? card.missing : [];
  if (missing.length === 0) return "";

  const normalized = missing
    .slice(0, 5)
    .map((item) => normalizePhrase(item))
    .filter(Boolean);

  if (normalized.length === 0) return "";

  return `Some potentially missing or unclear areas are ${sentenceJoin(normalized)}.`;
}

export function buildProjectSummary(card = {}) {
  const parts = [
    buildSystemDescription(card),
    buildEvidenceText(card),
    buildWorkflowText(card),
    buildRiskText(card),
    buildMissingText(card),
  ].filter(Boolean);

  return parts.join(" ");
}
