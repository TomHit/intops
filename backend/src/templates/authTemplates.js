function safeId(s) {
  return String(s || "")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function makeAuthMissingCredentialsTemplate(endpoint) {
  const method = String(endpoint.method).toUpperCase();
  const path = endpoint.path;

  return {
    id: `auth_missing_credentials.${safeId(method)}.${safeId(path)}`,
    title: `Auth | ${method} ${path} rejects request without credentials`,
    type: "negative",
    priority: "P2",
    method,
    path,
    request: {
      query: {},
      headers: {},
    },
    steps: [`Send ${method} request to ${path} without authentication headers`],
    expected: ["API rejects unauthorized request"],
    assertions: [{ op: "status_in_set", values: [401, 403] }],
    needs_review: true,
    review_notes: ["Confirm auth style from OpenAPI security requirement"],
  };
}
