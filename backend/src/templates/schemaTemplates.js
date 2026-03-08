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

function getRequestSchema(endpoint) {
  return (
    endpoint?.requestBody?.content?.["application/json"]?.schema ||
    endpoint?.requestBody?.content?.["application/*+json"]?.schema ||
    null
  );
}

function getSchemaRequiredFields(schema) {
  return Array.isArray(schema?.required) ? schema.required.slice(0, 20) : [];
}

function getSchemaProperties(schema) {
  return schema?.properties && typeof schema.properties === "object"
    ? Object.keys(schema.properties).slice(0, 20)
    : [];
}

function getSchemaEnumFields(schema) {
  const props = schema?.properties || {};
  return Object.entries(props)
    .filter(([, val]) => Array.isArray(val?.enum) && val.enum.length > 0)
    .map(([key]) => key)
    .slice(0, 10);
}

function getSchemaNestedObjectFields(schema) {
  const props = schema?.properties || {};
  return Object.entries(props)
    .filter(([, val]) => val?.type === "object" || !!val?.properties)
    .map(([key]) => key)
    .slice(0, 10);
}

function getSchemaArrayFields(schema) {
  const props = schema?.properties || {};
  return Object.entries(props)
    .filter(([, val]) => val?.type === "array" || !!val?.items)
    .map(([key]) => key)
    .slice(0, 10);
}

function getSchemaFormatFields(schema) {
  const props = schema?.properties || {};
  return Object.entries(props)
    .filter(([, val]) => typeof val?.format === "string")
    .map(([key, val]) => `${key}(${val.format})`)
    .slice(0, 10);
}

function getSchemaNumericConstraintFields(schema) {
  const props = schema?.properties || {};
  return Object.entries(props)
    .filter(
      ([, val]) => val?.minimum !== undefined || val?.maximum !== undefined,
    )
    .map(([key]) => key)
    .slice(0, 10);
}

function getSchemaStringConstraintFields(schema) {
  const props = schema?.properties || {};
  return Object.entries(props)
    .filter(
      ([, val]) => val?.minLength !== undefined || val?.maxLength !== undefined,
    )
    .map(([key]) => key)
    .slice(0, 10);
}

function getSchemaPatternFields(schema) {
  const props = schema?.properties || {};
  return Object.entries(props)
    .filter(([, val]) => typeof val?.pattern === "string")
    .map(([key]) => key)
    .slice(0, 10);
}

function hasSchemaComposition(schema) {
  return !!(schema?.oneOf || schema?.anyOf || schema?.allOf);
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
    test_type: "schema",
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

export function makeSchemaResponseTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const successStatus = getSuccessStatus(endpoint);
  const schema = getResponseSchema(endpoint);
  const requiredFields = getSchemaRequiredFields(schema);
  const allProps = getSchemaProperties(schema);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} response matches the documented schema`,
    objective:
      "Verify that the response body complies with the documented response schema, including mandatory fields and structure.",
    priority: "P1",
  });

  tc.steps.push(
    "Review the response body and compare it with the documented response schema.",
  );

  tc.expected_results = [
    `The API responds with HTTP ${successStatus}.`,
    "The response structure matches the documented response schema.",
    "All mandatory fields defined in the schema are present.",
    "Field values follow the documented data types and structure.",
    ...(requiredFields.length > 0
      ? [`Required schema fields are present: ${requiredFields.join(", ")}.`]
      : []),
    ...(allProps.length > 0
      ? [
          `The documented response properties are structured as expected: ${allProps.join(", ")}.`,
        ]
      : []),
  ];

  tc.validation_focus = [
    "Response schema compliance",
    "Mandatory fields",
    "Field data types",
    "Object and array structure",
  ];

  return tc;
}

export function makeSchemaRequiredFieldsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const successStatus = getSuccessStatus(endpoint);
  const schema = getResponseSchema(endpoint);
  const requiredFields = getSchemaRequiredFields(schema);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} includes all required schema fields`,
    objective:
      "Verify that all required fields defined in the response schema are present in the API response.",
    priority: "P1",
  });

  tc.steps.push(
    "Review the response body and verify that all required schema fields are present.",
  );

  tc.expected_results = [
    `The API responds with HTTP ${successStatus}.`,
    "All required schema fields are present in the response.",
    ...(requiredFields.length > 0
      ? [
          `Required fields expected in the response include: ${requiredFields.join(", ")}.`,
        ]
      : ["Required fields are present according to the documented schema."]),
    "No mandatory field is missing from the response body.",
  ];

  tc.validation_focus = ["Required schema fields", "Response completeness"];

  return tc;
}

export function makeSchemaFieldTypesTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const successStatus = getSuccessStatus(endpoint);
  const schema = getResponseSchema(endpoint);
  const props = getSchemaProperties(schema);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} response field types match the schema`,
    objective:
      "Verify that response fields follow the data types documented in the response schema.",
    priority: "P1",
  });

  tc.steps.push(
    "Inspect the response body and compare field data types with the documented schema.",
  );

  tc.expected_results = [
    `The API responds with HTTP ${successStatus}.`,
    "Response fields match the documented primitive and structured data types.",
    ...(props.length > 0
      ? [
          `The tester should validate field types for documented properties such as: ${props.join(", ")}.`,
        ]
      : []),
    "No field is returned with an unexpected type.",
  ];

  tc.validation_focus = ["Field data types", "Response type consistency"];

  return tc;
}

export function makeSchemaEnumTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const schema = getResponseSchema(endpoint);
  const enumFields = getSchemaEnumFields(schema);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} returns only documented enum values`,
    objective:
      "Verify that enum fields in the response contain only documented allowed values.",
    priority: "P1",
  });

  tc.steps.push(
    "Review response fields that are defined as enums and compare them with the documented allowed values.",
  );

  tc.expected_results = [
    "All enum-based response fields contain only documented values.",
    ...(enumFields.length > 0
      ? [`Enum-constrained fields include: ${enumFields.join(", ")}.`]
      : ["Enum-constrained fields follow the documented allowed values."]),
    "No undocumented enum value is returned by the API.",
  ];

  tc.validation_focus = ["Enum validation", "Allowed value enforcement"];

  return tc;
}

export function makeSchemaNestedObjectsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const schema = getResponseSchema(endpoint);
  const nestedFields = getSchemaNestedObjectFields(schema);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} nested objects follow the documented schema`,
    objective:
      "Verify that nested objects in the response body follow the documented schema structure.",
    priority: "P1",
  });

  tc.steps.push(
    "Inspect nested response objects and compare their structure with the documented schema.",
  );

  tc.expected_results = [
    "Nested objects follow the documented structure.",
    ...(nestedFields.length > 0
      ? [`Nested object fields include: ${nestedFields.join(", ")}.`]
      : ["Nested objects are returned in the documented structure."]),
    "No nested object contains an unexpected schema structure.",
  ];

  tc.validation_focus = [
    "Nested object structure",
    "Response schema depth validation",
  ];

  return tc;
}

export function makeSchemaArrayTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const schema = getResponseSchema(endpoint);
  const arrayFields = getSchemaArrayFields(schema);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} array items follow the documented schema`,
    objective:
      "Verify that array fields in the response follow the documented item structure.",
    priority: "P1",
  });

  tc.steps.push(
    "Inspect response array fields and validate item structure against the documented schema.",
  );

  tc.expected_results = [
    "Array fields are returned in the documented structure.",
    "Array elements follow the documented item schema.",
    ...(arrayFields.length > 0
      ? [`Array-based fields include: ${arrayFields.join(", ")}.`]
      : []),
  ];

  tc.validation_focus = ["Array structure", "Array item schema validation"];

  return tc;
}

export function makeSchemaFormatTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const schema = getResponseSchema(endpoint);
  const formatFields = getSchemaFormatFields(schema);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} formatted fields follow the documented schema format`,
    objective:
      "Verify that formatted string fields such as date-time, email, UUID, or URI follow the documented schema format.",
    priority: "P1",
  });

  tc.steps.push(
    "Inspect formatted string fields in the response and compare them with the documented schema format.",
  );

  tc.expected_results = [
    "Formatted string fields follow the documented format constraints.",
    ...(formatFields.length > 0
      ? [`Fields with documented formats include: ${formatFields.join(", ")}.`]
      : ["Formatted fields match the documented schema format."]),
    "No field violates the documented formatting rules.",
  ];

  tc.validation_focus = [
    "String format validation",
    "Format-specific field compliance",
  ];

  return tc;
}

export function makeSchemaNumericConstraintsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const schema = getResponseSchema(endpoint);
  const fields = getSchemaNumericConstraintFields(schema);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} numeric fields respect schema constraints`,
    objective:
      "Verify that numeric response fields respect documented minimum and maximum constraints.",
    priority: "P1",
  });

  tc.steps.push(
    "Inspect numeric fields in the response and compare them with the documented numeric constraints.",
  );

  tc.expected_results = [
    "Numeric response fields are within documented schema bounds.",
    ...(fields.length > 0
      ? [`Numeric constrained fields include: ${fields.join(", ")}.`]
      : ["Numeric fields follow documented minimum and maximum constraints."]),
    "No numeric field violates the documented range rules.",
  ];

  tc.validation_focus = ["Numeric constraint validation", "Range compliance"];

  return tc;
}

export function makeSchemaStringConstraintsTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const schema = getResponseSchema(endpoint);
  const fields = getSchemaStringConstraintFields(schema);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} string fields respect schema length constraints`,
    objective:
      "Verify that string response fields respect documented minimum and maximum length constraints.",
    priority: "P1",
  });

  tc.steps.push(
    "Inspect string fields in the response and compare them with the documented string length constraints.",
  );

  tc.expected_results = [
    "String fields respect documented length constraints.",
    ...(fields.length > 0
      ? [`String constrained fields include: ${fields.join(", ")}.`]
      : ["String fields follow documented minimum and maximum length rules."]),
    "No string field violates the documented length constraints.",
  ];

  tc.validation_focus = [
    "String length validation",
    "Length constraint compliance",
  ];

  return tc;
}

export function makeSchemaPatternTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const schema = getResponseSchema(endpoint);
  const fields = getSchemaPatternFields(schema);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} pattern-constrained fields follow the schema`,
    objective:
      "Verify that pattern-constrained response fields follow the documented regex or pattern rules.",
    priority: "P2",
  });

  tc.steps.push(
    "Inspect pattern-constrained response fields and compare them with the documented pattern requirements.",
  );

  tc.expected_results = [
    "Pattern-constrained fields follow the documented pattern rules.",
    ...(fields.length > 0
      ? [`Pattern-constrained fields include: ${fields.join(", ")}.`]
      : ["Pattern-constrained fields follow the documented schema behavior."]),
    "No field violates the documented pattern constraints.",
  ];

  tc.validation_focus = ["Pattern validation", "Regex constraint compliance"];

  return tc;
}

export function makeSchemaCompositionTemplate(endpoint) {
  const method = String(endpoint?.method || "GET").toUpperCase();
  const path = endpoint?.path || "/";
  const responseSchema = getResponseSchema(endpoint);
  const requestSchema = getRequestSchema(endpoint);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} composed schema rules are respected`,
    objective:
      "Verify that composed schema definitions such as oneOf, anyOf, or allOf are respected by the API structure.",
    priority: "P1",
  });

  tc.steps.push(
    "Review composed schema definitions and validate the API structure against them.",
  );

  tc.expected_results = [
    "The API response or request structure follows documented composed schema rules.",
    ...(hasSchemaComposition(responseSchema) ||
    hasSchemaComposition(requestSchema)
      ? [
          "Composed schema definitions such as oneOf, anyOf, or allOf are applied correctly.",
        ]
      : ["Schema composition behavior follows the documented contract."]),
    "No schema composition rule is violated.",
  ];

  tc.validation_focus = [
    "Schema composition validation",
    "oneOf/anyOf/allOf compliance",
  ];

  tc.needs_review = true;
  tc.review_notes =
    "Review the exact branch selection and composition logic for this endpoint.";

  return tc;
}

export function makeSchemaRequestBodyTemplate(endpoint) {
  const method = String(endpoint?.method || "POST").toUpperCase();
  const path = endpoint?.path || "/";
  const requestSchema = getRequestSchema(endpoint);
  const requiredFields = getSchemaRequiredFields(requestSchema);
  const props = getSchemaProperties(requestSchema);

  const tc = baseCase(endpoint, {
    title: `Verify ${method} ${path} accepts a request body that matches the documented schema`,
    objective:
      "Verify that the request body used for the endpoint follows the documented request schema and is accepted by the API.",
    priority: "P1",
  });

  tc.steps.push(
    "Prepare the request body according to the documented schema.",
    "Review the response to confirm the API accepts the schema-compliant payload.",
  );

  tc.expected_results = [
    "The request body structure matches the documented request schema.",
    "Mandatory request fields are included.",
    ...(requiredFields.length > 0
      ? [`Required request fields include: ${requiredFields.join(", ")}.`]
      : []),
    ...(props.length > 0
      ? [`Documented request fields include: ${props.join(", ")}.`]
      : []),
    "The request is accepted by the API when valid schema-compliant data is provided.",
    "No schema-related validation failure occurs for valid input.",
  ];

  tc.validation_focus = [
    "Request body schema compliance",
    "Mandatory request fields",
    "Request field types",
    "Acceptance of valid payload",
  ];

  return tc;
}
