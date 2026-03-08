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

function baseAuthCase(endpoint, { title, objective, priority = "P0" }) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const moduleName = buildModuleName(endpoint);

  return {
    id: "",
    title,
    module: moduleName,
    test_type: "auth",
    priority,
    objective,
    preconditions: [
      "The API base URL is available for the selected environment.",
      "The endpoint is deployed and reachable.",
      "The endpoint is expected to require authentication or authorization.",
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
    ],
    expected_results: [],
    api_details: {
      method,
      path,
    },
    validation_focus: [],
    references: [],
    needs_review: true,
    review_notes: "",
  };
}

export function makeAuthMissingCredentialsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseAuthCase(endpoint, {
    title: `Verify ${method} ${path} rejects request without authentication credentials`,
    objective:
      "Verify that the API rejects access when authentication credentials are not provided.",
    priority: "P0",
  });

  tc.steps.push(
    "Do not send authentication credentials or authorization headers.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    "An authentication or authorization error response is returned, such as HTTP 401 or HTTP 403.",
    "The response indicates that credentials are missing or invalid.",
  ];

  tc.validation_focus = [
    "Authentication enforcement",
    "Unauthorized access handling",
    "Security negative validation",
  ];

  tc.review_notes = `Confirm the exact unauthorized response code and error structure for ${path}.`;

  return tc;
}

export function makeAuthInvalidCredentialsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseAuthCase(endpoint, {
    title: `Verify ${method} ${path} rejects request with invalid authentication credentials`,
    objective:
      "Verify that the API rejects access when invalid authentication credentials or tokens are provided.",
    priority: "P0",
  });

  tc.test_data.headers = {
    Authorization: "Bearer <invalid_token>",
  };

  tc.steps.push(
    "Send an invalid authentication token or invalid credentials in the authorization header.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    "An authentication error response such as HTTP 401 or HTTP 403 is returned.",
    "The response indicates that the supplied credentials or token are invalid.",
  ];

  tc.validation_focus = [
    "Invalid credential handling",
    "Authentication token validation",
    "Unauthorized access rejection",
  ];

  tc.review_notes = `Confirm the exact invalid-credential response code and error body for ${path}.`;

  return tc;
}

export function makeAuthExpiredCredentialsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseAuthCase(endpoint, {
    title: `Verify ${method} ${path} rejects request with expired authentication credentials`,
    objective:
      "Verify that the API rejects access when an expired authentication token or credential is provided.",
    priority: "P1",
  });

  tc.test_data.headers = {
    Authorization: "Bearer <expired_token>",
  };

  tc.steps.push(
    "Send an expired authentication token or expired credentials in the authorization header.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    "An authentication error response such as HTTP 401 is returned.",
    "The response indicates that the supplied token or credentials are expired.",
  ];

  tc.validation_focus = [
    "Expired credential handling",
    "Token lifecycle enforcement",
    "Authentication validation",
  ];

  tc.review_notes = `Confirm the exact expired-token response code and error body for ${path}.`;

  return tc;
}

export function makeAuthForbiddenRoleTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseAuthCase(endpoint, {
    title: `Verify ${method} ${path} rejects caller without required role or scope`,
    objective:
      "Verify that the API rejects authenticated callers who do not have the required role, permission, or scope.",
    priority: "P0",
  });

  tc.test_data.headers = {
    Authorization: "Bearer <valid_but_insufficient_scope_token>",
  };

  tc.steps.push(
    "Send a valid authentication token that does not include the required role, permission, or scope.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    "An authorization error response such as HTTP 403 is returned.",
    "The response indicates that the caller does not have sufficient privileges.",
  ];

  tc.validation_focus = [
    "Authorization enforcement",
    "Role/scope validation",
    "Forbidden access handling",
  ];

  tc.review_notes = `Confirm the exact forbidden response code and role/scope error structure for ${path}.`;

  return tc;
}
