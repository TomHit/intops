function uniqueBy(items = [], getKey = (x) => x?.id) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function makeScenario(id, category, title, objective, priority = "medium") {
  return {
    id,
    category,
    title,
    objective,
    priority,
  };
}

function buildFlowScenarios(summary = {}) {
  const flows = summary?.workflows?.primary || [];
  const out = [];

  if (flows.includes("initiation")) {
    out.push(
      makeScenario(
        "STORY-FUNC-001",
        "functional",
        "Initiate primary story workflow successfully",
        "Verify the main user journey can be initiated with valid input.",
        "high",
      ),
    );
  }

  if (flows.includes("validation")) {
    out.push(
      makeScenario(
        "STORY-VAL-001",
        "validation",
        "Reject invalid or incomplete input",
        "Verify required fields, schema rules, and invalid combinations are rejected correctly.",
        "high",
      ),
    );
  }

  if (flows.includes("authorization") || flows.includes("authentication")) {
    out.push(
      makeScenario(
        "STORY-AUTH-001",
        "security",
        "Block unauthorized access to protected story action",
        "Verify authentication and authorization checks are enforced before execution.",
        "high",
      ),
    );
  }

  if (flows.includes("response")) {
    out.push(
      makeScenario(
        "STORY-FUNC-002",
        "functional",
        "Return correct success and failure response states",
        "Verify response payload, status mapping, and client-visible outcomes are correct.",
        "high",
      ),
    );
  }

  if (flows.includes("settlement")) {
    out.push(
      makeScenario(
        "STORY-FUNC-003",
        "functional",
        "Verify downstream settlement or reconciliation behavior",
        "Validate settlement handling and financial reconciliation outcomes.",
        "high",
      ),
    );
  }

  return out;
}

function buildRiskScenarios(summary = {}) {
  const risks = summary?.testing?.focus_areas || [];
  const out = [];

  if (risks.includes("duplicate transaction risk")) {
    out.push(
      makeScenario(
        "STORY-NEG-001",
        "negative",
        "Prevent duplicate transaction execution",
        "Verify duplicate or repeated requests do not execute the same transaction twice.",
        "high",
      ),
    );
  }

  if (risks.includes("idempotency failure")) {
    out.push(
      makeScenario(
        "STORY-NEG-002",
        "negative",
        "Enforce idempotency for repeated requests",
        "Verify retried requests are handled safely and idempotently.",
        "high",
      ),
    );
  }

  if (risks.includes("notification delivery inconsistency")) {
    out.push(
      makeScenario(
        "STORY-EDGE-001",
        "edge",
        "Verify notification trigger and delivery consistency",
        "Validate that downstream notifications are sent correctly and only when expected.",
        "medium",
      ),
    );
  }

  if (risks.includes("refund accuracy issues")) {
    out.push(
      makeScenario(
        "STORY-FUNC-004",
        "functional",
        "Validate refund accuracy and reversal handling",
        "Verify refund values, states, and reversal outcomes remain consistent.",
        "high",
      ),
    );
  }

  return out;
}

function buildOpenQuestionScenarios(summary = {}) {
  const questions = summary?.testing?.open_questions || [];
  return questions.map((q, index) =>
    makeScenario(
      `STORY-CLARIFY-${String(index + 1).padStart(3, "0")}`,
      "clarification",
      `Clarify: ${q}`,
      `This scenario cannot be finalized until the story clarifies: ${q}.`,
      "medium",
    ),
  );
}

export function generateStoryTestScenarios(summary = {}, signals = {}) {
  const scenarios = [
    ...buildFlowScenarios(summary, signals),
    ...buildRiskScenarios(summary, signals),
    ...buildOpenQuestionScenarios(summary, signals),
  ];

  return uniqueBy(scenarios, (x) => x.id);
}
