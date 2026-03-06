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

export function makeContractSuccessTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const title = `Verify ${method} ${path} returns a valid success response`;
  const moduleName = buildModuleName(endpoint);
  const successStatus = getSuccessStatus(endpoint);
  const contentType = getContentType(endpoint);
  const topFields = getTopLevelResponseFields(endpoint);

  const expected = [
    `The API responds with HTTP ${successStatus}.`,
    `The response body is returned in ${contentType} format.`,
    "The response structure matches the documented API contract.",
  ];

  if (topFields.length > 0) {
    expected.push(
      `The response contains the expected top-level fields: ${topFields.join(", ")}.`,
    );
  } else {
    expected.push(
      "The response contains the expected top-level fields defined in the API contract.",
    );
  }

  return {
    id: buildCaseId("CONTRACT", endpoint, "001"),
    title,
    module: moduleName,
    test_type: "contract",
    priority: "P1",
    objective:
      "Verify that the endpoint returns a successful response with the expected top-level contract structure.",
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
    ],
    expected_results: expected,
    api_details: {
      method,
      path,
    },
    validation_focus: [
      "HTTP success status",
      "Response content type",
      "Top-level response contract",
      "Presence of expected response fields",
    ],
    references: [],
    needs_review: false,
    review_notes: "",
  };
}

export function makeContractRequiredFieldsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const title = `Verify ${method} ${path} returns all mandatory contract fields`;
  const moduleName = buildModuleName(endpoint);
  const successStatus = getSuccessStatus(endpoint);
  const topFields = getTopLevelResponseFields(endpoint);

  const expected = [
    `The API responds with HTTP ${successStatus}.`,
    "All mandatory response fields defined in the contract are present.",
    "No required field is missing or returned as an unexpected structure.",
  ];

  if (topFields.length > 0) {
    expected.push(
      `The tester can confirm the presence of these documented fields: ${topFields.join(", ")}.`,
    );
  }

  return {
    id: buildCaseId("CONTRACT_REQUIRED_FIELDS", endpoint, "001"),
    title,
    module: moduleName,
    test_type: "contract",
    priority: "P1",
    objective:
      "Verify that the endpoint response includes all mandatory fields defined in the API contract.",
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
      "Review the response body and compare it with the documented contract.",
    ],
    expected_results: expected,
    api_details: {
      method,
      path,
    },
    validation_focus: [
      "Mandatory response fields",
      "Presence of documented keys",
      "Contract completeness",
    ],
    references: [],
    needs_review: false,
    review_notes: "",
  };
}
