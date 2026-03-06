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

function buildQueryParams(endpoint) {
  const out = {};
  const query = Array.isArray(endpoint?.params?.query)
    ? endpoint.params.query
    : [];
  for (const p of query) {
    out[p.name] = p.required
      ? `<provide_valid_${p.name}>`
      : `<optional_${p.name}>`;
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

function getSchemaRequiredFields(schema) {
  return Array.isArray(schema?.required) ? schema.required.slice(0, 20) : [];
}

function getSchemaProperties(schema) {
  return schema?.properties && typeof schema.properties === "object"
    ? Object.keys(schema.properties).slice(0, 20)
    : [];
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

export function makeSchemaResponseTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const title = `Verify ${method} ${path} response matches the documented schema`;
  const moduleName = buildModuleName(endpoint);
  const successStatus = getSuccessStatus(endpoint);
  const schema = getResponseSchema(endpoint);
  const requiredFields = getSchemaRequiredFields(schema);
  const allProps = getSchemaProperties(schema);

  const expected = [
    `The API responds with HTTP ${successStatus}.`,
    "The response structure matches the documented response schema.",
    "All mandatory fields defined in the schema are present.",
    "Field values follow the documented data types and structure.",
  ];

  if (requiredFields.length > 0) {
    expected.push(
      `Required schema fields are present: ${requiredFields.join(", ")}.`,
    );
  }

  if (allProps.length > 0) {
    expected.push(
      `The documented response properties are structured as expected: ${allProps.join(", ")}.`,
    );
  }

  return {
    id: buildCaseId("SCHEMA_RESPONSE", endpoint, "001"),
    title,
    module: moduleName,
    test_type: "schema",
    priority: "P1",
    objective:
      "Verify that the response body complies with the documented response schema, including mandatory fields and structure.",
    preconditions: [
      "The API base URL is available for the selected environment.",
      "The endpoint is deployed and reachable.",
      "Required authentication or access credentials are available if applicable.",
    ],
    test_data: {
      path_params: buildPathParams(endpoint),
      query_params: buildQueryParams(endpoint),
      headers: buildHeaders(endpoint),
      request_body:
        method === "GET" || method === "DELETE"
          ? null
          : buildRequestBody(endpoint),
    },
    steps: [
      "Open an API client such as Postman or any approved API testing tool.",
      `Select the ${method} method.`,
      `Enter the endpoint URL using the configured base URL and path ${path}.`,
      "Add all required path parameters, query parameters, and headers.",
      ...(method !== "GET" && method !== "DELETE"
        ? ["Add a valid request body if the endpoint requires one."]
        : []),
      "Send the request.",
      "Review the response body and compare it with the documented response schema.",
    ],
    expected_results: expected,
    api_details: {
      method,
      path,
    },
    validation_focus: [
      "Response schema compliance",
      "Mandatory fields",
      "Field data types",
      "Object and array structure",
    ],
    references: [],
    needs_review: false,
    review_notes: "",
  };
}

export function makeSchemaRequestBodyTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";
  const title = `Verify ${method} ${path} accepts a request body that matches the documented schema`;
  const moduleName = buildModuleName(endpoint);

  return {
    id: buildCaseId("SCHEMA_REQUEST_BODY", endpoint, "001"),
    title,
    module: moduleName,
    test_type: "schema",
    priority: "P2",
    objective:
      "Verify that the request body used for the endpoint follows the documented request schema and is accepted by the API.",
    preconditions: [
      "The API base URL is available for the selected environment.",
      "The endpoint is deployed and reachable.",
      "Required authentication or access credentials are available if applicable.",
      "A valid request payload can be prepared according to the documented schema.",
    ],
    test_data: {
      path_params: buildPathParams(endpoint),
      query_params: buildQueryParams(endpoint),
      headers: buildHeaders(endpoint),
      request_body: buildRequestBody(endpoint),
    },
    steps: [
      "Open an API client such as Postman or any approved API testing tool.",
      `Select the ${method} method.`,
      `Enter the endpoint URL using the configured base URL and path ${path}.`,
      "Add all required path parameters, query parameters, and headers.",
      "Prepare the request body according to the documented schema.",
      "Send the request.",
      "Review the response to confirm the API accepts the schema-compliant payload.",
    ],
    expected_results: [
      "The request body structure matches the documented request schema.",
      "Mandatory request fields are included.",
      "The request is accepted by the API when valid schema-compliant data is provided.",
      "No schema-related validation failure occurs for valid input.",
    ],
    api_details: {
      method,
      path,
    },
    validation_focus: [
      "Request body schema compliance",
      "Mandatory request fields",
      "Request field types",
      "Acceptance of valid payload",
    ],
    references: [],
    needs_review: false,
    review_notes: "",
  };
}
