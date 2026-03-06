function slug(value) {
  return String(value || "")
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function buildCaseId(prefix, endpoint, seq = "001") {
  return `TC_${prefix}_${slug(endpoint?.method)}_${slug(endpoint?.path)}_${seq}`;
}

function buildModuleName(endpoint) {
  const tags = Array.isArray(endpoint?.tags) ? endpoint.tags : [];
  if (tags.length > 0) return `${tags[0]} API`;
  return `${endpoint?.method || "API"} ${endpoint?.path || ""}`.trim();
}

function buildPathParams(endpoint) {
  const out = {};
  const pathParams = Array.isArray(endpoint?.params?.path)
    ? endpoint.params.path
    : [];
  for (const p of pathParams) {
    out[p.name] = `<valid_${p.name}>`;
  }
  return out;
}

function buildQueryParams(endpoint) {
  const out = {};
  const query = Array.isArray(endpoint?.params?.query)
    ? endpoint.params.query
    : [];
  for (const p of query) {
    out[p.name] = p.required ? `<required_${p.name}>` : `<optional_${p.name}>`;
  }
  return out;
}

export function makeAuthMissingCredentialsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const moduleName = buildModuleName(endpoint);

  return {
    id: buildCaseId("AUTH_MISSING_CREDENTIALS", endpoint, "001"),
    title: `Verify ${method} ${path} rejects request without authentication credentials`,
    module: moduleName,
    test_type: "auth",
    priority: "P0",
    objective:
      "Verify that the API rejects access when authentication credentials are not provided.",
    preconditions: [
      "The API base URL is available for the selected environment.",
      "The endpoint is deployed and reachable.",
      "The endpoint is expected to require authentication.",
    ],
    test_data: {
      path_params: buildPathParams(endpoint),
      query_params: buildQueryParams(endpoint),
      headers: {},
      request_body: null,
    },
    steps: [
      "Open an API client such as Postman or any approved API testing tool.",
      `Select the ${method} method.`,
      `Enter the endpoint URL using the configured base URL and path ${path}.`,
      "Add all required path parameters and query parameters.",
      "Do not send authentication credentials or authorization headers.",
      "Send the request.",
    ],
    expected_results: [
      "The API rejects the request.",
      "An authentication or authorization error response is returned, such as HTTP 401 or HTTP 403.",
      "The response indicates that credentials are missing or invalid.",
    ],
    api_details: {
      method,
      path,
    },
    validation_focus: [
      "Authentication enforcement",
      "Unauthorized access handling",
      "Security negative validation",
    ],
    references: [],
    needs_review: true,
    review_notes: `Confirm the exact unauthorized response code and error structure for ${path}.`,
  };
}
