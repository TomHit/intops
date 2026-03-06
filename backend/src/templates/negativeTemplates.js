function safeId(s) {
  return String(s || "")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function makeNegativeMissingRequiredQueryTemplate(endpoint) {
  const method = String(endpoint.method).toUpperCase();
  const path = endpoint.path;

  return {
    id: `negative_missing_query.${safeId(method)}.${safeId(path)}`,
    title: `Negative | ${method} ${path} rejects missing required query parameter`,
    type: "negative",
    priority: "P2",
    method,
    path,
    request: {
      query: {},
      headers: {},
    },
    steps: [
      `Send ${method} request to ${path} without required query parameter`,
    ],
    expected: ["API returns client error"],
    assertions: [{ op: "status_in_set", values: [400, 422] }],
    needs_review: true,
    review_notes: [
      "Populate exact missing required query parameter from OpenAPI",
    ],
  };
}
