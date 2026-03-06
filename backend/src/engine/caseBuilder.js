export function buildTestCaseFromRule(rule, endpoint) {
  return {
    id: rule.rule_id,
    title: rule.test_case_title,
    type: rule.category,
    priority: rule.priority,
    severity: rule.severity,
    method: endpoint.method,
    path: endpoint.path,

    request: {
      query: {},
      headers: {},
      body: null,
    },

    steps: [
      "Open API client (Postman / curl)",
      `Send ${endpoint.method} request to ${endpoint.path}`,
      "Observe the response",
    ],

    expected: [rule.test_case_title],

    assertions: [],
    needs_review: false,
    review_notes: rule.notes || "",
  };
}
