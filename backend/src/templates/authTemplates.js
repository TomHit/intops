function buildModuleName(endpoint) {
  const tags = Array.isArray(endpoint?.tags) ? endpoint.tags : [];
  if (tags.length > 0) return `${tags[0]} API`;
  return `${endpoint?.method || "API"} ${endpoint?.path || ""}`.trim();
}

function getResolvedValidRequest(endpoint) {
  const resolved = endpoint?._resolvedTestData || {};

  return {
    path_params: resolved?.valid?.path || {},
    query_params: resolved?.valid?.query || {},
    headers: resolved?.valid?.headers || {},
    cookies: resolved?.valid?.cookies || {},
    request_body:
      resolved?.valid?.body !== undefined ? resolved.valid.body : null,
  };
}

function baseAuthCase(endpoint, { title, objective, priority = "critical" }) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const moduleName = buildModuleName(endpoint);
  const validRequest = getResolvedValidRequest(endpoint);

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
      path_params: validRequest.path_params || {},
      query_params: validRequest.query_params || {},
      headers: validRequest.headers || {},
      cookies: validRequest.cookies || {},
      request_body:
        validRequest.request_body !== undefined
          ? validRequest.request_body
          : null,
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
    priority: "critical",
  });

  if (tc.test_data.headers) {
    delete tc.test_data.headers.Authorization;
    delete tc.test_data.headers.authorization;
    delete tc.test_data.headers["X-API-Key"];
    delete tc.test_data.headers["x-api-key"];
    delete tc.test_data.headers.Cookie;
    delete tc.test_data.headers.cookie;
  }

  if (tc.test_data.cookies) {
    tc.test_data.cookies = {};
  }

  tc.steps.push(
    "Do not send authentication credentials, session cookies, API keys, or authorization headers.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    "An authentication or authorization error response is returned, such as HTTP 401 or HTTP 403.",
    "The response indicates that credentials are missing or not provided.",
  ];

  tc.validation_focus = [
    "Authentication enforcement",
    "Unauthorized access handling",
    "Security negative validation",
  ];

  tc.references = [
    "template_key:auth.missing_credentials",
    "auth_case:missing_credentials",
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
    priority: "critical",
  });

  tc.test_data.headers = {
    ...(tc.test_data.headers || {}),
    Authorization: "Bearer invalid-token-123",
  };
  delete tc.test_data.headers.authorization;

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

  tc.references = [
    "template_key:auth.invalid_credentials",
    "auth_case:invalid_credentials",
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
    priority: "high",
  });

  tc.test_data.headers = {
    ...(tc.test_data.headers || {}),
    Authorization: "Bearer expired-token-123",
  };
  delete tc.test_data.headers.authorization;

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

  tc.references = [
    "template_key:auth.expired_credentials",
    "auth_case:expired_credentials",
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
    priority: "critical",
  });

  tc.test_data.headers = {
    ...(tc.test_data.headers || {}),
    Authorization: "Bearer valid-but-low-privilege-token",
  };
  delete tc.test_data.headers.authorization;

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

  tc.references = [
    "template_key:auth.forbidden_role",
    "auth_case:forbidden_role",
  ];

  tc.review_notes = `Confirm the exact forbidden response code and role/scope error structure for ${path}.`;

  return tc;
}
