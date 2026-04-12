function mapFlowRisk(flow = "") {
  const f = String(flow || "")
    .toLowerCase()
    .trim();

  if (f.includes("initiation") || f.includes("request creation")) {
    return {
      risk: "incorrect or malformed input can enter the workflow",
      test: "input validation and schema checks",
    };
  }

  if (f.includes("validation") || f.includes("verification")) {
    return {
      risk: "business rules may be bypassed or enforced incorrectly",
      test: "rule validation and boundary coverage",
    };
  }

  if (
    f.includes("authorization") ||
    f.includes("authorisation") ||
    f.includes("authentication")
  ) {
    return {
      risk: "unauthorized access or duplicate execution may occur",
      test: "auth checks and idempotency validation",
    };
  }

  if (f.includes("response")) {
    return {
      risk: "incorrect status mapping or partial failure handling may mislead clients",
      test: "response integrity and error-handling validation",
    };
  }

  if (
    f.includes("settlement") ||
    f.includes("reconciliation") ||
    f.includes("reconcile")
  ) {
    return {
      risk: "financial reconciliation may be delayed or mismatched",
      test: "settlement and reconciliation validation",
    };
  }

  if (f.includes("refund") || f.includes("reversal")) {
    return {
      risk: "refund outcomes may be inaccurate or inconsistent",
      test: "refund accuracy and reversal checks",
    };
  }

  if (
    f.includes("notification") ||
    f.includes("notify") ||
    f.includes("alert")
  ) {
    return {
      risk: "users may not receive correct transaction updates",
      test: "trigger and delivery validation",
    };
  }

  if (f.includes("dispute") || f.includes("chargeback")) {
    return {
      risk: "dispute handling may not align with expected lifecycle transitions",
      test: "dispute workflow validation",
    };
  }

  return null;
}

export function buildStoryFlowRiskMap(summary = {}) {
  const flows = Array.from(
    new Set([
      ...(summary?.workflows?.primary || []),
      ...(summary?.workflows?.secondary || []),
    ]),
  );

  return flows
    .map((flow) => {
      const mapped = mapFlowRisk(flow);
      if (!mapped) return null;
      return { flow, ...mapped };
    })
    .filter(Boolean);
}
