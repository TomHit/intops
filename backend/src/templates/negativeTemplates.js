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

export function makeNegativeMissingRequiredQueryTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const moduleName = buildModuleName(endpoint);

  const requiredQuery = (
    Array.isArray(endpoint?.params?.query) ? endpoint.params.query : []
  ).find((p) => p?.required);

  const missingParamName = requiredQuery?.name || "<required_query_param>";

  const validQuery = buildQueryParams(endpoint);
  delete validQuery[missingParamName];

  return {
    id: buildCaseId("NEGATIVE_MISSING_REQUIRED_QUERY", endpoint, "001"),
    title: `Verify ${method} ${path} rejects request when required query parameter is missing`,
    module: moduleName,
    test_type: "negative",
    priority: "P1",
    objective:
      "Verify that the API rejects the request when a required query parameter is not provided.",
    preconditions: [
      "The API base URL is available for the selected environment.",
      "The endpoint is deployed and reachable.",
      "Any required authentication or access credentials are available if applicable.",
    ],
    test_data: {
      path_params: buildPathParams(endpoint),
      query_params: validQuery,
      headers: {},
      request_body: null,
    },
    steps: [
      "Open an API client such as Postman or any approved API testing tool.",
      `Select the ${method} method.`,
      `Enter the endpoint URL using the configured base URL and path ${path}.`,
      `Add all normally required query parameters except ${missingParamName}.`,
      "Add required headers if applicable.",
      "Send the request.",
    ],
    expected_results: [
      "The API rejects the request.",
      "A client-side error response is returned, such as HTTP 400 or HTTP 422.",
      "The error response indicates that a required query parameter is missing or invalid.",
    ],
    api_details: {
      method,
      path,
    },
    validation_focus: [
      "Required query parameter validation",
      "Client error handling",
      "Negative request validation",
    ],
    references: [],
    needs_review: true,
    review_notes: `Confirm the exact required query parameter and expected error response format for ${path}.`,
  };
}
