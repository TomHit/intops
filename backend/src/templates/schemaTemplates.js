function safeId(s) {
  return String(s || "")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function makeSchemaResponseTemplate(endpoint) {
  const method = String(endpoint.method).toUpperCase();
  const path = endpoint.path;

  return {
    id: `schema_response.${safeId(method)}.${safeId(path)}`,
    title: `Schema | ${method} ${path} response matches schema`,
    type: "contract",
    priority: "P1",
    method,
    path,
    request: {
      query: {},
      headers: {},
    },
    steps: [
      `Send ${method} request to ${path}`,
      "Validate response body against OpenAPI schema",
    ],
    expected: ["Response matches declared schema"],
    assertions: [{ op: "schema_validate_response" }],
    needs_review: true,
    review_notes: ["Attach response schema reference from OpenAPI"],
  };
}

export function makeSchemaRequestBodyTemplate(endpoint) {
  const method = String(endpoint.method).toUpperCase();
  const path = endpoint.path;

  return {
    id: `schema_request.${safeId(method)}.${safeId(path)}`,
    title: `Schema | ${method} ${path} request body matches schema`,
    type: "contract",
    priority: "P2",
    method,
    path,
    request: {
      query: {},
      headers: {},
      body: {},
    },
    steps: [
      `Prepare request body for ${method} ${path}`,
      "Validate request body against OpenAPI schema",
    ],
    expected: ["Request body conforms to declared schema"],
    assertions: [{ op: "schema_validate_request" }],
    needs_review: true,
    review_notes: ["Generate valid sample payload from requestBody schema"],
  };
}
