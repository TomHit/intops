function buildModuleName(endpoint) {
  const tags = Array.isArray(endpoint?.tags) ? endpoint.tags : [];
  if (tags.length > 0) return `${tags[0]} API`;
  return `${endpoint?.method || "API"} ${endpoint?.path || ""}`.trim();
}

function getRequiredQueryParams(endpoint) {
  const query = Array.isArray(endpoint?.params?.query)
    ? endpoint.params.query
    : [];
  return query.filter((p) => p?.required);
}

function getOptionalQueryParams(endpoint) {
  const query = Array.isArray(endpoint?.params?.query)
    ? endpoint.params.query
    : [];
  return query.filter((p) => !p?.required);
}

function buildQueryParams(endpoint) {
  const out = {};

  for (const p of getRequiredQueryParams(endpoint)) {
    out[p.name] = `<provide_valid_${p.name}>`;
  }

  for (const p of getOptionalQueryParams(endpoint)) {
    if (!(p.name in out)) {
      out[p.name] = `<optional_${p.name}>`;
    }
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

function getSuccessStatus(endpoint) {
  const responses = endpoint?.responses || {};
  if (responses["200"]) return 200;
  if (responses["201"]) return 201;
  if (responses["202"]) return 202;
  if (responses["204"]) return 204;

  const status = endpoint?.response?.status;
  if (typeof status === "number") return status;

  return 200;
}

function getContentType(endpoint) {
  const responses = endpoint?.responses || {};
  for (const code of Object.keys(responses)) {
    if (!/^2\d\d$/.test(String(code))) continue;
    const content = responses[code]?.content || {};
    if (content["application/json"]) return "application/json";
    const keys = Object.keys(content);
    if (keys.length > 0) return keys[0];
  }

  return endpoint?.response?.contentType || "application/json";
}

function getTopLevelResponseFields(endpoint) {
  const responses = endpoint?.responses || {};
  for (const code of Object.keys(responses)) {
    if (!/^2\d\d$/.test(String(code))) continue;
    const schema =
      responses[code]?.content?.["application/json"]?.schema ||
      responses[code]?.content?.["application/*+json"]?.schema ||
      null;

    if (schema?.properties && typeof schema.properties === "object") {
      return Object.keys(schema.properties).slice(0, 10);
    }
  }

  return Array.isArray(endpoint?.response?.schemaSummary?.properties)
    ? endpoint.response.schemaSummary.properties.slice(0, 10)
    : [];
}

function getResponseHeaders(endpoint) {
  const responses = endpoint?.responses || {};
  for (const code of Object.keys(responses)) {
    if (!/^2\d\d$/.test(String(code))) continue;
    const headers = responses[code]?.headers || {};
    const names = Object.keys(headers);
    if (names.length > 0) return names.slice(0, 10);
  }
  return [];
}

function getDocumentedErrorCodes(endpoint) {
  const responses = endpoint?.responses || {};
  return Object.keys(responses)
    .filter((code) => /^[45]\d\d$/.test(String(code)))
    .slice(0, 10);
}

function hasRequestBody(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  if (method === "GET" || method === "DELETE") return false;
  return !!buildRequestBody(endpoint);
}

function baseCase(endpoint, { title, objective, priority = "P1" }) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const moduleName = buildModuleName(endpoint);

  return {
    id: "",
    title,
    module: moduleName,
    test_type: "contract",
    priority,
    objective,
    preconditions: [
      "The API base URL is available for the selected environment.",
      "The endpoint is deployed and reachable.",
      "Required authentication or access credentials are available if applicable.",
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
      "Add all required path parameters, query parameters, and headers.",
      ...(hasRequestBody(endpoint)
        ? ["Add a valid request body if the endpoint requires one."]
        : []),
      "Send the request.",
    ],
    expected_results: [],
    api_details: {
      method,
      path,
    },
    validation_focus: [],
    references: [],
    needs_review: false,
    review_notes: "",
  };
}

export function makeContractSuccessTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const successStatus = getSuccessStatus(endpoint);
  const contentType = getContentType(endpoint);
  const topFields = getTopLevelResponseFields(endpoint);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} returns a valid success response`,
    objective:
      "Verify that the endpoint returns a successful response with the expected top-level contract structure.",
    priority: "P1",
  });

  tc.expected_results = [
    `The API responds with HTTP ${successStatus}.`,
    `The response body is returned in ${contentType} format.`,
    "The response structure matches the documented API contract.",
    topFields.length > 0
      ? `The response contains the expected top-level fields: ${topFields.join(", ")}.`
      : "The response contains the expected top-level fields defined in the API contract.",
  ];

  tc.validation_focus = [
    "HTTP success status",
    "Response content type",
    "Top-level response contract",
    "Presence of expected response fields",
  ];

  return tc;
}

export function makeContractStatusCodeTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const successStatus = getSuccessStatus(endpoint);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} returns the documented success status code`,
    objective:
      "Verify that the endpoint returns the documented HTTP success status code for a valid request.",
    priority: "P1",
  });

  tc.expected_results = [
    `The API responds with HTTP ${successStatus}.`,
    "The returned success status code matches the documented API contract.",
    "No unexpected success or client/server error code is returned for a valid request.",
  ];

  tc.validation_focus = [
    "HTTP success status",
    "Documented status code compliance",
  ];

  return tc;
}

export function makeContractRequiredFieldsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const successStatus = getSuccessStatus(endpoint);
  const topFields = getTopLevelResponseFields(endpoint);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} returns all mandatory contract fields`,
    objective:
      "Verify that the endpoint response includes all mandatory fields defined in the API contract.",
    priority: "P1",
  });

  tc.steps.push(
    "Review the response body and compare it with the documented contract.",
  );

  tc.expected_results = [
    `The API responds with HTTP ${successStatus}.`,
    "All mandatory response fields defined in the contract are present.",
    "No required field is missing or returned as an unexpected structure.",
    ...(topFields.length > 0
      ? [
          `The tester can confirm the presence of these documented fields: ${topFields.join(", ")}.`,
        ]
      : []),
  ];

  tc.validation_focus = [
    "Mandatory response fields",
    "Presence of documented keys",
    "Contract completeness",
  ];

  return tc;
}

export function makeContractContentTypeTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const successStatus = getSuccessStatus(endpoint);
  const contentType = getContentType(endpoint);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} returns the documented response content type`,
    objective:
      "Verify that the endpoint returns the response in the documented content type.",
    priority: "P1",
  });

  tc.expected_results = [
    `The API responds with HTTP ${successStatus}.`,
    `The response Content-Type is ${contentType}.`,
    "The response media type matches the API contract.",
  ];

  tc.validation_focus = [
    "Response content type",
    "Contract media type compliance",
  ];

  return tc;
}

export function makeContractResponseHeadersTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const successStatus = getSuccessStatus(endpoint);
  const headerNames = getResponseHeaders(endpoint);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} returns documented response headers`,
    objective:
      "Verify that the endpoint returns the response headers documented in the API contract.",
    priority: "P1",
  });

  tc.expected_results = [
    `The API responds with HTTP ${successStatus}.`,
    "The response contains the documented response headers.",
    ...(headerNames.length > 0
      ? [
          `The tester can confirm the presence of these response headers: ${headerNames.join(", ")}.`,
        ]
      : ["The response headers match the documented contract behavior."]),
  ];

  tc.validation_focus = [
    "Response header validation",
    "Contract header compliance",
  ];

  return tc;
}

export function makeContractQueryParamsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const requiredQuery = getRequiredQueryParams(endpoint).map((p) => p.name);
  const optionalQuery = getOptionalQueryParams(endpoint).map((p) => p.name);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} accepts documented query parameters`,
    objective:
      "Verify that the endpoint accepts and processes documented query parameters correctly.",
    priority: "P1",
  });

  tc.expected_results = [
    "The endpoint accepts documented query parameters without contract errors.",
    ...(requiredQuery.length > 0
      ? [
          `Required query parameters are supported: ${requiredQuery.join(", ")}.`,
        ]
      : []),
    ...(optionalQuery.length > 0
      ? [
          `Optional query parameters are supported when provided: ${optionalQuery.join(", ")}.`,
        ]
      : []),
    "The request is processed according to the API contract.",
  ];

  tc.validation_focus = [
    "Query parameter contract",
    "Required and optional query parameter handling",
  ];

  return tc;
}

export function makeContractPathParamsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const pathParams = Object.keys(buildPathParams(endpoint));

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} accepts documented path parameters`,
    objective:
      "Verify that the endpoint accepts and processes documented path parameters correctly.",
    priority: "P1",
  });

  tc.expected_results = [
    "The endpoint accepts the documented path parameters.",
    ...(pathParams.length > 0
      ? [
          `The tester can confirm the path parameters used by this endpoint: ${pathParams.join(", ")}.`,
        ]
      : []),
    "The request is processed according to the documented path contract.",
  ];

  tc.validation_focus = [
    "Path parameter contract",
    "Resource identifier handling",
  ];

  return tc;
}

export function makeContractRequestBodyTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";
  const requestBody = buildRequestBody(endpoint);
  const bodyFields = requestBody ? Object.keys(requestBody) : [];

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} accepts documented request body fields`,
    objective:
      "Verify that the endpoint accepts a request body matching the documented API contract.",
    priority: "P1",
  });

  tc.steps.push(
    "Review the request body fields sent in the request and compare them with the documented request contract.",
  );

  tc.expected_results = [
    "The request body structure is accepted by the API.",
    ...(bodyFields.length > 0
      ? [
          `The tester can confirm the documented request body fields: ${bodyFields.join(", ")}.`,
        ]
      : ["The request body matches the documented API contract."]),
    "No contract-related request body error occurs for valid input.",
  ];

  tc.validation_focus = [
    "Request body contract",
    "Documented request body fields",
  ];

  return tc;
}

export function makeContractErrorResponseTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const errorCodes = getDocumentedErrorCodes(endpoint);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} documents and returns consistent error responses`,
    objective:
      "Verify that the endpoint exposes and follows documented error response behavior.",
    priority: "P2",
  });

  tc.expected_results = [
    "The API defines error responses consistently in the contract.",
    ...(errorCodes.length > 0
      ? [`The documented error status codes include: ${errorCodes.join(", ")}.`]
      : ["Documented error responses are available where applicable."]),
    "Error response behavior is consistent with the API contract.",
  ];

  tc.validation_focus = ["Error response contract", "Documented error codes"];

  tc.needs_review = true;
  tc.review_notes =
    "Review the exact triggering conditions and expected payload structure for documented error responses.";

  return tc;
}
