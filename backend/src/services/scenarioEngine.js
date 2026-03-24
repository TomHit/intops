function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function normalizeMethod(m) {
  return String(m || "GET").toUpperCase();
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
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
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

function buildBaseHeaders(profile) {
  const headers = {
    Accept: "application/json",
  };

  if (profile?.requiresAuth) {
    headers.Authorization = "Bearer <valid_token>";
  }

  return headers;
}

function buildValidRequest(endpoint, profile) {
  const pathParams = {};
  const queryParams = {};
  const body =
    profile?.requestBodyRequired && profile?.requestBodySchema
      ? buildValidBodyFromSchema(profile.requestBodySchema)
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
    headers: buildBaseHeaders(profile),
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

export function buildScenarioPlans(endpoint, profile, rules = []) {
  const plans = [];

  for (const rule of rules || []) {
    const templateKey = String(rule?.template_key || "").trim();

    switch (templateKey) {
      case "auth.missing_credentials":
        plans.push(
          makePlan({
            scenario_id: "auth.missing_credentials",
            test_type: "auth",
            template_key: templateKey,
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
              source: "profile.requiresAuth",
            },
          }),
        );
        break;

      case "auth.invalid_credentials":
        plans.push(
          makePlan({
            scenario_id: "auth.invalid_credentials",
            test_type: "auth",
            template_key: templateKey,
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
              source: "profile.requiresAuth",
            },
          }),
        );
        break;

      case "negative.missing_required_query": {
        const queryField = pickFirstRequiredQuery(endpoint)?.name || null;
        if (!queryField) break;

        plans.push(
          makePlan({
            scenario_id: "negative.missing_required_query",
            test_type: "negative",
            template_key: templateKey,
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
        break;
      }

      case "negative.missing_required_path": {
        const pathField = pickFirstRequiredPath(endpoint)?.name || null;
        if (!pathField) break;

        plans.push(
          makePlan({
            scenario_id: "negative.missing_required_path",
            test_type: "negative",
            template_key: templateKey,
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
        break;
      }

      case "negative.invalid_enum": {
        const enumField = pickFirstEnumField(profile?.requestBodySchema);
        if (!enumField?.name) break;

        plans.push(
          makePlan({
            scenario_id: "negative.invalid_enum",
            test_type: "negative",
            template_key: templateKey,
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
        break;
      }

      case "negative.null_required_field": {
        const bodyField = pickFirstRequiredBodyField(
          profile?.requestBodySchema,
        );
        if (!bodyField) break;

        plans.push(
          makePlan({
            scenario_id: "negative.null_required_field",
            test_type: "negative",
            template_key: templateKey,
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
        break;
      }

      case "negative.invalid_format": {
        const formatField = pickFirstFormatField(profile?.requestBodySchema);
        if (!formatField?.name) break;

        plans.push(
          makePlan({
            scenario_id: "negative.invalid_format",
            test_type: "negative",
            template_key: templateKey,
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
        break;
      }

      case "negative.string_too_long": {
        const stringField = pickFirstStringMaxLengthField(
          profile?.requestBodySchema,
        );
        if (!stringField?.name) break;

        plans.push(
          makePlan({
            scenario_id: "negative.string_too_long",
            test_type: "negative",
            template_key: templateKey,
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
        break;
      }

      case "negative.numeric_above_maximum": {
        const numericField = pickFirstNumericMaximumField(
          profile?.requestBodySchema,
        );
        if (!numericField?.name) break;

        plans.push(
          makePlan({
            scenario_id: "negative.numeric_above_maximum",
            test_type: "negative",
            template_key: templateKey,
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
        break;
      }

      case "negative.empty_body": {
        if (!profile?.requestBodyRequired) break;

        plans.push(
          makePlan({
            scenario_id: "negative.empty_body",
            test_type: "negative",
            template_key: templateKey,
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
        break;
      }

      default:
        break;
    }
  }

  return uniquePlans(plans);
}

function buildScenarioTitle(endpoint, plan) {
  const path = endpoint?.path || "";

  switch (plan.template_key) {
    case "auth.missing_credentials":
      return `Reject ${path} request when authentication is missing`;

    case "auth.invalid_credentials":
      return `Reject ${path} request when authentication is invalid`;

    case "negative.missing_required_query":
      return `Reject ${path} request when query parameter '${plan.field_target}' is missing`;

    case "negative.missing_required_path":
      return `Reject ${path} request when path parameter '${plan.field_target}' is invalid`;

    case "negative.invalid_enum":
      return `Reject ${path} request when '${plan.field_target}' uses invalid enum`;

    case "negative.null_required_field":
      return `Reject ${path} request when '${plan.field_target}' is null`;

    case "negative.invalid_format":
      return `Reject ${path} request when '${plan.field_target}' has invalid format`;

    case "negative.string_too_long":
      return `Reject ${path} request when '${plan.field_target}' exceeds max length`;

    case "negative.numeric_above_maximum":
      return `Reject ${path} request when '${plan.field_target}' exceeds allowed value`;

    case "negative.empty_body":
      return `Reject ${path} request when body is missing`;

    default:
      return `Validate ${path} negative scenario`;
  }
}
function buildScenarioObjective(plan) {
  return `Ensure API rejects request when '${plan.field_target || "input"}' is invalid, while all other inputs remain valid.`;
}
function buildScenarioSteps(endpoint, plan, req) {
  const steps = [];
  const method = normalizeMethod(endpoint?.method);

  steps.push(`Set HTTP method to ${method}`);
  steps.push(`Use endpoint path '${endpoint?.path}'`);

  if (Object.keys(req?.headers || {}).length > 0) {
    steps.push("Add valid headers (Authorization, Content-Type if required)");
  }

  if (Object.keys(req?.query_params || {}).length > 0) {
    steps.push("Provide valid query parameters");
  }

  if (Object.keys(req?.path_params || {}).length > 0) {
    steps.push("Provide valid path parameters");
  }

  if (req?.request_body && method !== "GET") {
    steps.push("Prepare request body with valid values");
  }

  switch (plan.template_key) {
    case "auth.missing_credentials":
      steps.push("Do not send Authorization header");
      break;

    case "auth.invalid_credentials":
      steps.push("Send invalid Authorization token");
      break;

    case "negative.missing_required_query":
      steps.push(`Remove query parameter '${plan.field_target}'`);
      break;

    case "negative.missing_required_path":
      steps.push(`Set path parameter '${plan.field_target}' to invalid value`);
      break;

    case "negative.invalid_enum":
      steps.push(`Set '${plan.field_target}' to value outside allowed enum`);
      break;

    case "negative.null_required_field":
      steps.push(`Set '${plan.field_target}' to null`);
      break;

    case "negative.invalid_format":
      steps.push(`Set '${plan.field_target}' to invalid format`);
      break;

    case "negative.string_too_long":
      steps.push(
        `Set '${plan.field_target}' to a very long string (beyond maxLength)`,
      );
      break;

    case "negative.numeric_above_maximum":
      steps.push(`Set '${plan.field_target}' to value above allowed maximum`);
      break;

    case "negative.empty_body":
      steps.push("Do not send request body");
      break;
  }

  steps.push("Send the request");

  return steps;
}
function buildScenarioExpectedResults(plan) {
  const statuses = ensureArray(plan?.expected_status_candidates).join(" or ");

  switch (plan.expected_outcome_family) {
    case "auth_failure":
      return [
        "Request is rejected due to authentication failure",
        `Response status should be ${statuses}`,
        "No sensitive data or success response is returned",
      ];

    case "validation_failure":
      return [
        "Request is rejected due to invalid input",
        `Response status should be ${statuses}`,
        `Error response should indicate issue with '${plan.field_target || "input"}'`,
        "Request is not processed successfully",
      ];

    default:
      return ["API responds according to contract"];
  }
}

function applyScenarioInvalidation(req, plan, profile) {
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

    next.request_body = next.request_body || {};

    if (mode === "invalid_enum" && field) {
      next.request_body[field] = "__invalid_enum_value__";
    }

    if (mode === "null" && field) {
      next.request_body[field] = null;
    }

    if (mode === "invalid_format" && field) {
      const fieldSchema = profile?.requestBodySchema?.properties?.[field] || {};
      next.request_body[field] = buildInvalidFormatValue(field, fieldSchema);
    }

    if (mode === "string_too_long" && field) {
      const fieldSchema = profile?.requestBodySchema?.properties?.[field] || {};
      next.request_body[field] = buildTooLongValue(fieldSchema);
    }

    if (mode === "numeric_above_maximum" && field) {
      const fieldSchema = profile?.requestBodySchema?.properties?.[field] || {};
      next.request_body[field] = buildAboveMaximumValue(fieldSchema);
    }

    return next;
  }

  return next;
}

export function buildCaseFromScenarioPlan(endpoint, profile, plan) {
  const validReq = buildValidRequest(endpoint, profile);
  const req = applyScenarioInvalidation(validReq, plan, profile);

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
    priority: "high",
    objective: buildScenarioObjective(plan),
    preconditions: [
      "The API base URL is available for the selected environment.",
      "The endpoint is deployed and reachable.",
    ],
    test_data: req,
    steps: buildScenarioSteps(endpoint, plan, req),
    expected_results: buildScenarioExpectedResults(plan),
    api_details: {
      method,
      path: endpoint?.path || "/",
    },
    validation_focus: [
      plan.expected_outcome_family,
      plan.template_key,
      `invalidate:${plan?.invalidate?.location || "unknown"}`,
    ],
    references: [
      `template_key:${plan.template_key}`,
      `scenario_id:${plan.scenario_id}`,
      "source:scenario_engine",
    ],
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
    plan?.template_key === "auth.missing_credentials" &&
    profile?.requestBodyRequired &&
    !tc?.test_data?.request_body
  ) {
    errors.push(
      "Auth scenario dropped the required request body instead of keeping it valid.",
    );
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
    plan?.template_key === "negative.empty_body" &&
    tc?.test_data?.request_body !== undefined
  ) {
    errors.push("Empty-body scenario still contains a request body.");
  }

  return {
    is_valid: errors.length === 0,
    errors,
  };
}
