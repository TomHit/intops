function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function normalizeMethod(m) {
  return String(m || "GET").toUpperCase();
}

function getSuccessResponses(endpoint) {
  const responses = endpoint?.responses || {};
  return Object.entries(responses)
    .filter(([code]) => /^2\d\d$/.test(String(code)))
    .sort(([a], [b]) => Number(a) - Number(b));
}

function getSuccessStatusCandidates(endpoint) {
  const codes = getSuccessResponses(endpoint).map(([code]) => String(code));
  return codes.length > 0 ? codes : ["200"];
}

function getResponseSchema(endpoint) {
  for (const [, response] of getSuccessResponses(endpoint)) {
    const content = response?.content || {};
    const preferred =
      content["application/json"] ||
      content["application/*+json"] ||
      Object.values(content).find((v) => v?.schema);

    if (preferred?.schema) return preferred.schema;
  }

  return null;
}

function getTopLevelResponseFields(endpoint) {
  const schema = getResponseSchema(endpoint);
  const props =
    schema?.properties && typeof schema.properties === "object"
      ? Object.keys(schema.properties)
      : [];

  return props.slice(0, 10);
}

function getResponseRequiredFields(endpoint) {
  const schema = getResponseSchema(endpoint);
  return Array.isArray(schema?.required) ? schema.required.slice(0, 10) : [];
}

function hasResponseSchema(endpoint) {
  return !!getResponseSchema(endpoint);
}

function hasRequestSchema(endpoint, profile) {
  return !!getRequestBodySchema(endpoint, profile);
}

function buildContractPlans(endpoint, profile) {
  const plans = [];
  const successStatuses = getSuccessStatusCandidates(endpoint);

  plans.push(
    makePlan({
      scenario_id: "contract.success",
      test_type: "contract",
      template_key: null,
      invalidate: null,
      keep_valid: { all: true },
      expected_outcome_family: "success",
      expected_status_candidates: successStatuses,
      spec_evidence: { source: "responses.2xx" },
    }),
  );

  plans.push(
    makePlan({
      scenario_id: "contract.status_code",
      test_type: "contract",
      template_key: null,
      invalidate: null,
      keep_valid: { all: true },
      expected_outcome_family: "success",
      expected_status_candidates: successStatuses,
      spec_evidence: { source: "responses.status" },
    }),
  );

  plans.push(
    makePlan({
      scenario_id: "contract.content_type",
      test_type: "contract",
      template_key: null,
      invalidate: null,
      keep_valid: { all: true },
      expected_outcome_family: "success",
      expected_status_candidates: successStatuses,
      spec_evidence: { source: "responses.content" },
    }),
  );

  if (getResponseRequiredFields(endpoint).length > 0) {
    plans.push(
      makePlan({
        scenario_id: "contract.required_fields",
        test_type: "contract",
        template_key: null,
        invalidate: null,
        keep_valid: { all: true },
        expected_outcome_family: "success",
        expected_status_candidates: successStatuses,
        spec_evidence: { source: "response.required" },
      }),
    );
  }

  if (hasRequestSchema(endpoint, profile)) {
    plans.push(
      makePlan({
        scenario_id: "contract.request_body",
        test_type: "contract",
        template_key: null,
        invalidate: null,
        keep_valid: { all: true },
        expected_outcome_family: "success",
        expected_status_candidates: successStatuses,
        spec_evidence: { source: "requestBody" },
      }),
    );
  }

  return plans;
}

function buildSchemaPlans(endpoint, profile) {
  const plans = [];
  const responseSchema = getResponseSchema(endpoint);
  const successStatuses = getSuccessStatusCandidates(endpoint);

  if (!responseSchema) return plans;

  plans.push(
    makePlan({
      scenario_id: "schema.response",
      test_type: "schema",
      template_key: null,
      invalidate: null,
      keep_valid: { all: true },
      expected_outcome_family: "success",
      expected_status_candidates: successStatuses,
      spec_evidence: { source: "response.schema" },
    }),
  );

  if (getResponseRequiredFields(endpoint).length > 0) {
    plans.push(
      makePlan({
        scenario_id: "schema.required_fields",
        test_type: "schema",
        template_key: null,
        invalidate: null,
        keep_valid: { all: true },
        expected_outcome_family: "success",
        expected_status_candidates: successStatuses,
        spec_evidence: { source: "response.required" },
      }),
    );
  }

  if (getTopLevelResponseFields(endpoint).length > 0) {
    plans.push(
      makePlan({
        scenario_id: "schema.field_types",
        test_type: "schema",
        template_key: null,
        invalidate: null,
        keep_valid: { all: true },
        expected_outcome_family: "success",
        expected_status_candidates: successStatuses,
        spec_evidence: { source: "response.properties" },
      }),
    );
  }

  return plans;
}

function getSchemaProperties(schema) {
  return schema?.properties && typeof schema.properties === "object"
    ? schema.properties
    : {};
}

function lower(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function clone(value) {
  if (value === undefined) return undefined;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function getResolved(endpoint) {
  return endpoint?._resolvedTestData || null;
}

function getRequestBodySchema(endpoint, profile = {}) {
  if (profile?.requestBodySchema) return profile.requestBodySchema;

  const content = endpoint?.requestBody?.content;
  if (!isObject(content)) return null;

  const preferred =
    content["application/json"] ||
    content["application/*+json"] ||
    Object.values(content).find((v) => v?.schema);

  return preferred?.schema || null;
}

function getRequestBodyRequired(endpoint, profile = {}) {
  if (typeof profile?.requestBodyRequired === "boolean") {
    return profile.requestBodyRequired;
  }
  return !!endpoint?.requestBody?.required;
}

function sampleValidValue(fieldName, fieldSchema = {}) {
  const name = lower(fieldName);

  if (fieldSchema?.example !== undefined) return clone(fieldSchema.example);
  if (fieldSchema?.default !== undefined) return clone(fieldSchema.default);

  if (Array.isArray(fieldSchema?.enum) && fieldSchema.enum.length > 0) {
    return clone(fieldSchema.enum[0]);
  }

  if (name.includes("email")) return "user@example.com";
  if (name.includes("password")) return "Secret123!";
  if (name.includes("username")) return "testuser01";
  if (name === "totp" || name.includes("otp") || name.includes("code")) {
    return "123456";
  }

  if (fieldSchema.type === "integer") return 1;
  if (fieldSchema.type === "number") return 1.23;
  if (fieldSchema.type === "boolean") return true;
  if (fieldSchema.type === "array") return [];
  if (fieldSchema.type === "object") return {};
  if (fieldSchema.type === "string") return "sample_value";

  return "sample_value";
}

function buildValidBodyFromSchema(schema) {
  const props = getSchemaProperties(schema);
  const body = {};

  for (const [key, propSchema] of Object.entries(props)) {
    body[key] = sampleValidValue(key, propSchema);
  }

  return body;
}

function buildBaseHeaders(profile, endpoint) {
  const headers = {
    Accept: "application/json",
  };

  const resolved = getResolved(endpoint);

  if (
    resolved?.valid?.headers &&
    Object.keys(resolved.valid.headers).length > 0
  ) {
    return clone(resolved.valid.headers);
  }

  if (profile?.requiresAuth || resolved?.auth === "required") {
    headers.Authorization = "Bearer <valid_token>";
  }

  if (endpoint?.requestBody) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function buildValidRequest(endpoint, profile) {
  const resolved = getResolved(endpoint);

  if (resolved?.valid) {
    return {
      path_params: clone(resolved.valid.path) || {},
      query_params: clone(resolved.valid.query) || {},
      headers: clone(resolved.valid.headers) || {},
      cookies: clone(resolved.valid.cookies) || {},
      request_body: clone(resolved.valid.body),
    };
  }

  const requestBodySchema = getRequestBodySchema(endpoint, profile);
  const requestBodyRequired = getRequestBodyRequired(endpoint, profile);

  const pathParams = {};
  const queryParams = {};
  const body =
    requestBodyRequired && requestBodySchema
      ? buildValidBodyFromSchema(requestBodySchema)
      : requestBodySchema
        ? buildValidBodyFromSchema(requestBodySchema)
        : null;

  const queryDefs = ensureArray(endpoint?.params?.query);
  const pathDefs = ensureArray(endpoint?.params?.path);

  for (const p of queryDefs) {
    if (p?.required) {
      queryParams[p.name] = sampleValidValue(p.name, p?.schema || {});
    }
  }

  for (const p of pathDefs) {
    pathParams[p.name] = sampleValidValue(p.name, p?.schema || {});
  }

  return {
    path_params: pathParams,
    query_params: queryParams,
    headers: buildBaseHeaders(profile, endpoint),
    cookies: {},
    request_body: body,
  };
}

function pickFirstRequiredQuery(endpoint) {
  return ensureArray(endpoint?.params?.query).find((p) => p?.required) || null;
}

function pickFirstRequiredPath(endpoint) {
  return ensureArray(endpoint?.params?.path).find((p) => p?.required) || null;
}

function pickFirstRequiredBodyField(schema) {
  const required = ensureArray(schema?.required);
  return required.length > 0 ? required[0] : null;
}

function pickFirstEnumField(schema) {
  const props = getSchemaProperties(schema);
  for (const [key, fieldSchema] of Object.entries(props)) {
    if (Array.isArray(fieldSchema?.enum) && fieldSchema.enum.length > 0) {
      return { name: key, schema: fieldSchema };
    }
  }
  return null;
}

function pickFirstFormatField(schema) {
  const props = getSchemaProperties(schema);

  for (const [key, fieldSchema] of Object.entries(props)) {
    const format = lower(fieldSchema?.format);
    const lowerKey = lower(key);

    if (
      format ||
      lowerKey.includes("email") ||
      lowerKey.includes("otp") ||
      lowerKey.includes("code")
    ) {
      return { name: key, schema: fieldSchema };
    }
  }

  return null;
}

function pickFirstStringMaxLengthField(schema) {
  const props = getSchemaProperties(schema);

  for (const [key, fieldSchema] of Object.entries(props)) {
    if (
      lower(fieldSchema?.type) === "string" &&
      typeof fieldSchema?.maxLength === "number"
    ) {
      return { name: key, schema: fieldSchema };
    }
  }

  return null;
}

function pickFirstNumericMaximumField(schema) {
  const props = getSchemaProperties(schema);

  for (const [key, fieldSchema] of Object.entries(props)) {
    if (
      (lower(fieldSchema?.type) === "integer" ||
        lower(fieldSchema?.type) === "number") &&
      typeof fieldSchema?.maximum === "number"
    ) {
      return { name: key, schema: fieldSchema };
    }
  }

  return null;
}

function buildInvalidFormatValue(fieldName, fieldSchema = {}) {
  const name = lower(fieldName);
  const format = lower(fieldSchema?.format);

  if (format === "email" || name.includes("email")) return "not-an-email";
  if (format === "uuid") return "not-a-uuid";
  if (format === "date") return "99-99-9999";
  if (format === "date-time") return "not-a-datetime";
  if (name === "totp" || name.includes("otp") || name.includes("code")) {
    return "12ab";
  }

  return "invalid-format";
}

function buildTooLongValue(fieldSchema = {}) {
  const maxLength =
    typeof fieldSchema?.maxLength === "number" ? fieldSchema.maxLength : 255;
  return "A".repeat(maxLength + 10);
}

function buildAboveMaximumValue(fieldSchema = {}) {
  const maximum =
    typeof fieldSchema?.maximum === "number" ? fieldSchema.maximum : 100;
  return maximum + 1;
}

function uniquePlans(plans = []) {
  const seen = new Set();
  const out = [];

  for (const plan of plans) {
    if (!plan?.scenario_id) continue;
    if (seen.has(plan.scenario_id)) continue;
    seen.add(plan.scenario_id);
    out.push(plan);
  }

  return out;
}

function makePlan({
  scenario_id,
  test_type,
  template_key,
  invalidate,
  keep_valid,
  expected_outcome_family,
  expected_status_candidates,
  field_target = null,
  spec_evidence = null,
}) {
  return {
    scenario_id,
    test_type,
    template_key,
    invalidate,
    keep_valid,
    expected_outcome_family,
    expected_status_candidates,
    field_target,
    spec_evidence,
    build(endpoint, profile) {
      return buildCaseFromScenarioPlan(endpoint, profile, this);
    },
  };
}

function buildAutoPlansFromResolved(endpoint, profile) {
  const resolved = getResolved(endpoint);
  const autoPlans = [];

  if (!resolved) return autoPlans;

  if (resolved?.auth === "required") {
    autoPlans.push(
      makePlan({
        scenario_id: "auth.missing_credentials",
        test_type: "auth",
        template_key: null,
        invalidate: {
          location: "headers",
          field: "Authorization",
          mode: "missing",
        },
        keep_valid: {
          path: true,
          query: true,
          body: true,
          headers_other_than_target: true,
        },
        expected_outcome_family: "auth_failure",
        expected_status_candidates: ["401", "403"],
        spec_evidence: {
          source: "resolved.auth",
        },
      }),
    );

    autoPlans.push(
      makePlan({
        scenario_id: "auth.invalid_credentials",
        test_type: "auth",
        template_key: "auth.invalid_credentials",
        invalidate: {
          location: "headers",
          field: "Authorization",
          mode: "invalid",
        },
        keep_valid: {
          path: true,
          query: true,
          body: true,
          headers_other_than_target: true,
        },
        expected_outcome_family: "auth_failure",
        expected_status_candidates: ["401", "403"],
        spec_evidence: {
          source: "resolved.auth",
        },
      }),
    );
  }

  if (ensureArray(endpoint?.params?.query).some((p) => p?.required)) {
    const queryField = pickFirstRequiredQuery(endpoint)?.name || null;
    if (queryField) {
      autoPlans.push(
        makePlan({
          scenario_id: "negative.missing_required_query",
          test_type: "negative",
          template_key: "negative.missing_required_query",
          invalidate: {
            location: "query",
            field: queryField,
            mode: "missing",
          },
          keep_valid: {
            auth: true,
            path: true,
            body: true,
            query_other_than_target: true,
          },
          expected_outcome_family: "validation_failure",
          expected_status_candidates: ["400", "422"],
          field_target: queryField,
          spec_evidence: {
            source: "endpoint.params.query.required",
          },
        }),
      );
    }
  }

  if (ensureArray(endpoint?.params?.path).some((p) => p?.required)) {
    const pathField = pickFirstRequiredPath(endpoint)?.name || null;
    if (pathField) {
      autoPlans.push(
        makePlan({
          scenario_id: "negative.missing_required_path",
          test_type: "negative",
          template_key: "negative.missing_required_path",
          invalidate: {
            location: "path",
            field: pathField,
            mode: "missing_or_malformed",
          },
          keep_valid: {
            auth: true,
            query: true,
            body: true,
            path_other_than_target: true,
          },
          expected_outcome_family: "validation_failure",
          expected_status_candidates: ["400", "404"],
          field_target: pathField,
          spec_evidence: {
            source: "endpoint.params.path.required",
          },
        }),
      );
    }
  }

  const requestBodySchema = getRequestBodySchema(endpoint, profile);

  if (getRequestBodyRequired(endpoint, profile)) {
    autoPlans.push(
      makePlan({
        scenario_id: "negative.empty_body",
        test_type: "negative",
        template_key: "negative.empty_body",
        invalidate: {
          location: "body",
          field: null,
          mode: "empty_body",
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "415", "422"],
        field_target: null,
        spec_evidence: {
          source: "requestBody.required",
        },
      }),
    );
  }

  const enumField = pickFirstEnumField(requestBodySchema);
  if (enumField?.name) {
    autoPlans.push(
      makePlan({
        scenario_id: "negative.invalid_enum",
        test_type: "negative",
        template_key: null,
        invalidate: {
          location: "body",
          field: enumField.name,
          mode: "invalid_enum",
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
          body_other_than_target: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "422"],
        field_target: enumField.name,
        spec_evidence: {
          source: "requestBody.enum",
        },
      }),
    );
  }

  const bodyField = pickFirstRequiredBodyField(requestBodySchema);
  if (bodyField) {
    autoPlans.push(
      makePlan({
        scenario_id: "negative.null_required_field",
        test_type: "negative",
        template_key: "negative.null_required_field",
        invalidate: {
          location: "body",
          field: bodyField,
          mode: "null",
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
          body_other_than_target: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "422"],
        field_target: bodyField,
        spec_evidence: {
          source: "requestBody.required",
        },
      }),
    );
  }

  const formatField = pickFirstFormatField(requestBodySchema);
  if (formatField?.name) {
    autoPlans.push(
      makePlan({
        scenario_id: "negative.invalid_format",
        test_type: "negative",
        template_key: "negative.invalid_format",
        invalidate: {
          location: "body",
          field: formatField.name,
          mode: "invalid_format",
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
          body_other_than_target: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "422"],
        field_target: formatField.name,
        spec_evidence: {
          source: "requestBody.format",
        },
      }),
    );
  }

  const stringField = pickFirstStringMaxLengthField(requestBodySchema);
  if (stringField?.name) {
    autoPlans.push(
      makePlan({
        scenario_id: "negative.string_too_long",
        test_type: "negative",
        template_key: "negative.string_too_long",
        invalidate: {
          location: "body",
          field: stringField.name,
          mode: "string_too_long",
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
          body_other_than_target: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "422"],
        field_target: stringField.name,
        spec_evidence: {
          source: "requestBody.maxLength",
        },
      }),
    );
  }

  const numericField = pickFirstNumericMaximumField(requestBodySchema);
  if (numericField?.name) {
    autoPlans.push(
      makePlan({
        scenario_id: "negative.numeric_above_maximum",
        test_type: "negative",
        template_key: "negative.numeric_above_maximum",
        invalidate: {
          location: "body",
          field: numericField.name,
          mode: "numeric_above_maximum",
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
          body_other_than_target: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "422"],
        field_target: numericField.name,
        spec_evidence: {
          source: "requestBody.maximum",
        },
      }),
    );
  }

  return autoPlans;
}

export function buildScenarioPlans(endpoint, profile, rules = []) {
  const contractPlans = buildContractPlans(endpoint, profile);
  const schemaPlans = buildSchemaPlans(endpoint, profile);
  const negativeAuthPlans = buildAutoPlansFromResolved(endpoint, profile);

  return uniquePlans([...contractPlans, ...schemaPlans, ...negativeAuthPlans]);
}

function buildScenarioTitle(endpoint, plan) {
  const path = endpoint?.path || "";
  const method = normalizeMethod(endpoint?.method);
  const field = plan.field_target || "field";

  switch (plan.scenario_id) {
    case "auth.missing_credentials":
      return `Reject ${method} ${path} when authentication is missing`;

    case "auth.invalid_credentials":
      return `Reject ${method} ${path} when authentication is invalid`;

    case "auth.expired_credentials":
      return `Reject ${method} ${path} when authentication is expired`;

    case "auth.forbidden_role":
      return `Reject ${method} ${path} when user role is not authorized`;

    case "negative.missing_required_query":
      return `Reject ${method} ${path} when query parameter '${field}' is missing`;

    case "negative.missing_required_path":
      return `Reject ${method} ${path} when path parameter '${field}' is invalid`;

    case "negative.invalid_enum":
      return `Reject ${method} ${path} when '${field}' has an invalid enum value`;

    case "negative.null_required_field":
      return `Reject ${method} ${path} when '${field}' is null`;

    case "negative.invalid_format":
      return `Reject ${method} ${path} when '${field}' has invalid format`;

    case "negative.string_too_long":
      return `Reject ${method} ${path} when '${field}' exceeds maximum length`;

    case "negative.numeric_above_maximum":
      return `Reject ${method} ${path} when '${field}' exceeds allowed value`;

    case "negative.empty_body":
      return `Reject ${method} ${path} when request body is missing`;

    case "contract.success":
      return `Verify successful response for ${method} ${path}`;

    case "contract.status_code":
      return `Verify documented success status for ${method} ${path}`;

    case "contract.content_type":
      return `Verify response content type for ${method} ${path}`;

    case "contract.required_fields":
      return `Verify mandatory response fields for ${method} ${path}`;

    case "contract.request_body":
      return `Verify valid request body is accepted for ${method} ${path}`;

    case "schema.response":
      return `Validate response schema for ${method} ${path}`;

    case "schema.required_fields":
      return `Validate required response fields for ${method} ${path}`;

    case "schema.field_types":
      return `Validate response field types for ${method} ${path}`;

    default:
      return `${method} ${path} - ${plan.test_type || "api"} scenario`;
  }
}

function buildScenarioObjective(endpoint, plan) {
  const method = normalizeMethod(endpoint?.method);
  const path = endpoint?.path || "/";

  switch (plan.scenario_id) {
    case "auth.missing_credentials":
      return `Verify that ${method} ${path} rejects requests when authentication credentials are not provided.`;

    case "auth.invalid_credentials":
      return `Verify that ${method} ${path} rejects requests when authentication credentials are invalid.`;

    case "negative.empty_body":
      return `Verify that ${method} ${path} rejects requests when the required request body is not sent.`;

    case "negative.missing_required_query":
      return `Verify that ${method} ${path} rejects requests when required query parameter '${plan.field_target}' is missing.`;

    case "negative.missing_required_path":
      return `Verify that ${method} ${path} rejects requests when required path parameter '${plan.field_target}' is malformed or empty.`;

    case "negative.invalid_enum":
      return `Verify that ${method} ${path} rejects requests when '${plan.field_target}' contains a value outside the allowed enum.`;

    case "negative.null_required_field":
      return `Verify that ${method} ${path} rejects requests when required field '${plan.field_target}' is null.`;

    case "negative.invalid_format":
      return `Verify that ${method} ${path} rejects requests when '${plan.field_target}' is not in the expected format.`;

    case "negative.string_too_long":
      return `Verify that ${method} ${path} rejects requests when '${plan.field_target}' exceeds the documented max length.`;

    case "negative.numeric_above_maximum":
      return `Verify that ${method} ${path} rejects requests when '${plan.field_target}' exceeds the documented maximum value.`;

    case "contract.success":
      return `Verify that ${method} ${path} returns a successful response for a valid request.`;

    case "contract.status_code":
      return `Verify that ${method} ${path} returns the documented success status code for a valid request.`;

    case "contract.content_type":
      return `Verify that ${method} ${path} returns the documented response content type.`;

    case "contract.required_fields":
      return `Verify that ${method} ${path} returns all mandatory response fields defined in the API contract.`;

    case "contract.request_body":
      return `Verify that ${method} ${path} accepts a valid request body aligned with the documented contract.`;

    case "schema.response":
      return `Verify that ${method} ${path} returns a response body that matches the documented schema.`;

    case "schema.required_fields":
      return `Verify that ${method} ${path} returns all required response fields defined in the schema.`;

    case "schema.field_types":
      return `Verify that ${method} ${path} returns response fields using the documented data types.`;

    default:
      return `Validate ${plan.test_type || "API"} behavior for ${method} ${path}.`;
  }
}

function buildRequestDetailsSteps(req) {
  const steps = [];

  for (const [k, v] of Object.entries(req?.headers || {})) {
    steps.push(`Set header '${k}' = ${JSON.stringify(v)}`);
  }

  for (const [k, v] of Object.entries(req?.query_params || {})) {
    steps.push(`Set query parameter '${k}' = ${JSON.stringify(v)}`);
  }

  for (const [k, v] of Object.entries(req?.path_params || {})) {
    steps.push(`Set path parameter '${k}' = ${JSON.stringify(v)}`);
  }

  if (req?.request_body !== undefined && req?.request_body !== null) {
    steps.push(`Set request body = ${JSON.stringify(req.request_body)}`);
  }

  return steps;
}

function buildScenarioSteps(endpoint, plan, req) {
  const steps = [];
  const method = normalizeMethod(endpoint?.method);
  const path = endpoint?.path || "/";

  steps.push(`Set HTTP method to ${method}`);
  steps.push(`Use endpoint path '${path}'`);
  steps.push(...buildRequestDetailsSteps(req));

  switch (plan.scenario_id) {
    case "contract.success":
    case "contract.status_code":
    case "contract.content_type":
    case "contract.required_fields":
    case "contract.request_body":
    case "schema.response":
    case "schema.required_fields":
    case "schema.field_types":
      steps.push("Prepare a valid request using API specification");
      steps.push("Send the request to the endpoint");
      steps.push("Capture the response for validation");
      break;

    case "auth.missing_credentials":
      steps.push("Remove the Authorization header");
      steps.push("Send the request");
      break;

    case "auth.invalid_credentials":
      steps.push("Replace the Authorization header with an invalid token");
      steps.push("Send the request");
      break;

    case "negative.missing_required_query":
      steps.push(`Remove query parameter '${plan.field_target}'`);
      steps.push("Send the request");
      break;

    case "negative.missing_required_path":
      steps.push(
        `Set path parameter '${plan.field_target}' to an invalid or empty value`,
      );
      steps.push("Send the request");
      break;

    case "negative.invalid_enum":
      steps.push(
        `Set '${plan.field_target}' to a value outside the allowed enum`,
      );
      steps.push("Send the request");
      break;

    case "negative.null_required_field":
      steps.push(`Set '${plan.field_target}' to null`);
      steps.push("Send the request");
      break;

    case "negative.invalid_format":
      steps.push(`Set '${plan.field_target}' to an invalid format`);
      steps.push("Send the request");
      break;

    case "negative.string_too_long":
      steps.push(
        `Set '${plan.field_target}' to a value longer than the allowed maximum length`,
      );
      steps.push("Send the request");
      break;

    case "negative.numeric_above_maximum":
      steps.push(
        `Set '${plan.field_target}' to a value above the allowed maximum`,
      );
      steps.push("Send the request");
      break;

    case "negative.empty_body":
      steps.push(`Send ${method} ${path} without request body`);
      break;

    default:
      steps.push("Send the request");
      break;
  }

  return steps;
}

function buildScenarioExpectedResults(plan, endpoint) {
  const statuses = ensureArray(plan?.expected_status_candidates).join(" or ");

  switch (plan.scenario_id) {
    case "auth.missing_credentials":
      return [
        `Response status should be ${statuses}`,
        "Response should indicate missing authentication credentials",
        "Response should not return protected or success data",
      ];

    case "auth.invalid_credentials":
      return [
        `Response status should be ${statuses}`,
        "Response should indicate invalid or expired authentication credentials",
        "Response should not return protected or success data",
      ];

    case "contract.success": {
      const fields = getTopLevelResponseFields(endpoint);
      return [
        `Response status should be ${statuses}`,
        "Response should follow the documented success contract",
        ...(fields.length > 0
          ? [
              `Response should include top-level fields such as: ${fields.join(", ")}`,
            ]
          : []),
      ];
    }

    case "contract.status_code":
      return [
        `Response status should be ${statuses}`,
        "Returned status code should match the documented success response",
        "No unexpected 4xx or 5xx response should be returned for valid input",
      ];

    case "contract.content_type":
      return [
        `Response status should be ${statuses}`,
        "Response should include the documented Content-Type header",
        "Returned media type should match the API contract",
      ];

    case "contract.required_fields": {
      const requiredFields = getResponseRequiredFields(endpoint);
      return [
        `Response status should be ${statuses}`,
        "All mandatory contract fields should be present in the response",
        ...(requiredFields.length > 0
          ? [`Mandatory response fields include: ${requiredFields.join(", ")}`]
          : []),
      ];
    }

    case "contract.request_body": {
      const requestFields = Object.keys(
        buildValidRequest(endpoint, {}).request_body || {},
      );

      return [
        `Response status should be ${statuses}`,
        "Valid documented request body should be accepted by the API",
        ...(requestFields.length > 0
          ? [`Valid payload fields include: ${requestFields.join(", ")}`]
          : []),
        "No request-body validation error should occur for this valid payload",
      ];
    }

    case "schema.response":
      return [
        `Response status should be ${statuses}`,
        "Response body should conform to the documented response schema",
        "No undocumented top-level structure should violate schema validation",
      ];

    case "schema.required_fields": {
      const requiredFields = getResponseRequiredFields(endpoint);
      return [
        `Response status should be ${statuses}`,
        "All schema-required response fields should be present",
        ...(requiredFields.length > 0
          ? [`Schema-required fields include: ${requiredFields.join(", ")}`]
          : []),
      ];
    }

    case "schema.field_types": {
      const topFields = getTopLevelResponseFields(endpoint);
      return [
        `Response status should be ${statuses}`,
        "Response fields should use the documented data types",
        ...(topFields.length > 0
          ? [`Validate field types for: ${topFields.join(", ")}`]
          : []),
      ];
    }

    case "negative.empty_body":
      return [
        `Response status should be ${statuses}`,
        "Response should indicate missing required request body",
        "Error message should mention required body fields when available",
        "Request should not be processed successfully",
      ];

    case "negative.invalid_enum":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate that '${plan.field_target}' contains an unsupported enum value`,
        "Request should not be processed successfully",
      ];

    case "negative.null_required_field":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate that required field '${plan.field_target}' cannot be null`,
        "Request should not be processed successfully",
      ];

    case "negative.invalid_format":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate invalid format for '${plan.field_target}'`,
        "Request should not be processed successfully",
      ];

    case "negative.string_too_long":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate that '${plan.field_target}' exceeds maximum length`,
        "Request should not be processed successfully",
      ];

    case "negative.numeric_above_maximum":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate that '${plan.field_target}' exceeds maximum value`,
        "Request should not be processed successfully",
      ];

    case "negative.missing_required_query":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate that query parameter '${plan.field_target}' is required`,
        "Request should not be processed successfully",
      ];

    case "negative.missing_required_path":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate that path parameter '${plan.field_target}' is invalid`,
        "Request should not be processed successfully",
      ];

    default:
      return [
        `Response should follow ${plan.test_type || "documented"} behavior`,
      ];
  }
}

function buildScenarioPreconditions(endpoint, plan) {
  const preconditions = [];
  const method = normalizeMethod(endpoint?.method);

  preconditions.push(
    `Target endpoint ${method} ${endpoint?.path || "/"} is available in the selected environment`,
  );

  if (plan.test_type === "auth") {
    preconditions.push(
      "Endpoint is protected and normally requires valid authentication",
    );
  }

  if (plan.test_type === "contract" || plan.test_type === "schema") {
    preconditions.push(
      "A valid request can be constructed from the documented API contract",
    );
  }

  if (
    plan.scenario_id === "negative.empty_body" ||
    plan.scenario_id === "negative.invalid_enum" ||
    plan.scenario_id === "negative.null_required_field" ||
    plan.scenario_id === "negative.invalid_format" ||
    plan.scenario_id === "negative.string_too_long" ||
    plan.scenario_id === "negative.numeric_above_maximum"
  ) {
    preconditions.push("Endpoint accepts JSON request body");
  }

  return preconditions;
}

function buildValidationFocus(plan, endpoint) {
  switch (plan.scenario_id) {
    case "negative.empty_body":
      return [
        "request.body.required_fields",
        "error.response.structure",
        "status_code.validation",
      ];

    case "negative.invalid_enum":
      return [
        "request.body.enum_constraints",
        "error.response.structure",
        "status_code.validation",
      ];

    case "negative.null_required_field":
      return [
        "request.body.required_fields",
        "nullability.validation",
        "status_code.validation",
      ];

    case "negative.invalid_format":
      return [
        "request.body.format_constraints",
        "error.response.structure",
        "status_code.validation",
      ];

    case "negative.string_too_long":
      return [
        "request.body.string_constraints",
        "error.response.structure",
        "status_code.validation",
      ];

    case "negative.numeric_above_maximum":
      return [
        "request.body.numeric_constraints",
        "error.response.structure",
        "status_code.validation",
      ];

    case "negative.missing_required_query":
      return [
        "request.query.required_parameters",
        "error.response.structure",
        "status_code.validation",
      ];

    case "negative.missing_required_path":
      return [
        "request.path.parameter_validation",
        "routing_or_validation_failure",
        "status_code.validation",
      ];

    case "auth.missing_credentials":
    case "auth.invalid_credentials":
      return [
        "authentication.enforcement",
        "error.response.structure",
        "status_code.authorization",
      ];

    case "contract.success":
      return [
        "http.success_status",
        "response.contract_structure",
        "response.content_type",
      ];

    case "contract.status_code":
      return ["http.success_status", "documented_status_code_compliance"];

    case "contract.content_type":
      return ["response.content_type", "documented_media_type_compliance"];

    case "contract.required_fields":
      return [
        "response.required_fields",
        "documented_contract_keys",
        "contract_completeness",
      ];

    case "contract.request_body":
      return [
        "request.body.contract",
        "valid_request_payload",
        "request_acceptance",
      ];

    case "schema.response":
      return [
        "response.schema_validation",
        "response.top_level_structure",
        "documented_schema_compliance",
      ];

    case "schema.required_fields":
      return [
        "schema.required_fields",
        "response.key_presence",
        "schema_completeness",
      ];

    case "schema.field_types":
      return [
        "schema.field_types",
        "response.property_types",
        "documented_type_compliance",
      ];

    default:
      return [`${plan.test_type || "general"}.validation`];
  }
}

function buildScenarioReferences(plan) {
  return [`scenario_id:${plan.scenario_id}`, "source:scenario_engine"];
}

function applyScenarioInvalidation(req, plan, profile, endpoint) {
  const next = clone(req) || {
    path_params: {},
    query_params: {},
    headers: {},
    cookies: {},
    request_body: null,
  };

  const invalidate = plan?.invalidate || {};
  const location = invalidate.location;
  const field = invalidate.field;
  const mode = invalidate.mode;
  const requestBodySchema = getRequestBodySchema(endpoint, profile);

  if (location === "headers") {
    next.headers = next.headers || {};

    if (mode === "missing") {
      delete next.headers[field];
      delete next.headers[String(field || "").toLowerCase()];
      delete next.headers.Authorization;
      delete next.headers.authorization;
      delete next.headers["X-API-Key"];
      delete next.headers["x-api-key"];
      delete next.headers.Cookie;
      delete next.headers.cookie;
    } else if (mode === "invalid") {
      next.headers[field || "Authorization"] = "Bearer invalid-token";
    }

    return next;
  }

  if (location === "query") {
    next.query_params = next.query_params || {};

    if (mode === "missing" && field) {
      delete next.query_params[field];
    }

    return next;
  }

  if (location === "path") {
    next.path_params = next.path_params || {};

    if (mode === "missing_or_malformed" && field) {
      next.path_params[field] = "";
    }

    return next;
  }

  if (location === "body") {
    if (mode === "empty_body") {
      next.request_body = undefined;
      return next;
    }

    next.request_body = isObject(next.request_body) ? next.request_body : {};

    if (mode === "invalid_enum" && field) {
      next.request_body[field] = "__invalid_enum_value__";
    }

    if (mode === "null" && field) {
      next.request_body[field] = null;
    }

    if (mode === "invalid_format" && field) {
      const fieldSchema = requestBodySchema?.properties?.[field] || {};
      next.request_body[field] = buildInvalidFormatValue(field, fieldSchema);
    }

    if (mode === "string_too_long" && field) {
      const fieldSchema = requestBodySchema?.properties?.[field] || {};
      next.request_body[field] = buildTooLongValue(fieldSchema);
    }

    if (mode === "numeric_above_maximum" && field) {
      const fieldSchema = requestBodySchema?.properties?.[field] || {};
      next.request_body[field] = buildAboveMaximumValue(fieldSchema);
    }

    return next;
  }

  return next;
}

export function buildCaseFromScenarioPlan(endpoint, profile, plan) {
  const validReq = buildValidRequest(endpoint, profile);
  const req = applyScenarioInvalidation(validReq, plan, profile, endpoint);

  const method = normalizeMethod(endpoint?.method);

  if (method === "GET") {
    delete req.request_body;
  }

  return {
    id: "",
    title: buildScenarioTitle(endpoint, plan),
    module:
      (Array.isArray(endpoint?.tags) && endpoint.tags[0]) ||
      String(endpoint?.path || "")
        .split("/")
        .filter(Boolean)[0] ||
      "Default API",
    test_type: plan.test_type,
    priority:
      plan.test_type === "auth" || plan.test_type === "negative"
        ? "P1"
        : plan.scenario_id === "contract.success" ||
            plan.scenario_id === "schema.response"
          ? "P1"
          : "P2",
    objective: buildScenarioObjective(endpoint, plan),
    preconditions: buildScenarioPreconditions(endpoint, plan),
    test_data: req,
    steps: buildScenarioSteps(endpoint, plan, req),
    expected_results: buildScenarioExpectedResults(plan, endpoint),
    api_details: {
      method,
      path: endpoint?.path || "/",
    },
    validation_focus: buildValidationFocus(plan, endpoint),
    references: buildScenarioReferences(plan),
    needs_review: false,
    review_notes: "",
    meta: {
      scenario_id: plan.scenario_id,
      template_key: plan.template_key,
      invalidate: plan.invalidate,
      keep_valid: plan.keep_valid,
      expected_outcome_family: plan.expected_outcome_family,
      expected_status_candidates: plan.expected_status_candidates,
      spec_evidence: plan.spec_evidence,
    },
  };
}

export function validateScenarioCase(tc, profile, plan) {
  const errors = [];

  const expectedJoined = ensureArray(tc?.expected_results)
    .join(" ")
    .toLowerCase();

  const stepsJoined = ensureArray(tc?.steps).join(" ").toLowerCase();

  if (
    (plan?.expected_outcome_family === "auth_failure" ||
      tc?.test_type === "auth") &&
    /success|successful|2\d\d/.test(expectedJoined)
  ) {
    errors.push("Auth scenario contains success expectation.");
  }

  if (
    (plan?.expected_outcome_family === "validation_failure" ||
      tc?.test_type === "negative") &&
    /success|successful|2\d\d/.test(expectedJoined)
  ) {
    errors.push("Negative scenario contains success expectation.");
  }

  if (
    plan?.invalidate?.location === "query" &&
    plan?.field_target &&
    tc?.test_data?.query_params &&
    Object.prototype.hasOwnProperty.call(
      tc.test_data.query_params,
      plan.field_target,
    )
  ) {
    errors.push(
      "Query-missing scenario still contains the targeted query parameter.",
    );
  }

  if (
    plan?.invalidate?.location === "headers" &&
    plan?.invalidate?.mode === "missing" &&
    (tc?.test_data?.headers?.Authorization ||
      tc?.test_data?.headers?.authorization)
  ) {
    errors.push(
      "Missing-credentials scenario still contains Authorization header.",
    );
  }

  if (
    plan?.invalidate?.location === "body" &&
    plan?.field_target &&
    !stepsJoined.includes(String(plan?.field_target || "").toLowerCase())
  ) {
    errors.push(
      "Scenario steps do not mention the targeted invalid body field.",
    );
  }

  if (
    plan?.scenario_id === "negative.empty_body" &&
    tc?.test_data?.request_body !== undefined
  ) {
    errors.push("Empty-body scenario still contains a request body.");
  }

  if (
    plan?.scenario_id === "auth.missing_credentials" &&
    (tc?.references || []).includes(`template_key:${plan.template_key}`)
  ) {
    errors.push(
      "Scenario case still exposes template provenance in references.",
    );
  }

  return {
    is_valid: errors.length === 0,
    errors,
  };
}
