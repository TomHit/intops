function deepClone(obj) {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function normalizeMethod(m) {
  return String(m || "GET").toUpperCase();
}

function buildBaseCase(endpoint, title, objective) {
  return {
    id: "",
    title,
    module:
      (Array.isArray(endpoint?.tags) && endpoint.tags[0]) ||
      endpoint?.path?.split("/").filter(Boolean)[0] ||
      "Default API",
    test_type: "negative",
    priority: "high",
    objective,
    preconditions: [
      "The API base URL is available for the selected environment.",
      "The endpoint is deployed and reachable.",
    ],
    test_data: {
      path_params: {},
      query_params: {},
      headers: {
        Accept: "application/json",
      },
      cookies: {},
      request_body: {},
    },
    steps: [
      `Select the ${normalizeMethod(endpoint?.method)} method.`,
      `Enter the endpoint URL using the configured base URL and path ${endpoint?.path || "/"}.`,
      "Prepare the request with the specified negative test data.",
      "Send the request.",
    ],
    expected_results: [
      "The API rejects the invalid request.",
      "A client error response such as 400, 401, 403, or 422 is returned according to the API contract.",
      "The API does not process invalid input as a successful request.",
    ],
    api_details: {
      method: normalizeMethod(endpoint?.method),
      path: endpoint?.path || "/",
    },
    validation_focus: ["Negative validation", "Error handling"],
    references: ["source:deterministic_negative_generator"],
    needs_review: false,
    review_notes: "",
  };
}

function getRequestSchema(endpoint) {
  return (
    endpoint?._resolvedRequestSchema ||
    endpoint?.requestBody?.content?.["application/json"]?.schema ||
    null
  );
}

function getRequiredFields(schema) {
  return ensureArray(schema?.required);
}

function getProperties(schema) {
  return schema?.properties && typeof schema.properties === "object"
    ? schema.properties
    : {};
}

function sampleValidValue(fieldName, fieldSchema = {}) {
  const name = String(fieldName || "").toLowerCase();

  if (
    fieldSchema.enum &&
    Array.isArray(fieldSchema.enum) &&
    fieldSchema.enum.length
  ) {
    return fieldSchema.enum[0];
  }

  if (name.includes("email")) return "user@example.com";
  if (name.includes("password")) return "Secret123!";
  if (name.includes("username")) return "testuser01";
  if (name === "totp" || name.includes("otp") || name.includes("code"))
    return "123456";
  if (name.includes("device_id") || name.includes("dev_id"))
    return "dev_123abc";
  if (name.includes("job_id")) return "job_123abc";
  if (name.includes("label") || name.includes("name")) return "Sample Name";
  if (name.includes("symbol")) return "XAUUSD";
  if (name.includes("side")) return "BUY";

  if (fieldSchema.type === "integer") return 1;
  if (fieldSchema.type === "number") return 1.23;
  if (fieldSchema.type === "boolean") return true;
  if (fieldSchema.type === "array") return [];
  if (fieldSchema.type === "object") return {};

  return "sample_value";
}

function buildValidBody(schema) {
  const props = getProperties(schema);
  const body = {};
  for (const [key, propSchema] of Object.entries(props)) {
    body[key] = sampleValidValue(key, propSchema);
  }
  return body;
}

function buildWrongTypeValue(fieldSchema = {}) {
  if (fieldSchema.type === "integer" || fieldSchema.type === "number")
    return "not_a_number";
  if (fieldSchema.type === "boolean") return "not_a_boolean";
  if (fieldSchema.type === "array") return "not_an_array";
  if (fieldSchema.type === "object") return "not_an_object";
  return 12345;
}

function generateBodyNegativeCases(endpoint, schema) {
  const cases = [];
  const props = getProperties(schema);
  const requiredFields = getRequiredFields(schema);
  const validBody = buildValidBody(schema);

  for (const field of requiredFields) {
    const tc = buildBaseCase(
      endpoint,
      `Verify ${normalizeMethod(endpoint.method)} ${endpoint.path} rejects request when required field '${field}' is missing`,
      `Verify that the endpoint rejects a request body when the required field '${field}' is omitted.`,
    );

    const invalidBody = deepClone(validBody);
    delete invalidBody[field];

    tc.test_data.request_body = invalidBody;
    tc.expected_results = [
      "The API rejects the request.",
      `A validation error is returned because required field '${field}' is missing.`,
      "The API does not process the request successfully.",
    ];
    tc.validation_focus = [
      "Required field validation",
      "Negative validation",
      field,
    ];
    tc.references.push(`negative:missing_required:${field}`);
    cases.push(tc);
  }

  for (const [field, fieldSchema] of Object.entries(props)) {
    const tc = buildBaseCase(
      endpoint,
      `Verify ${normalizeMethod(endpoint.method)} ${endpoint.path} rejects invalid type for field '${field}'`,
      `Verify that the endpoint rejects the request when field '${field}' has an invalid data type.`,
    );

    const invalidBody = deepClone(validBody);
    invalidBody[field] = buildWrongTypeValue(fieldSchema);

    tc.test_data.request_body = invalidBody;
    tc.expected_results = [
      "The API rejects the request.",
      `A validation error is returned because field '${field}' has an invalid type.`,
      "The API does not accept schema-invalid input.",
    ];
    tc.validation_focus = ["Type validation", "Negative validation", field];
    tc.references.push(`negative:wrong_type:${field}`);
    cases.push(tc);

    if (Array.isArray(fieldSchema.enum) && fieldSchema.enum.length > 0) {
      const enumTc = buildBaseCase(
        endpoint,
        `Verify ${normalizeMethod(endpoint.method)} ${endpoint.path} rejects invalid enum value for field '${field}'`,
        `Verify that the endpoint rejects the request when field '${field}' uses a value outside the documented enum.`,
      );

      const invalidEnumBody = deepClone(validBody);
      invalidEnumBody[field] = "__invalid_enum_value__";

      enumTc.test_data.request_body = invalidEnumBody;
      enumTc.expected_results = [
        "The API rejects the request.",
        `A validation error is returned because field '${field}' has an invalid enum value.`,
      ];
      enumTc.validation_focus = [
        "Enum validation",
        "Negative validation",
        field,
      ];
      enumTc.references.push(`negative:invalid_enum:${field}`);
      cases.push(enumTc);
    }
  }

  if (Object.keys(props).length > 0) {
    const tc = buildBaseCase(
      endpoint,
      `Verify ${normalizeMethod(endpoint.method)} ${endpoint.path} rejects unexpected extra request fields`,
      "Verify that the endpoint handles or rejects additional unexpected fields in the request body according to the contract.",
    );

    const invalidBody = deepClone(validBody);
    invalidBody.__unexpected_field__ = "unexpected";

    tc.test_data.request_body = invalidBody;
    tc.expected_results = [
      "The API either rejects the request or safely ignores unsupported unexpected fields according to the documented contract.",
      "No unintended success behavior occurs because of extra request fields.",
    ];
    tc.validation_focus = ["Additional field handling", "Negative validation"];
    tc.references.push("negative:unexpected_field");
    tc.needs_review = true;
    tc.review_notes =
      "Review whether the API contract allows additionalProperties or silently ignores extra fields.";
    cases.push(tc);
  }

  return cases;
}

function generateParamNegativeCases(endpoint) {
  const cases = [];
  const queryParams = ensureArray(endpoint?.params?.query);
  const headerParams = ensureArray(endpoint?.params?.header);
  const pathParams = ensureArray(endpoint?.params?.path);

  for (const p of queryParams.filter((x) => x?.required)) {
    const tc = buildBaseCase(
      endpoint,
      `Verify ${normalizeMethod(endpoint.method)} ${endpoint.path} rejects request when required query parameter '${p.name}' is missing`,
      `Verify that the endpoint rejects the request when required query parameter '${p.name}' is not provided.`,
    );
    tc.expected_results = [
      "The API rejects the request.",
      `A validation error is returned because required query parameter '${p.name}' is missing.`,
    ];
    tc.validation_focus = [
      "Required query validation",
      "Negative validation",
      p.name,
    ];
    tc.references.push(`negative:missing_query:${p.name}`);
    cases.push(tc);
  }

  for (const p of headerParams.filter((x) => x?.required)) {
    const tc = buildBaseCase(
      endpoint,
      `Verify ${normalizeMethod(endpoint.method)} ${endpoint.path} rejects request when required header '${p.name}' is missing`,
      `Verify that the endpoint rejects the request when required header '${p.name}' is not provided.`,
    );
    tc.expected_results = [
      "The API rejects the request.",
      `A validation error or authorization error is returned because required header '${p.name}' is missing.`,
    ];
    tc.validation_focus = [
      "Required header validation",
      "Negative validation",
      p.name,
    ];
    tc.references.push(`negative:missing_header:${p.name}`);
    cases.push(tc);
  }

  for (const p of pathParams.filter((x) => x?.required)) {
    const tc = buildBaseCase(
      endpoint,
      `Verify ${normalizeMethod(endpoint.method)} ${endpoint.path} requires path parameter '${p.name}'`,
      `Verify that the endpoint cannot be called correctly when required path parameter '${p.name}' is missing or malformed.`,
    );
    tc.expected_results = [
      "The API request cannot be processed correctly without the required path parameter.",
      "A client-side or server-side validation error is returned according to the contract.",
    ];
    tc.validation_focus = [
      "Path parameter validation",
      "Negative validation",
      p.name,
    ];
    tc.references.push(`negative:path_param:${p.name}`);
    tc.needs_review = true;
    tc.review_notes =
      "Path parameter omission may need manual execution strategy depending on client/router behavior.";
    cases.push(tc);
  }

  return cases;
}

export function generateNegativeCases(endpoint) {
  const cases = [];
  const method = normalizeMethod(endpoint?.method);

  const requestSchema = getRequestSchema(endpoint);
  if (
    requestSchema &&
    typeof requestSchema === "object" &&
    ["POST", "PUT", "PATCH"].includes(method)
  ) {
    cases.push(...generateBodyNegativeCases(endpoint, requestSchema));
  }

  cases.push(...generateParamNegativeCases(endpoint));

  return cases;
}
