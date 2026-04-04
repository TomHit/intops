import { inferWorkflow } from "./workflowEngine.js";
import { detectRisks } from "./riskEngine.js";
import { detectMissing } from "./missingInfoDetector.js";
import { classifyBusinessDomain } from "./domainClassifier.js";

export function buildProjectCard({
  signals,
  projectType,
  openapi,
  projectNotes,
}) {
  const domain = classifyBusinessDomain({
    openapi,
    signals,
    projectNotes,
  });

  return {
    project_type: projectType,
    business_domain: domain.business_domain,
    business_domain_label: domain.business_domain_label,
    subdomain: domain.subdomain,
    domain_confidence: domain.domain_confidence,
    domain_signals: domain.domain_signals,
    secondary_domains: domain.secondary_domains,
    workflow: inferWorkflow(signals),
    risk_tags: detectRisks(signals),
    missing: detectMissing(signals),
    confidence: calculateConfidence(signals),
  };
}

function calculateConfidence(signals) {
  let score = 0;

  if (signals?.hasChat) score += 0.25;
  if (signals?.hasSearch) score += 0.25;
  if (signals?.hasAuth) score += 0.25;
  if (Array.isArray(signals?.endpoints) && signals.endpoints.length > 0) {
    score += 0.25;
  }

  return Math.min(score, 1);
}
