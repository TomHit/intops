function unique(items = []) {
  return [...new Set((items || []).filter(Boolean))];
}

function first(items = [], fallback = "") {
  return Array.isArray(items) && items.length > 0 ? items[0] : fallback;
}

function normalizeToken(value = "") {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

function normalizeList(items = []) {
  return unique((items || []).map((x) => normalizeToken(x)));
}

function inferDomain(signals = {}) {
  const hints = normalizeList(signals?.domain_hints);

  if (hints.includes("banking_finance")) return "Banking / Finance";
  if (hints.includes("healthcare")) return "Healthcare";
  if (hints.includes("ai_system")) return "AI System";
  if (hints.includes("ecommerce")) return "E-commerce";

  return "General Software";
}

function inferSystemType(signals = {}, domain = "General Software") {
  const actions = normalizeList(signals?.action_hints);

  if (domain === "Banking / Finance") return "Financial API";
  if (domain === "Healthcare") return "Healthcare Platform";
  if (domain === "AI System") return "AI Application";
  if (actions.includes("authentication")) return "Operational API";

  return "Software System";
}

function inferCapabilities(signals = {}) {
  const actions = normalizeList(signals?.action_hints);
  const constraints = normalizeList(signals?.constraints);
  const out = [];

  if (actions.includes("payment") || actions.includes("payments")) {
    out.push("payment processing");
  }

  if (actions.includes("refund") || actions.includes("refunds")) {
    out.push("refund handling");
  }

  if (actions.includes("settlement") || actions.includes("reconciliation")) {
    out.push("settlement management");
  }

  if (actions.includes("dispute") || actions.includes("chargeback")) {
    out.push("dispute management");
  }

  if (
    actions.includes("notification") ||
    actions.includes("notifications") ||
    actions.includes("notify")
  ) {
    out.push("real-time notifications");
  }

  if (
    actions.includes("authentication") ||
    actions.includes("authorization") ||
    actions.includes("authorisation")
  ) {
    out.push("authentication");
  }

  if (actions.includes("upload") || actions.includes("file_upload")) {
    out.push("file handling");
  }

  if (constraints.includes("idempotency")) {
    out.push("idempotency controls");
  }

  if (
    constraints.includes("security_controls") ||
    constraints.includes("security")
  ) {
    out.push("security controls");
  }

  if (
    constraints.includes("real_time_behavior") ||
    constraints.includes("real_time")
  ) {
    out.push("real-time processing");
  }

  return unique(out);
}

function inferPrimaryFlow(signals = {}, domain = "General Software") {
  const actions = normalizeList(signals?.action_hints);

  if (
    domain === "Banking / Finance" ||
    actions.includes("payment") ||
    actions.includes("payments")
  ) {
    return [
      "initiation",
      "validation",
      "authorization",
      "response",
      "settlement",
    ];
  }

  if (actions.includes("authentication")) {
    return ["initiation", "validation", "authentication", "response"];
  }

  if (actions.includes("upload") || actions.includes("file_upload")) {
    return ["initiation", "validation", "processing", "response"];
  }

  return ["initiation", "validation", "response"];
}

function inferSecondaryFlow(signals = {}) {
  const actions = normalizeList(signals?.action_hints);
  const out = [];

  if (actions.includes("refund") || actions.includes("refunds")) {
    out.push("refund handling");
  }

  if (actions.includes("dispute") || actions.includes("chargeback")) {
    out.push("dispute management");
  }

  if (
    actions.includes("notification") ||
    actions.includes("notifications") ||
    actions.includes("notify")
  ) {
    out.push("notifications");
  }

  if (actions.includes("settlement") || actions.includes("reconciliation")) {
    out.push("reporting");
  }

  return unique(out);
}

function inferRisks(signals = {}, domain = "General Software") {
  const actions = normalizeList(signals?.action_hints);
  const constraints = normalizeList(signals?.constraints);
  const out = ["input validation"];

  if (
    domain === "Banking / Finance" ||
    actions.includes("payment") ||
    actions.includes("payments")
  ) {
    out.push("duplicate transaction risk");
    out.push("authentication and authorization weaknesses");
    out.push("sensitive data exposure");
  }

  if (constraints.includes("idempotency")) {
    out.push("idempotency failure");
  }

  if (
    actions.includes("notification") ||
    actions.includes("notifications") ||
    actions.includes("notify")
  ) {
    out.push("notification delivery inconsistency");
  }

  if (actions.includes("refund") || actions.includes("refunds")) {
    out.push("refund accuracy issues");
  }

  return unique(out);
}

function inferOpenQuestions(signals = {}) {
  const actions = normalizeList(signals?.action_hints);
  const constraints = normalizeList(signals?.constraints);
  const out = [];

  if (actions.includes("payment") || actions.includes("payments")) {
    out.push("settlement reconciliation rules");
  }

  if (
    constraints.includes("retry_handling") ||
    constraints.includes("retry") ||
    constraints.includes("retries")
  ) {
    out.push("retry and duplicate handling clarification");
  }

  if (
    !actions.includes("notification") &&
    !actions.includes("notifications") &&
    !actions.includes("notify")
  ) {
    out.push("post-transaction notification requirements");
  }

  return unique(out);
}

function computeConfidence(signals = {}) {
  let score = 0;

  if ((signals?.actors || []).length > 0) score += 0.2;
  if (String(signals?.intent?.action_phrase || "").trim().length > 0) {
    score += 0.2;
  }
  if ((signals?.domain_hints || []).length > 0) score += 0.2;
  if ((signals?.action_hints || []).length > 0) score += 0.2;
  if ((signals?.constraints || []).length > 0) score += 0.2;

  return Math.min(1, score);
}

export function inferStoryUnderstanding(signals = {}) {
  const domain = inferDomain(signals);
  const system_type = inferSystemType(signals, domain);
  const primary_flow = inferPrimaryFlow(signals, domain);
  const secondary_flow = inferSecondaryFlow(signals);
  const capabilities = inferCapabilities(signals);
  const risks = inferRisks(signals, domain);
  const open_questions = inferOpenQuestions(signals);

  return {
    system_identity: {
      system_type,
      domain,
      subtype: first(normalizeList(signals?.action_hints), ""),
      confidence: computeConfidence(signals),
    },
    actors: unique(signals?.actors || []),
    capabilities,
    workflows: {
      primary: primary_flow,
      secondary: secondary_flow,
      exception: [],
    },
    testing: {
      focus_areas: risks,
      failure_scenarios: [],
      open_questions,
      flow_risk_map: [],
    },
    operations: {
      constraints: unique(signals?.constraints || []),
      non_functionals: [],
      success_metrics: [],
    },
    security_compliance: {
      auth:
        system_type === "Financial API"
          ? ["authentication and authorization"]
          : [],
      data_protection:
        system_type === "Financial API"
          ? ["sensitive data exposure", "input validation"]
          : ["input validation"],
      compliance: system_type === "Financial API" ? ["RBI guidelines"] : [],
    },
    evidence: {
      snippets: [
        signals?.intent?.action_phrase || "",
        signals?.intent?.benefit_phrase || "",
      ].filter(Boolean),
      sources: ["user_story"],
    },
  };
}
