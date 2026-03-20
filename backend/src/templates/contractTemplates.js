import { generateObjectFromSchema } from "../utils/testDataGenerator.js";

function buildModuleName(endpoint) {
  const tags = Array.isArray(endpoint?.tags) ? endpoint.tags : [];
  if (tags.length > 0) return `${tags[0]} API`;
  return `${endpoint?.method || "API"} ${endpoint?.path || ""}`.trim();
}

function prettyValue(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildRequestUrlLabel(path) {
  return `{base_url}${path || "/"}`;
}

function buildExecutionSteps(
  method,
  path,
  testData = {},
  { includeResponseReview = false } = {},
) {
  const steps = [];
  const url = buildRequestUrlLabel(path);

  steps.push(
    `Open an API client such as Postman or any approved API testing tool.`,
  );
  steps.push(`Select the ${method} method.`);
  steps.push(`Enter the request URL: ${url}.`);

  const pathParams = testData?.path_params || {};
  const queryParams = testData?.query_params || {};
  const headers = testData?.headers || {};
  const requestBody = testData?.request_body;

  for (const [key, value] of Object.entries(pathParams)) {
    steps.push(`Set path parameter '${key}' = '${prettyValue(value)}'.`);
  }

  for (const [key, value] of Object.entries(queryParams)) {
    steps.push(`Set query parameter '${key}' = '${prettyValue(value)}'.`);
  }

  for (const [key, value] of Object.entries(headers)) {
    steps.push(`Set header '${key}' = '${prettyValue(value)}'.`);
  }

  if (requestBody !== null && requestBody !== undefined) {
    steps.push(
      `Add the request body using the generated valid JSON payload shown in the test data section.`,
    );
  }

  steps.push(`Send the request.`);

  if (includeResponseReview) {
    steps.push(
      `Review the response body and compare it with the documented API contract.`,
    );
  }

  return steps;
}

function buildContractExpectedResults(endpoint, scenario) {
  const successStatus = getSuccessStatus(endpoint);
  const contentType = getContentType(endpoint);
  const requiredFieldAssertions = buildRequiredFieldAssertions(endpoint);
  const responseAssertions = buildResponseAssertions(endpoint, 4);
  const topFields = getTopLevelResponseFields(endpoint);
  const responseHeaders = getResponseHeaders(endpoint);

  if (scenario === "success") {
    return [
      `The API responds with HTTP ${successStatus}.`,
      `The response includes a Content-Type header matching '${contentType}' or a compatible JSON media type.`,
      `When the endpoint returns a response body, the body is valid JSON.`,
      `The response structure matches the documented success contract.`,
      ...requiredFieldAssertions,
      ...responseAssertions,
      ...(topFields.length > 0 &&
      requiredFieldAssertions.length === 0 &&
      responseAssertions.length === 0
        ? [
            `The response contains the expected top-level fields: ${topFields.join(", ")}.`,
          ]
        : []),
    ];
  }

  if (scenario === "status_code") {
    return [
      `The API responds with HTTP ${successStatus}.`,
      `The returned success status code matches the documented API contract.`,
      `No unexpected 4xx or 5xx status code is returned for a valid request.`,
    ];
  }

  if (scenario === "required_fields") {
    return [
      `The API responds with HTTP ${successStatus}.`,
      `All mandatory response fields defined in the contract are present.`,
      `No required field is missing from the response payload.`,
      `No mandatory field is returned with an unexpected top-level structure.`,
      ...requiredFieldAssertions,
      ...(topFields.length > 0 && requiredFieldAssertions.length === 0
        ? [
            `The tester can confirm the presence of these documented fields: ${topFields.join(", ")}.`,
          ]
        : []),
    ];
  }

  if (scenario === "content_type") {
    return [
      `The API responds with HTTP ${successStatus}.`,
      `The response contains a Content-Type header.`,
      `The Content-Type header starts with '${contentType}' or matches the documented compatible media type.`,
      `The response media type matches the API contract.`,
    ];
  }

  if (scenario === "response_headers") {
    return [
      `The API responds with HTTP ${successStatus}.`,
      ...(responseHeaders.length > 0
        ? [
            `The response contains the documented response headers: ${responseHeaders.join(", ")}.`,
          ]
        : [`The response headers match the documented contract behavior.`]),
      `No documented response header is unexpectedly missing.`,
    ];
  }

  if (scenario === "query_params") {
    const requiredQuery = getRequiredQueryParams(endpoint).map((p) => p.name);
    const optionalQuery = getOptionalQueryParams(endpoint).map((p) => p.name);

    return [
      `The endpoint accepts the documented query parameters for a valid request.`,
      ...(requiredQuery.length > 0
        ? [
            `Required query parameters are supported: ${requiredQuery.join(", ")}.`,
          ]
        : []),
      ...(optionalQuery.length > 0
        ? [
            `Optional query parameters are accepted when provided according to the contract: ${optionalQuery.join(", ")}.`,
          ]
        : []),
      `The request is processed according to the documented query parameter contract.`,
    ];
  }

  if (scenario === "path_params") {
    const schemaPathParams = Array.isArray(endpoint?.params?.path)
      ? endpoint.params.path
      : [];
    const pathParams = schemaPathParams.map((p) => p?.name).filter(Boolean);

    return [
      `The endpoint accepts the documented path parameters.`,
      ...(pathParams.length > 0
        ? [
            `The documented path parameters for this endpoint are: ${pathParams.join(", ")}.`,
          ]
        : []),
      `The request is processed according to the documented path parameter contract.`,
    ];
  }

  if (scenario === "request_body") {
    const requestSchema = getRequestSchema(endpoint);
    const requestRequired = Array.isArray(requestSchema?.required)
      ? requestSchema.required
      : [];
    const requestBody = buildRequestBody(endpoint);
    const bodyFields = requestBody ? Object.keys(requestBody) : [];
    const requestFieldAssertions = buildRequestFieldAssertions(endpoint, 4);

    return [
      `The request body structure is accepted by the API for a valid request.`,
      ...requestRequired
        .slice(0, 5)
        .map((field) => `Required request field '${field}' is included.`),
      ...requestFieldAssertions,
      ...(bodyFields.length > 0 &&
      requestRequired.length === 0 &&
      requestFieldAssertions.length === 0
        ? [
            `The tester can confirm the documented request body fields: ${bodyFields.join(", ")}.`,
          ]
        : []),
      `No contract-related request body validation error occurs for valid input.`,
    ];
  }

  if (scenario === "error_response") {
    const errorCodes = getDocumentedErrorCodes(endpoint);
    return [
      `The API contract documents error responses consistently.`,
      ...(errorCodes.length > 0
        ? [
            `The documented error status codes include: ${errorCodes.join(", ")}.`,
          ]
        : [`Documented error responses are available where applicable.`]),
      `Error response behavior is consistent with the documented API contract.`,
      `Each documented error response should return a controlled and understandable failure payload.`,
    ];
  }

  return [`The request follows the documented API contract.`];
}

function buildContractValidationFocus(endpoint, scenario) {
  if (scenario === "success") {
    return [
      "HTTP success status",
      "Response content type",
      "Response contract structure",
      "Presence of required response fields",
      ...getTopLevelResponseProperties(endpoint)
        .slice(0, 3)
        .map(([field]) => `Field:${field}`),
    ];
  }

  if (scenario === "status_code") {
    return ["HTTP success status", "Documented status code compliance"];
  }

  if (scenario === "required_fields") {
    return [
      "Mandatory response fields",
      "Presence of documented keys",
      "Contract completeness",
      ...getTopLevelResponseProperties(endpoint)
        .slice(0, 3)
        .map(([field]) => `Field:${field}`),
    ];
  }

  if (scenario === "content_type") {
    return ["Response content type", "Contract media type compliance"];
  }

  if (scenario === "response_headers") {
    return ["Response header validation", "Contract header compliance"];
  }

  if (scenario === "query_params") {
    return [
      "Query parameter contract",
      "Required and optional query parameter handling",
    ];
  }

  if (scenario === "path_params") {
    return ["Path parameter contract", "Resource identifier handling"];
  }

  if (scenario === "request_body") {
    return [
      "Request body contract",
      "Documented request body fields",
      ...getRequestSchemaProperties(endpoint)
        .slice(0, 3)
        .map(([field]) => `Field:${field}`),
    ];
  }

  if (scenario === "error_response") {
    return ["Error response contract", "Documented error codes"];
  }

  return ["API contract validation"];
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

function buildRequestBody(endpoint) {
  const schema =
    endpoint?.requestBody?.content?.["application/json"]?.schema ||
    endpoint?.requestBody?.content?.["application/*+json"]?.schema ||
    null;

  if (!schema) return null;

  return generateObjectFromSchema(schema);
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

function getResponseSchema(endpoint) {
  const responses = endpoint?.responses || {};
  for (const code of Object.keys(responses)) {
    if (!/^2\d\d$/.test(String(code))) continue;

    const schema =
      responses[code]?.content?.["application/json"]?.schema ||
      responses[code]?.content?.["application/*+json"]?.schema ||
      null;

    if (schema) return schema;
  }

  return null;
}

function getRequestSchema(endpoint) {
  return (
    endpoint?.requestBody?.content?.["application/json"]?.schema ||
    endpoint?.requestBody?.content?.["application/*+json"]?.schema ||
    null
  );
}

function describeSchemaType(schema = {}) {
  if (schema?.type) return schema.type;
  if (schema?.properties) return "object";
  if (schema?.items) return "array";
  return "value";
}

function getTopLevelResponseProperties(endpoint) {
  const schema = getResponseSchema(endpoint);
  const props =
    schema?.properties && typeof schema.properties === "object"
      ? schema.properties
      : {};
  return Object.entries(props);
}

function getRequestSchemaProperties(endpoint) {
  const schema = getRequestSchema(endpoint);
  const props =
    schema?.properties && typeof schema.properties === "object"
      ? schema.properties
      : {};
  return Object.entries(props);
}

function buildRequiredFieldAssertions(endpoint) {
  const schema = getResponseSchema(endpoint);
  const required = Array.isArray(schema?.required) ? schema.required : [];

  return required
    .slice(0, 5)
    .map((field) => `Required response field '${field}' is present.`);
}

function buildResponseAssertions(endpoint, maxFields = 4) {
  const entries = getTopLevelResponseProperties(endpoint).slice(0, maxFields);
  const assertions = [];

  for (const [fieldName, fieldSchema] of entries) {
    const fieldType = describeSchemaType(fieldSchema);

    if (fieldType === "object") {
      assertions.push(`The response contains '${fieldName}' as an object.`);
    } else if (fieldType === "array") {
      assertions.push(`The response contains '${fieldName}' as an array.`);
    } else {
      assertions.push(
        `The response contains '${fieldName}' with type '${fieldType}'.`,
      );
    }

    if (fieldSchema?.format === "email") {
      assertions.push(`Field '${fieldName}' follows email format.`);
    }

    if (Array.isArray(fieldSchema?.enum) && fieldSchema.enum.length > 0) {
      assertions.push(
        `Field '${fieldName}' contains one of the allowed values: ${fieldSchema.enum.join(", ")}.`,
      );
    }
  }

  return assertions;
}

function buildRequestFieldAssertions(endpoint, maxFields = 4) {
  const entries = getRequestSchemaProperties(endpoint).slice(0, maxFields);
  const assertions = [];

  for (const [fieldName, fieldSchema] of entries) {
    const fieldType = describeSchemaType(fieldSchema);

    if (fieldType === "object") {
      assertions.push(`Request field '${fieldName}' is sent as an object.`);
    } else if (fieldType === "array") {
      assertions.push(`Request field '${fieldName}' is sent as an array.`);
    } else {
      assertions.push(
        `Request field '${fieldName}' matches type '${fieldType}'.`,
      );
    }

    if (fieldSchema?.format === "email") {
      assertions.push(`Request field '${fieldName}' follows email format.`);
    }

    if (Array.isArray(fieldSchema?.enum) && fieldSchema.enum.length > 0) {
      assertions.push(
        `Request field '${fieldName}' uses one of the allowed values: ${fieldSchema.enum.join(", ")}.`,
      );
    }
  }

  return assertions;
}

function hasRequestBody(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  if (method === "GET" || method === "DELETE") return false;
  return !!buildRequestBody(endpoint);
}

function baseCase(
  endpoint,
  { title, objective, priority = "P1", includeResponseReview = false },
) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const moduleName = buildModuleName(endpoint);

  const initialTestData = {
    path_params: {},
    query_params: {},
    headers: {},
    request_body: hasRequestBody(endpoint) ? buildRequestBody(endpoint) : null,
  };

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
    test_data: initialTestData,
    steps: buildExecutionSteps(method, path, initialTestData, {
      includeResponseReview,
    }),
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

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} returns a valid success response`,
    objective:
      "Verify that the endpoint returns a successful response with the expected contract structure for a valid request.",
    priority: "P1",
  });

  tc.expected_results = buildContractExpectedResults(endpoint, "success");
  tc.validation_focus = buildContractValidationFocus(endpoint, "success");

  return tc;
}

export function makeContractStatusCodeTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} returns the documented success status code`,
    objective:
      "Verify that the endpoint returns the documented HTTP success status code for a valid request.",
    priority: "P1",
  });

  tc.expected_results = buildContractExpectedResults(endpoint, "status_code");
  tc.validation_focus = buildContractValidationFocus(endpoint, "status_code");

  return tc;
}
export function makeContractRequiredFieldsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} returns all mandatory contract fields`,
    objective:
      "Verify that the endpoint response includes all mandatory fields defined in the API contract.",
    priority: "P1",
    includeResponseReview: true,
  });

  tc.expected_results = buildContractExpectedResults(
    endpoint,
    "required_fields",
  );
  tc.validation_focus = buildContractValidationFocus(
    endpoint,
    "required_fields",
  );

  return tc;
}
export function makeContractContentTypeTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} returns the documented response content type`,
    objective:
      "Verify that the endpoint returns the documented response media type for a valid request.",
    priority: "P1",
  });

  tc.expected_results = buildContractExpectedResults(endpoint, "content_type");
  tc.validation_focus = buildContractValidationFocus(endpoint, "content_type");

  return tc;
}

export function makeContractResponseHeadersTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} returns documented response headers`,
    objective:
      "Verify that the endpoint returns the response headers documented in the API contract.",
    priority: "P1",
  });

  tc.expected_results = buildContractExpectedResults(
    endpoint,
    "response_headers",
  );
  tc.validation_focus = buildContractValidationFocus(
    endpoint,
    "response_headers",
  );

  return tc;
}
export function makeContractQueryParamsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} accepts documented query parameters`,
    objective:
      "Verify that the endpoint accepts and processes documented query parameters correctly.",
    priority: "P1",
  });

  tc.expected_results = buildContractExpectedResults(endpoint, "query_params");
  tc.validation_focus = buildContractValidationFocus(endpoint, "query_params");

  return tc;
}
export function makeContractPathParamsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} accepts documented path parameters`,
    objective:
      "Verify that the endpoint accepts and processes documented path parameters correctly.",
    priority: "P1",
  });

  tc.expected_results = buildContractExpectedResults(endpoint, "path_params");
  tc.validation_focus = buildContractValidationFocus(endpoint, "path_params");

  return tc;
}

export function makeContractRequestBodyTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} accepts documented request body fields`,
    objective:
      "Verify that the endpoint accepts a request body matching the documented API contract.",
    priority: "P1",
    includeResponseReview: true,
  });

  tc.expected_results = buildContractExpectedResults(endpoint, "request_body");
  tc.validation_focus = buildContractValidationFocus(endpoint, "request_body");

  return tc;
}
export function makeContractErrorResponseTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} documents and returns consistent error responses`,
    objective:
      "Verify that the endpoint exposes and follows documented error response behavior.",
    priority: "P2",
  });

  tc.expected_results = buildContractExpectedResults(
    endpoint,
    "error_response",
  );
  tc.validation_focus = buildContractValidationFocus(
    endpoint,
    "error_response",
  );
  tc.needs_review = true;
  tc.review_notes =
    "Review the exact triggering conditions and expected payload structure for documented error responses.";

  return tc;
}
export { buildExecutionSteps, hasRequestBody };
