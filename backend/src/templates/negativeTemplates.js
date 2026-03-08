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

function buildHeaders(endpoint) {
  const headers = {};
  if (Array.isArray(endpoint?.security) && endpoint.security.length > 0) {
    headers.Authorization = "Bearer <valid_token>";
  }
  return headers;
}

function buildRequestBody(endpoint) {
  const schema =
    endpoint?.requestBody?.content?.["application/json"]?.schema ||
    endpoint?.requestBody?.content?.["application/*+json"]?.schema ||
    null;

  if (!schema) return null;

  const props = schema?.properties || {};
  const body = {};

  for (const key of Object.keys(props)) {
    body[key] = `<valid_${key}>`;
  }

  return Object.keys(body).length > 0 ? body : {};
}

function hasRequestBody(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  if (method === "GET" || method === "DELETE") return false;
  return !!buildRequestBody(endpoint);
}

function getRequiredQueryParam(endpoint) {
  return (
    (Array.isArray(endpoint?.params?.query) ? endpoint.params.query : []).find(
      (p) => p?.required,
    ) || null
  );
}

function getRequiredPathParam(endpoint) {
  return (
    (Array.isArray(endpoint?.params?.path) ? endpoint.params.path : []).find(
      (p) => p?.required,
    ) || null
  );
}

function baseNegativeCase(endpoint, { title, objective, priority = "P1" }) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const moduleName = buildModuleName(endpoint);

  return {
    id: "",
    title,
    module: moduleName,
    test_type: "negative",
    priority,
    objective,
    preconditions: [
      "The API base URL is available for the selected environment.",
      "The endpoint is deployed and reachable.",
      "Any required authentication or access credentials are available if applicable.",
    ],
    test_data: {
      path_params: buildPathParams(endpoint),
      query_params: buildQueryParams(endpoint),
      headers: buildHeaders(endpoint),
      request_body: hasRequestBody(endpoint)
        ? buildRequestBody(endpoint)
        : null,
    },
    steps: [
      "Open an API client such as Postman or any approved API testing tool.",
      `Select the ${method} method.`,
      `Enter the endpoint URL using the configured base URL and path ${path}.`,
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

export function makeNegativeMissingRequiredQueryTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const requiredQuery = getRequiredQueryParam(endpoint);
  const missingParamName = requiredQuery?.name || "<required_query_param>";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} rejects request when required query parameter is missing`,
    objective:
      "Verify that the API rejects the request when a required query parameter is not provided.",
    priority: "P1",
  });

  const validQuery = buildQueryParams(endpoint);
  delete validQuery[missingParamName];

  tc.test_data.query_params = validQuery;
  tc.test_data.headers = buildHeaders(endpoint);
  tc.test_data.request_body = null;

  tc.steps.push(
    `Add all normally required query parameters except ${missingParamName}.`,
    "Add required headers if applicable.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    "A client-side error response is returned, such as HTTP 400 or HTTP 422.",
    "The error response indicates that a required query parameter is missing or invalid.",
  ];

  tc.validation_focus = [
    "Required query parameter validation",
    "Client error handling",
    "Negative request validation",
  ];

  tc.review_notes = `Confirm the exact required query parameter and expected error response format for ${path}.`;

  return tc;
}

export function makeNegativeMissingRequiredPathTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const requiredPath = getRequiredPathParam(endpoint);
  const missingParamName = requiredPath?.name || "<required_path_param>";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} rejects request when required path parameter is missing`,
    objective:
      "Verify that the API rejects or fails safely when a required path parameter is omitted or malformed.",
    priority: "P1",
  });

  tc.steps.push(
    `Prepare the endpoint request without a valid value for path parameter ${missingParamName}.`,
    "Add any other required query parameters and headers.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API does not process the request as a valid resource request.",
    "A client-side error response is returned, such as HTTP 400 or HTTP 404.",
    "The error response indicates that the path parameter or resource identifier is invalid or missing.",
  ];

  tc.validation_focus = [
    "Path parameter validation",
    "Malformed resource identifier handling",
    "Negative request validation",
  ];

  tc.review_notes = `Confirm how ${path} behaves when path parameter ${missingParamName} is omitted or malformed.`;

  return tc;
}

export function makeNegativeUnsupportedMethodTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const invalidMethod =
    method === "GET"
      ? "POST"
      : method === "POST"
        ? "DELETE"
        : method === "DELETE"
          ? "POST"
          : "GET";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${path} rejects unsupported HTTP methods`,
    objective:
      "Verify that the API rejects requests made with an unsupported HTTP method.",
    priority: "P2",
  });

  tc.steps[1] = `Select an unsupported method such as ${invalidMethod}.`;
  tc.steps.push(
    "Add required parameters and headers if applicable.",
    "Send the request using the unsupported HTTP method.",
  );

  tc.expected_results = [
    "The API rejects the request made with the unsupported method.",
    "A suitable response such as HTTP 405 or another documented client error is returned.",
    "The response clearly indicates that the method is not allowed or unsupported.",
  ];

  tc.validation_focus = [
    "HTTP method enforcement",
    "Method-not-allowed handling",
    "Negative protocol validation",
  ];

  tc.review_notes = `Confirm the expected unsupported-method response code for ${path}.`;

  return tc;
}

export function makeNegativeInvalidContentTypeTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} rejects unsupported Content-Type header`,
    objective:
      "Verify that the API rejects requests sent with an invalid or unsupported Content-Type header.",
    priority: "P1",
  });

  tc.test_data.headers = {
    ...buildHeaders(endpoint),
    "Content-Type": "text/plain",
  };
  tc.test_data.request_body = hasRequestBody(endpoint)
    ? buildRequestBody(endpoint)
    : {};

  tc.steps.push(
    "Set the Content-Type header to an unsupported media type such as text/plain.",
    "Add a request body if the endpoint expects one.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the request.",
    "A client-side error response such as HTTP 400 or HTTP 415 is returned.",
    "The response indicates that the request media type is invalid or unsupported.",
  ];

  tc.validation_focus = [
    "Request media type validation",
    "Content-Type enforcement",
    "Negative request validation",
  ];

  tc.review_notes = `Confirm the exact invalid Content-Type response code for ${path}.`;

  return tc;
}

export function makeNegativeMalformedJsonTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} rejects malformed JSON request body`,
    objective:
      "Verify that the API rejects syntactically invalid JSON request payloads.",
    priority: "P1",
  });

  tc.test_data.headers = {
    ...buildHeaders(endpoint),
    "Content-Type": "application/json",
  };
  tc.test_data.request_body = "{ invalid_json: true ";

  tc.steps.push(
    "Set the Content-Type header to application/json.",
    "Send a malformed JSON body that cannot be parsed correctly.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API rejects the malformed JSON payload.",
    "A client-side error response such as HTTP 400 is returned.",
    "The response indicates that the request body is not valid JSON.",
  ];

  tc.validation_focus = [
    "Malformed JSON handling",
    "Request parsing validation",
    "Negative request validation",
  ];

  tc.review_notes = `Confirm the exact malformed JSON error response for ${path}.`;

  return tc;
}

export function makeNegativeEmptyBodyTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} rejects empty request body when body is required`,
    objective:
      "Verify that the API rejects an empty request body when the endpoint expects a required payload.",
    priority: "P1",
  });

  tc.test_data.headers = {
    ...buildHeaders(endpoint),
    "Content-Type": "application/json",
  };
  tc.test_data.request_body = {};

  tc.steps.push(
    "Set the Content-Type header to application/json.",
    "Send the request with an empty body or an empty JSON object.",
    "Observe the API response.",
  );

  tc.expected_results = [
    "The API rejects the empty or missing request body.",
    "A client-side error response such as HTTP 400 or HTTP 422 is returned.",
    "The response indicates that the request body or required fields are missing.",
  ];

  tc.validation_focus = [
    "Required body validation",
    "Missing payload handling",
    "Negative request validation",
  ];

  tc.review_notes = `Confirm whether ${path} treats empty JSON and missing body differently.`;

  return tc;
}

export function makeNegativeResourceNotFoundTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const fakePathParams = buildPathParams(endpoint);
  for (const key of Object.keys(fakePathParams)) {
    fakePathParams[key] = `<non_existent_${key}>`;
  }

  const tc = baseNegativeCase(endpoint, {
    title: `Verify ${method} ${path} returns correct error for non-existent resource`,
    objective:
      "Verify that the API returns the correct error response when a non-existent resource identifier is used.",
    priority: "P1",
  });

  tc.test_data.path_params = fakePathParams;

  tc.steps.push(
    "Use a non-existent or invalid resource identifier in the path parameters.",
    "Add required query parameters and headers if applicable.",
    "Send the request.",
  );

  tc.expected_results = [
    "The API does not return a successful resource response.",
    "A not-found style response such as HTTP 404 is returned.",
    "The response indicates that the requested resource does not exist.",
  ];

  tc.validation_focus = [
    "Resource existence validation",
    "Not-found handling",
    "Negative resource lookup validation",
  ];

  tc.review_notes = `Confirm the expected not-found response code and body for ${path}.`;

  return tc;
}
