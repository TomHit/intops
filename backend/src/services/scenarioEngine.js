function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function normalizeMethod(m) {
  return String(m || "GET").toUpperCase();
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

function scenarioFamily(planOrId) {
  const id =
    typeof planOrId === "string"
      ? planOrId
      : String(planOrId?.scenario_id || "");
  return id.split(":")[0];
}

function scenarioSuffix(planOrId) {
  const id =
    typeof planOrId === "string"
      ? planOrId
      : String(planOrId?.scenario_id || "");
  const idx = id.indexOf(":");
  return idx >= 0 ? id.slice(idx + 1) : "";
}

function isScenario(planOrId, family) {
  return scenarioFamily(planOrId) === family;
}

function getResolved(endpoint) {
  return endpoint?._resolvedTestData || null;
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

function extractSchemaFromContent(content = {}) {
  if (!content || typeof content !== "object") return null;

  if (content["application/json"]?.schema) {
    return content["application/json"].schema;
  }

  for (const ct of Object.keys(content)) {
    if (ct.toLowerCase().includes("json") && content[ct]?.schema) {
      return content[ct].schema;
    }
  }

  for (const ct of Object.keys(content)) {
    if (content[ct]?.schema) {
      return content[ct].schema;
    }
  }

  return null;
}

function normalizeResponseSchema(schema) {
  if (!schema || typeof schema !== "object") return null;

  if (schema.$ref) return schema;
  if (schema.properties) return schema;
  if (Array.isArray(schema.required)) return schema;

  if (schema.type === "array" && schema.items) {
    return schema.items;
  }

  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return schema.allOf[0];
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return schema.oneOf[0];
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return schema.anyOf[0];
  }

  return schema;
}

function getResponseSchema(endpoint) {
  const content = endpoint?.response?.content || {};

  if (content["application/json"]?.schema) {
    return content["application/json"].schema;
  }

  for (const [ct, media] of Object.entries(content)) {
    if (String(ct).toLowerCase().includes("json") && media?.schema) {
      return media.schema;
    }
  }

  for (const media of Object.values(content)) {
    if (media?.schema) {
      return media.schema;
    }
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

function flattenSchemaFields(
  schema,
  prefix = "",
  depth = 0,
  limit = 20,
  out = [],
) {
  if (!isObject(schema) || depth > 3 || out.length >= limit) return out;

  const normalized = normalizeResponseSchema(schema) || schema;
  const props = getSchemaProperties(normalized);

  for (const [key, fieldSchema] of Object.entries(props)) {
    if (out.length >= limit) break;

    const path = prefix ? `${prefix}.${key}` : key;
    const type = lower(fieldSchema?.type) || "unknown";

    out.push({
      path,
      type,
      format: fieldSchema?.format || null,
      required: ensureArray(normalized?.required).includes(key),
      isArray: type === "array",
      isObject: type === "object" || isObject(fieldSchema?.properties),
    });

    if (type === "object" || isObject(fieldSchema?.properties)) {
      flattenSchemaFields(fieldSchema, path, depth + 1, limit, out);
    } else if (type === "array" && isObject(fieldSchema?.items)) {
      const itemType = lower(fieldSchema.items?.type) || "unknown";
      out.push({
        path: `${path}[]`,
        type: itemType,
        format: fieldSchema.items?.format || null,
        required: false,
        isArray: true,
        isObject:
          itemType === "object" || isObject(fieldSchema.items?.properties),
      });

      if (itemType === "object" || isObject(fieldSchema.items?.properties)) {
        flattenSchemaFields(
          fieldSchema.items,
          `${path}[]`,
          depth + 1,
          limit,
          out,
        );
      }
    }
  }

  return out;
}

function getResponseSchemaSummary(endpoint) {
  const schema = getResponseSchema(endpoint);
  const normalized = normalizeResponseSchema(schema);
  const flat = flattenSchemaFields(normalized);

  return {
    top_level_fields: flat
      .filter((f) => !f.path.includes(".") && !f.path.includes("[]"))
      .map((f) => f.path)
      .slice(0, 8),
    nested_fields: flat
      .filter((f) => f.path.includes("."))
      .map((f) => f.path)
      .slice(0, 8),
    array_fields: flat
      .filter((f) => f.isArray)
      .map((f) => f.path)
      .slice(0, 8),
    typed_fields: flat
      .map((f) => `${f.path}:${f.type}${f.format ? `(${f.format})` : ""}`)
      .slice(0, 12),
  };
}

function getRequestSchemaSummary(endpoint, profile = {}) {
  const schema = getRequestBodySchema(endpoint, profile);
  const normalized = normalizeResponseSchema(schema);
  const flat = flattenSchemaFields(normalized);

  return {
    top_level_fields: flat
      .filter((f) => !f.path.includes(".") && !f.path.includes("[]"))
      .map((f) => f.path)
      .slice(0, 8),
    nested_fields: flat
      .filter((f) => f.path.includes("."))
      .map((f) => f.path)
      .slice(0, 8),
    array_fields: flat
      .filter((f) => f.isArray)
      .map((f) => f.path)
      .slice(0, 8),
    typed_fields: flat
      .map((f) => `${f.path}:${f.type}${f.format ? `(${f.format})` : ""}`)
      .slice(0, 12),
  };
}

function getSchemaProperties(schema) {
  return schema?.properties && typeof schema.properties === "object"
    ? schema.properties
    : {};
}

function getRequestBodyContent(endpoint) {
  return endpoint?.requestBody?.content &&
    isObject(endpoint.requestBody.content)
    ? endpoint.requestBody.content
    : {};
}

function getSupportedContentTypes(endpoint) {
  return Object.keys(getRequestBodyContent(endpoint));
}

function getPrimaryRequestContentType(endpoint) {
  const content = getRequestBodyContent(endpoint);
  return (
    Object.keys(content).find((ct) => lower(ct).includes("json")) ||
    Object.keys(content)[0] ||
    ""
  );
}

function getRequestBodySchema(endpoint, profile = {}) {
  if (profile?.requestBodySchema) return profile.requestBodySchema;

  const content = getRequestBodyContent(endpoint);
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

function hasRequestSchema(endpoint, profile) {
  return !!getRequestBodySchema(endpoint, profile);
}

function sampleValidValue(fieldName, fieldSchema = {}) {
  const name = lower(fieldName);

  if (fieldSchema?.example !== undefined) return clone(fieldSchema.example);
  if (fieldSchema?.default !== undefined) return clone(fieldSchema.default);

  if (Array.isArray(fieldSchema?.enum) && fieldSchema.enum.length > 0) {
    return clone(fieldSchema.enum[0]);
  }

  if (fieldSchema.type === "integer") return 1;
  if (fieldSchema.type === "number") return 1.23;
  if (fieldSchema.type === "boolean") return true;

  if (fieldSchema.type === "array") {
    if (fieldSchema.items) {
      return [sampleValidValue(`${fieldName}_item`, fieldSchema.items)];
    }
    return ["<item>"];
  }

  if (fieldSchema.type === "object") {
    return buildValidBodyFromSchema(fieldSchema, "full");
  }

  if (fieldSchema.type === "string") {
    if (fieldSchema.format === "date") return "<date_string>";
    if (fieldSchema.format === "date-time") return "<datetime_string>";
    if (fieldSchema.format === "uuid") return "<uuid_string>";
    if (fieldSchema.format === "email") return "<email_string>";
    if (fieldSchema.format === "uri" || fieldSchema.format === "url") {
      return "<url_string>";
    }
    return `<${name || "string"}>`;
  }

  return `<${name || "value"}>`;
}
function buildValidBodyFromSchema(
  schema,
  mode = "full",
  depth = 0,
  seen = new WeakSet(),
) {
  if (!isObject(schema)) return {};
  if (depth > 4) return {};
  if (seen.has(schema)) return {};
  seen.add(schema);

  const props = getSchemaProperties(schema);
  const required = ensureArray(schema?.required);
  const body = {};

  let entries = Object.entries(props);

  // keep full payload realistic but bounded
  if (mode === "full" && entries.length > 8) {
    entries = entries.slice(0, 8);
  }

  for (const [key, propSchema] of entries) {
    if (mode === "minimal" && !required.includes(key)) continue;
    body[key] = buildSchemaSampleValue(key, propSchema, mode, depth + 1, seen);
  }

  return body;
}

function buildSchemaSampleValue(
  fieldName,
  fieldSchema = {},
  mode = "full",
  depth = 0,
  seen = new WeakSet(),
) {
  const name = lower(fieldName);

  if (!isObject(fieldSchema)) return `<${name || "value"}>`;
  if (depth > 4) return `<${name || "value"}>`;
  if (seen.has(fieldSchema)) return `<${name || "value"}>`;

  if (fieldSchema.example !== undefined) return clone(fieldSchema.example);
  if (fieldSchema.default !== undefined) return clone(fieldSchema.default);

  if (Array.isArray(fieldSchema.enum) && fieldSchema.enum.length > 0) {
    return clone(fieldSchema.enum[0]);
  }

  if (fieldSchema.$ref) {
    return `<${name || "value"}>`;
  }

  if (fieldSchema.type === "object" || isObject(fieldSchema.properties)) {
    return buildValidBodyFromSchema(fieldSchema, mode, depth + 1, seen);
  }

  if (fieldSchema.type === "array") {
    const itemSchema = isObject(fieldSchema.items) ? fieldSchema.items : {};
    return [
      buildSchemaSampleValue(
        `${fieldName}_item`,
        itemSchema,
        mode,
        depth + 1,
        seen,
      ),
    ];
  }

  if (fieldSchema.type === "integer") {
    if (typeof fieldSchema.minimum === "number") return fieldSchema.minimum;
    return 1;
  }

  if (fieldSchema.type === "number") {
    if (typeof fieldSchema.minimum === "number") return fieldSchema.minimum;
    return 1.23;
  }

  if (fieldSchema.type === "boolean") return true;

  if (fieldSchema.type === "string") {
    if (fieldSchema.format === "date") return "<date_string>";
    if (fieldSchema.format === "date-time") return "<datetime_string>";
    if (fieldSchema.format === "uuid") return "<uuid_string>";
    if (fieldSchema.format === "email") return "<email_string>";
    if (fieldSchema.format === "uri" || fieldSchema.format === "url") {
      return "<url_string>";
    }
    if (fieldSchema.pattern) return `<pattern_${name || "string"}>`;
    if (
      typeof fieldSchema.minLength === "number" &&
      fieldSchema.minLength > 0
    ) {
      return "x".repeat(Math.min(fieldSchema.minLength, 8));
    }
    return `<${name || "string"}>`;
  }

  return `<${name || "value"}>`;
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

  const primaryContentType = getPrimaryRequestContentType(endpoint);
  if (endpoint?.requestBody && primaryContentType) {
    headers["Content-Type"] = primaryContentType;
  } else if (endpoint?.requestBody) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function buildValidRequest(endpoint, profile, mode = "full") {
  const resolved = getResolved(endpoint);

  if (resolved?.valid) {
    const schema = getRequestBodySchema(endpoint, profile);

    const base = {
      path_params: clone(resolved.valid.path) || {},
      query_params: clone(resolved.valid.query) || {},
      headers: clone(resolved.valid.headers) || {},
      cookies: clone(resolved.valid.cookies) || {},
      request_body: clone(resolved.valid.body),
    };

    if (schema && isObject(schema)) {
      base.request_body = buildValidBodyFromSchema(
        schema,
        mode === "minimal" ? "minimal" : "full",
      );
    }

    return base;
  }

  const requestBodySchema = getRequestBodySchema(endpoint, profile);
  const requestBodyRequired = getRequestBodyRequired(endpoint, profile);

  const pathParams = {};
  const queryParams = {};
  const body = requestBodySchema
    ? buildValidBodyFromSchema(
        requestBodySchema,
        mode === "minimal" ? "minimal" : "full",
      )
    : requestBodyRequired
      ? {}
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

function pickFirstRequiredQuery(endpoint) {
  return ensureArray(endpoint?.params?.query).find((p) => p?.required) || null;
}

function pickFirstRequiredPath(endpoint) {
  return ensureArray(endpoint?.params?.path).find((p) => p?.required) || null;
}

function getAllEnumFields(schema) {
  const props = getSchemaProperties(schema);
  return Object.entries(props)
    .filter(
      ([, fieldSchema]) =>
        Array.isArray(fieldSchema?.enum) && fieldSchema.enum.length > 0,
    )
    .map(([name, fieldSchema]) => ({ name, schema: fieldSchema }));
}

function getAllFormatFields(schema) {
  const props = getSchemaProperties(schema);
  return Object.entries(props)
    .filter(([key, fieldSchema]) => {
      const format = lower(fieldSchema?.format);
      const lowerKey = lower(key);

      return (
        !!format ||
        lowerKey.includes("email") ||
        lowerKey.includes("otp") ||
        lowerKey.includes("code")
      );
    })
    .map(([name, fieldSchema]) => ({ name, schema: fieldSchema }));
}

function getAllStringMaxLengthFields(schema) {
  const props = getSchemaProperties(schema);
  return Object.entries(props)
    .filter(
      ([, fieldSchema]) =>
        lower(fieldSchema?.type) === "string" &&
        typeof fieldSchema?.maxLength === "number",
    )
    .map(([name, fieldSchema]) => ({ name, schema: fieldSchema }));
}

function getAllNumericConstraintFields(schema) {
  const props = getSchemaProperties(schema);

  return Object.entries(props)
    .filter(([, fieldSchema]) => {
      const type = lower(fieldSchema?.type);
      return (
        (type === "integer" || type === "number") &&
        (fieldSchema?.minimum !== undefined ||
          fieldSchema?.maximum !== undefined)
      );
    })
    .map(([name, fieldSchema]) => ({
      name,
      schema: fieldSchema,
    }));
}
function getAllNumericMaximumFields(schema) {
  const props = getSchemaProperties(schema);
  return Object.entries(props)
    .filter(
      ([, fieldSchema]) =>
        (lower(fieldSchema?.type) === "integer" ||
          lower(fieldSchema?.type) === "number") &&
        typeof fieldSchema?.maximum === "number",
    )
    .map(([name, fieldSchema]) => ({ name, schema: fieldSchema }));
}

function getAllTypedBodyFields(schema) {
  const props = getSchemaProperties(schema);

  return Object.entries(props)
    .filter(([, fieldSchema]) => {
      const type = lower(fieldSchema?.type);
      return [
        "string",
        "integer",
        "number",
        "boolean",
        "array",
        "object",
      ].includes(type);
    })
    .map(([name, fieldSchema]) => ({
      name,
      schema: fieldSchema,
      source: "body",
    }));
}

function buildInvalidTypeValue(fieldSchema = {}, fieldName = "value") {
  const type = lower(fieldSchema?.type);
  const name = lower(fieldName);

  if (type === "string") return 999;
  if (type === "integer") return "not-an-integer";
  if (type === "number") return "not-a-number";
  if (type === "boolean") return "not-a-boolean";
  if (type === "array") return "not-an-array";
  if (type === "object") return `not-an-object-${name || "value"}`;

  return "__invalid_type_value__";
}

function buildInvalidEnumValue(fieldSchema = {}, fieldName = "value") {
  const enumValues = Array.isArray(fieldSchema?.enum) ? fieldSchema.enum : [];
  const type = lower(fieldSchema?.type);
  const name = lower(fieldName);

  if (type === "integer" || type === "number") {
    const numericEnums = enumValues.filter((v) => typeof v === "number");
    if (numericEnums.length > 0) {
      return Math.max(...numericEnums) + 999;
    }
    return 999999;
  }

  if (type === "boolean") {
    return "not-a-boolean";
  }

  if (name.includes("status")) return "__invalid_status__";
  if (name.includes("type")) return "__invalid_type__";
  if (name.includes("role")) return "__invalid_role__";

  return "__invalid_enum_value__";
}

function getAllEnumFieldsFromQuery(endpoint) {
  return ensureArray(endpoint?.params?.query)
    .filter(
      (p) =>
        Array.isArray(p?.schema?.enum) && p.schema.enum.length > 0 && p?.name,
    )
    .map((p) => ({
      name: p.name,
      schema: p.schema,
      source: "query",
    }));
}

function getAllEnumFieldsFromPath(endpoint) {
  return ensureArray(endpoint?.params?.path)
    .filter(
      (p) =>
        Array.isArray(p?.schema?.enum) && p.schema.enum.length > 0 && p?.name,
    )
    .map((p) => ({
      name: p.name,
      schema: p.schema,
      source: "path",
    }));
}

function getAllEnumFieldsFromBody(schema) {
  return getAllEnumFields(schema).map((entry) => ({
    ...entry,
    source: "body",
  }));
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

function buildContractPlans(endpoint, profile) {
  const plans = [];
  const successStatuses = getSuccessStatusCandidates(endpoint);

  // 🔍 Extract response schema hints (generic, NOT hardcoded)
  const responses = endpoint?.responses || {};
  const firstSuccess = successStatuses?.[0];

  const responseSchema =
    responses?.[firstSuccess]?.content?.["application/json"]?.schema;

  const responseFields = responseSchema?.properties
    ? Object.keys(responseSchema.properties).slice(0, 5)
    : [];

  const contentTypes = Object.keys(responses?.[firstSuccess]?.content || {});

  /* =========================
     SUCCESS (ENHANCED)
  ========================= */
  plans.push(
    makePlan({
      scenario_id: "contract.success",
      test_type: "contract",
      template_key: null,
      invalidate: null,
      keep_valid: { all: true },

      expected_outcome_family: "success",
      expected_status_candidates: successStatuses,

      // 🔥 NEW: richer metadata
      spec_evidence: {
        source: "responses.2xx",
        primary_status: firstSuccess,
        response_fields: responseFields,
        content_types: contentTypes,
      },
    }),
  );

  /* =========================
     STATUS CODE (MULTI)
  ========================= */
  for (const code of successStatuses) {
    plans.push(
      makePlan({
        scenario_id: "contract.status_code",
        test_type: "contract",
        template_key: null,
        invalidate: null,
        keep_valid: { all: true },

        expected_outcome_family: "success",
        expected_status_candidates: [code],

        spec_evidence: {
          source: "responses.status",
          status: code,
        },
      }),
    );
  }

  /* =========================
     CONTENT TYPE (ENHANCED)
  ========================= */
  if (contentTypes.length > 0) {
    plans.push(
      makePlan({
        scenario_id: "contract.content_type",
        test_type: "contract",
        template_key: null,
        invalidate: null,
        keep_valid: { all: true },

        expected_outcome_family: "success",
        expected_status_candidates: successStatuses,

        spec_evidence: {
          source: "responses.content",
          content_types: contentTypes,
        },
      }),
    );
  }

  /* =========================
     REQUIRED RESPONSE FIELDS
  ========================= */
  const requiredFields = getResponseRequiredFields(endpoint);

  if (requiredFields.length > 0) {
    plans.push(
      makePlan({
        scenario_id: "contract.required_fields",
        test_type: "contract",
        template_key: null,
        invalidate: null,
        keep_valid: { all: true },

        expected_outcome_family: "success",
        expected_status_candidates: successStatuses,

        spec_evidence: {
          source: "response.required",
          required_fields: requiredFields.slice(0, 5),
        },
      }),
    );
  }

  /* =========================
     REQUEST BODY VALIDATION
  ========================= */
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

        spec_evidence: {
          source: "requestBody",
          has_body: true,
        },
      }),
    );
  }

  return plans;
}
function buildSchemaPlans(endpoint, profile) {
  const plans = [];
  const responseSchema = getResponseSchema(endpoint);
  const requestSchema = getRequestBodySchema(endpoint, profile);
  const successStatuses = getSuccessStatusCandidates(endpoint);

  // Primary path: response schema exists
  if (responseSchema && typeof responseSchema === "object") {
    const summary = getResponseSchemaSummary(endpoint);
    const requiredFields = getResponseRequiredFields(endpoint);

    plans.push(
      makePlan({
        scenario_id: "schema.response",
        test_type: "schema",
        template_key: null,
        invalidate: null,
        keep_valid: { all: true },
        expected_outcome_family: "success",
        expected_status_candidates: successStatuses,
        spec_evidence: {
          source: "response.schema",
          top_level_fields: summary.top_level_fields,
          nested_fields: summary.nested_fields,
          array_fields: summary.array_fields,
          typed_fields: summary.typed_fields,
        },
      }),
    );

    if (requiredFields.length > 0) {
      plans.push(
        makePlan({
          scenario_id: "schema.required_fields",
          test_type: "schema",
          template_key: null,
          invalidate: null,
          keep_valid: { all: true },
          expected_outcome_family: "success",
          expected_status_candidates: successStatuses,
          spec_evidence: {
            source: "response.required",
            required_fields: requiredFields,
            nested_fields: summary.nested_fields,
          },
        }),
      );
    }

    if (summary.typed_fields.length > 0) {
      plans.push(
        makePlan({
          scenario_id: "schema.field_types",
          test_type: "schema",
          template_key: null,
          invalidate: null,
          keep_valid: { all: true },
          expected_outcome_family: "success",
          expected_status_candidates: successStatuses,
          spec_evidence: {
            source: "response.properties",
            typed_fields: summary.typed_fields,
            array_fields: summary.array_fields,
            nested_fields: summary.nested_fields,
          },
        }),
      );
    }

    return plans;
  }

  // Fallback path: no response schema, but request body schema exists
  if (requestSchema && typeof requestSchema === "object") {
    const summary = getRequestSchemaSummary(endpoint, profile);
    const requiredFields = ensureArray(requestSchema?.required);

    plans.push(
      makePlan({
        scenario_id: "schema.request_body",
        test_type: "schema",
        template_key: null,
        invalidate: null,
        keep_valid: { all: true },
        expected_outcome_family: "success",
        expected_status_candidates: successStatuses,
        spec_evidence: {
          source: "request.schema",
          top_level_fields: summary.top_level_fields,
          nested_fields: summary.nested_fields,
          array_fields: summary.array_fields,
          typed_fields: summary.typed_fields,
        },
      }),
    );

    if (requiredFields.length > 0) {
      plans.push(
        makePlan({
          scenario_id: "schema.request_required_fields",
          test_type: "schema",
          template_key: null,
          invalidate: null,
          keep_valid: { all: true },
          expected_outcome_family: "success",
          expected_status_candidates: successStatuses,
          spec_evidence: {
            source: "request.required",
            required_fields: requiredFields,
            nested_fields: summary.nested_fields,
          },
        }),
      );
    }

    if (summary.typed_fields.length > 0) {
      plans.push(
        makePlan({
          scenario_id: "schema.request_field_types",
          test_type: "schema",
          template_key: null,
          invalidate: null,
          keep_valid: { all: true },
          expected_outcome_family: "success",
          expected_status_candidates: successStatuses,
          spec_evidence: {
            source: "request.properties",
            typed_fields: summary.typed_fields,
            array_fields: summary.array_fields,
            nested_fields: summary.nested_fields,
          },
        }),
      );
    }
  }

  return plans;
}

function buildAutoPlansFromResolved(endpoint, profile) {
  const resolved = getResolved(endpoint);
  const autoPlans = [];
  const method = normalizeMethod(endpoint?.method);
  const requestBodySchema = getRequestBodySchema(endpoint, profile);
  const supportedContentTypes = getSupportedContentTypes(endpoint);

  if (profile?.requiresAuth || endpoint?.security?.length > 0) {
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
        spec_evidence: { source: "resolved.auth" },
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
        spec_evidence: { source: "resolved.auth" },
      }),
    );
  }

  if (ensureArray(endpoint?.params?.query).some((p) => p?.required)) {
    const queryField = pickFirstRequiredQuery(endpoint)?.name || null;
    if (queryField) {
      autoPlans.push(
        makePlan({
          scenario_id: `negative.missing_required_query:${queryField}`,
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
          spec_evidence: { source: "endpoint.params.query.required" },
        }),
      );
    }
  }

  if (ensureArray(endpoint?.params?.path).some((p) => p?.required)) {
    const pathField = pickFirstRequiredPath(endpoint)?.name || null;
    if (pathField) {
      autoPlans.push(
        makePlan({
          scenario_id: `negative.missing_required_path:${pathField}`,
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
          spec_evidence: { source: "endpoint.params.path.required" },
        }),
      );
    }
  }

  if (method === "POST" && requestBodySchema) {
    autoPlans.push(
      makePlan({
        scenario_id: "success.min_payload",
        test_type: "contract",
        template_key: null,
        invalidate: null,
        keep_valid: { minimal_body: true },
        expected_outcome_family: "success",
        expected_status_candidates: getSuccessStatusCandidates(endpoint),
        spec_evidence: { source: "requestBody.minimal" },
      }),
    );

    autoPlans.push(
      makePlan({
        scenario_id: "success.full_payload",
        test_type: "contract",
        template_key: null,
        invalidate: null,
        keep_valid: { full_body: true },
        expected_outcome_family: "success",
        expected_status_candidates: getSuccessStatusCandidates(endpoint),
        spec_evidence: { source: "requestBody.full" },
      }),
    );
  }

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
        spec_evidence: { source: "requestBody.required" },
      }),
    );
  }

  if (supportedContentTypes.length > 0) {
    autoPlans.push(
      makePlan({
        scenario_id: "negative.unsupported_content_type",
        test_type: "negative",
        template_key: "negative.unsupported_content_type",
        invalidate: {
          location: "headers",
          field: "Content-Type",
          mode: "unsupported_content_type",
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
          body: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "415"],
        field_target: "Content-Type",
        spec_evidence: { source: "requestBody.content" },
      }),
    );
  }
  const enumFields = [
    ...getAllEnumFieldsFromQuery(endpoint),
    ...getAllEnumFieldsFromPath(endpoint),
    ...getAllEnumFieldsFromBody(requestBodySchema),
  ];

  for (const ef of enumFields) {
    const invalidValue = buildInvalidEnumValue(ef.schema, ef.name);

    autoPlans.push(
      makePlan({
        scenario_id: `negative.invalid_enum:${ef.name}`,
        test_type: "negative",
        template_key: "negative.invalid_enum",
        invalidate: {
          location: ef.source,
          field: ef.name,
          mode: "invalid_enum",
          invalid_value: invalidValue,
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
          body: true,
          body_other_than_target: true,
          query_other_than_target: true,
          path_other_than_target: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "422"],
        field_target: ef.name,
        spec_evidence: {
          source:
            ef.source === "body"
              ? "requestBody.enum"
              : `endpoint.params.${ef.source}.enum`,
          enum_source: ef.source,
          enum_values: Array.isArray(ef.schema?.enum)
            ? clone(ef.schema.enum)
            : [],
          invalid_value: invalidValue,
          field_type: ef.schema?.type || null,
        },
      }),
    );
  }

  const requiredFields = ensureArray(requestBodySchema?.required);
  for (const field of requiredFields) {
    autoPlans.push(
      makePlan({
        scenario_id: `negative.missing_required_body_field:${field}`,
        test_type: "negative",
        template_key: "negative.missing_required_body_field",
        invalidate: {
          location: "body",
          field,
          mode: "missing_required_field",
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
          body_other_than_target: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "422"],
        field_target: field,
        spec_evidence: {
          source: "requestBody.required",
          missing_field: field,
          required_fields: clone(requiredFields),
          field_schema: clone(requestBodySchema?.properties?.[field] || {}),
        },
      }),
    );

    autoPlans.push(
      makePlan({
        scenario_id: `negative.null_required_field:${field}`,
        test_type: "negative",
        template_key: "negative.null_required_field",
        invalidate: {
          location: "body",
          field,
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
        field_target: field,
        spec_evidence: {
          source: "requestBody.required",
          missing_field: field,
          required_fields: clone(requiredFields),
          field_schema: clone(requestBodySchema?.properties?.[field] || {}),
        },
      }),
    );
  }

  const typedFields = getAllTypedBodyFields(requestBodySchema);
  for (const tf of typedFields) {
    const invalidValue = buildInvalidTypeValue(tf.schema, tf.name);

    autoPlans.push(
      makePlan({
        scenario_id: `negative.invalid_type:${tf.name}`,
        test_type: "negative",
        template_key: "negative.invalid_type",
        invalidate: {
          location: "body",
          field: tf.name,
          mode: "invalid_type",
          invalid_value: invalidValue,
        },
        keep_valid: {
          auth: true,
          path: true,
          query: true,
          body_other_than_target: true,
        },
        expected_outcome_family: "validation_failure",
        expected_status_candidates: ["400", "422"],
        field_target: tf.name,
        spec_evidence: {
          source: "requestBody.type",
          field_type: tf.schema?.type || null,
          invalid_value: invalidValue,
          field_schema: clone(tf.schema || {}),
        },
      }),
    );
  }

  const numericFields = getAllNumericConstraintFields(requestBodySchema);

  for (const nf of numericFields) {
    const min = nf.schema?.minimum;
    const max = nf.schema?.maximum;

    if (min !== undefined) {
      autoPlans.push(
        makePlan({
          scenario_id: `negative.below_minimum:${nf.name}`,
          test_type: "negative",
          template_key: "negative.below_minimum",
          invalidate: {
            location: "body",
            field: nf.name,
            mode: "below_minimum",
            invalid_value: min - 1,
          },
          keep_valid: {
            auth: true,
            path: true,
            query: true,
            body_other_than_target: true,
          },
          expected_outcome_family: "validation_failure",
          expected_status_candidates: ["400", "422"],
          field_target: nf.name,
          spec_evidence: {
            minimum: min,
            invalid_value: min - 1,
            field_schema: clone(nf.schema),
          },
        }),
      );
    }

    if (max !== undefined) {
      autoPlans.push(
        makePlan({
          scenario_id: `negative.above_maximum:${nf.name}`,
          test_type: "negative",
          template_key: "negative.above_maximum",
          invalidate: {
            location: "body",
            field: nf.name,
            mode: "above_maximum",
            invalid_value: max + 1,
          },
          keep_valid: {
            auth: true,
            path: true,
            query: true,
            body_other_than_target: true,
          },
          expected_outcome_family: "validation_failure",
          expected_status_candidates: ["400", "422"],
          field_target: nf.name,
          spec_evidence: {
            maximum: max,
            invalid_value: max + 1,
            field_schema: clone(nf.schema),
          },
        }),
      );
    }
  }

  const formatFields = getAllFormatFields(requestBodySchema);
  for (const ff of formatFields) {
    autoPlans.push(
      makePlan({
        scenario_id: `negative.invalid_format:${ff.name}`,
        test_type: "negative",
        template_key: "negative.invalid_format",
        invalidate: {
          location: "body",
          field: ff.name,
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
        field_target: ff.name,
        spec_evidence: { source: "requestBody.format" },
      }),
    );
  }

  const stringFields = getAllStringMaxLengthFields(requestBodySchema);
  for (const sf of stringFields) {
    autoPlans.push(
      makePlan({
        scenario_id: `negative.string_too_long:${sf.name}`,
        test_type: "negative",
        template_key: "negative.string_too_long",
        invalidate: {
          location: "body",
          field: sf.name,
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
        field_target: sf.name,
        spec_evidence: { source: "requestBody.maxLength" },
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
function getEndpointActionLabel(endpoint) {
  const method = normalizeMethod(endpoint?.method);
  const path = lower(endpoint?.path || "");
  const summary = lower(endpoint?.summary || endpoint?.operationId || "");

  if (summary.includes("create") || summary.includes("add")) {
    return "Create resource";
  }

  if (summary.includes("update") || method === "PUT" || method === "PATCH") {
    return "Update resource";
  }

  if (summary.includes("delete") || method === "DELETE") {
    return "Delete resource";
  }

  if (summary.includes("list") || summary.includes("search")) {
    return "Retrieve resource list";
  }

  if (method === "POST") {
    if (path.includes("/search")) return "Search resource";
    return "Create resource";
  }

  if (method === "GET") {
    return path.includes("{")
      ? "Retrieve resource details"
      : "Retrieve resource";
  }

  if (method === "PUT" || method === "PATCH") {
    return "Update resource";
  }

  if (method === "DELETE") {
    return "Delete resource";
  }

  return "Process request";
}

function buildScenarioTitle(endpoint, plan) {
  const method = normalizeMethod(endpoint?.method);
  const path = endpoint?.path || "/";
  const field = plan.field_target || scenarioSuffix(plan) || "field";
  const family = scenarioFamily(plan);

  const action = getEndpointActionLabel(endpoint);

  switch (family) {
    case "contract.success": {
      const primaryStatus =
        plan?.spec_evidence?.primary_status ||
        ensureArray(plan?.expected_status_candidates)[0] ||
        "200";
      const responseFields = ensureArray(plan?.spec_evidence?.response_fields);

      return responseFields.length > 0
        ? `[Success] ${method} ${path} returns ${primaryStatus} with fields ${responseFields.join(", ")}`
        : `[Success] ${method} ${path} returns ${primaryStatus}`;
    }

    case "contract.status_code": {
      const status =
        plan?.spec_evidence?.status ||
        ensureArray(plan?.expected_status_candidates)[0] ||
        "200";

      return `[Status] ${method} ${path} returns documented status ${status}`;
    }

    case "contract.content_type": {
      const contentTypes = ensureArray(plan?.spec_evidence?.content_types);

      return contentTypes.length > 0
        ? `[Content-Type] ${method} ${path} returns ${contentTypes.join(" or ")}`
        : `[Content-Type] Validate response format – ${method} ${path}`;
    }

    case "contract.required_fields": {
      const requiredFields = ensureArray(plan?.spec_evidence?.required_fields);

      return requiredFields.length > 0
        ? `[Fields] ${method} ${path} returns required fields ${requiredFields.join(", ")}`
        : `[Fields] Validate required response fields – ${method} ${path}`;
    }

    case "contract.request_body":
      return `[Request] ${method} ${path} accepts valid documented payload`;

    case "schema.response": {
      const topFields = ensureArray(plan?.spec_evidence?.top_level_fields);
      const nestedFields = ensureArray(plan?.spec_evidence?.nested_fields);

      return nestedFields.length > 0
        ? `[Schema] ${method} ${path} returns structured response with nested fields`
        : topFields.length > 0
          ? `[Schema] ${method} ${path} returns fields ${topFields.join(", ")}`
          : `[Schema] Validate response structure – ${method} ${path}`;
    }

    case "schema.required_fields": {
      const requiredFields = ensureArray(plan?.spec_evidence?.required_fields);

      return requiredFields.length > 0
        ? `[Schema] ${method} ${path} returns required fields ${requiredFields.join(", ")}`
        : `[Schema] Validate required fields – ${method} ${path}`;
    }

    case "schema.field_types": {
      const typedFields = ensureArray(plan?.spec_evidence?.typed_fields);

      return typedFields.length > 0
        ? `[Schema] ${method} ${path} validates types for ${typedFields.slice(0, 3).join(", ")}`
        : `[Schema] Validate field data types – ${method} ${path}`;
    }

    case "schema.request_body": {
      const topFields = ensureArray(plan?.spec_evidence?.top_level_fields);

      return topFields.length > 0
        ? `[Schema] ${method} ${path} accepts request fields ${topFields.join(", ")}`
        : `[Schema] Validate request structure – ${method} ${path}`;
    }

    case "success.min_payload":
      return `[Payload-Min] Validate minimal payload – ${method} ${path}`;

    case "success.full_payload":
      return `[Payload-Full] Validate full payload – ${method} ${path}`;

    case "auth.missing_credentials":
      return `[Auth] Reject missing credentials – ${method} ${path}`;

    case "auth.invalid_credentials":
      return `[Auth] Reject invalid credentials – ${method} ${path}`;

    case "negative.empty_body":
      return `[Negative] Reject empty body – ${method} ${path}`;

    case "negative.missing_required_query":
      return `[Negative] Missing query '${field}' – ${method} ${path}`;

    case "negative.below_minimum":
      return `[Negative] '${field}' below minimum (${plan.spec_evidence.minimum}) – ${method} ${path}`;

    case "negative.above_maximum":
      return `[Negative] '${field}' above maximum (${plan.spec_evidence.maximum}) – ${method} ${path}`;

    case "negative.missing_required_path":
      return `[Negative] Invalid path '${field}' – ${method} ${path}`;

    case "negative.missing_required_body_field": {
      const targetField = plan?.spec_evidence?.missing_field || field;

      return `[Negative] Missing required field '${targetField}' – ${method} ${path}`;
    }

    case "negative.invalid_enum": {
      const enumValues = ensureArray(plan?.spec_evidence?.enum_values);
      const invalidValue =
        plan?.spec_evidence?.invalid_value || "__invalid_enum_value__";

      return enumValues.length > 0
        ? `[Negative] Reject invalid enum '${field}' (${invalidValue} not in ${enumValues.join(", ")}) – ${method} ${path}`
        : `[Negative] Invalid enum '${field}' – ${method} ${path}`;
    }

    case "negative.invalid_type": {
      const expectedType = plan?.spec_evidence?.field_type || "documented";
      const invalidValue =
        plan?.spec_evidence?.invalid_value || "__invalid_type_value__";

      return `[Negative] Invalid type for '${field}' (${JSON.stringify(invalidValue)} not ${expectedType}) – ${method} ${path}`;
    }

    case "negative.invalid_format":
      return `[Negative] Invalid format '${field}' – ${method} ${path}`;

    case "negative.string_too_long":
      return `[Negative] '${field}' exceeds length – ${method} ${path}`;

    case "negative.numeric_above_maximum":
      return `[Negative] '${field}' exceeds limit – ${method} ${path}`;

    case "negative.null_required_field": {
      const targetField = plan?.spec_evidence?.missing_field || field;
      const fieldType = plan?.spec_evidence?.field_schema?.type || null;

      return fieldType
        ? `[Negative] Required field '${targetField}' set to null (${fieldType}) – ${method} ${path}`
        : `[Negative] Required field '${targetField}' set to null – ${method} ${path}`;
    }

    default:
      return `[${plan.test_type || "API"}] Validate behavior – ${method} ${path}`;
  }
}

function buildScenarioObjective(endpoint, plan) {
  const method = normalizeMethod(endpoint?.method);
  const path = endpoint?.path || "/";
  const field = plan.field_target || scenarioSuffix(plan) || "field";
  const family = scenarioFamily(plan);
  const actionLabel = getEndpointActionLabel(endpoint);

  switch (family) {
    case "auth.missing_credentials":
      return `Verify that ${method} ${path} blocks access when authentication credentials are missing.`;

    case "auth.invalid_credentials":
      return `Verify that ${method} ${path} blocks access when authentication credentials are invalid or expired.`;

    case "negative.empty_body":
      return `Verify that ${method} ${path} rejects requests when the required request body is not provided.`;

    case "negative.below_minimum":
      return `Verify that ${method} ${path} rejects '${field}' when value is below minimum allowed (${plan.spec_evidence.minimum}).`;

    case "negative.above_maximum":
      return `Verify that ${method} ${path} rejects '${field}' when value exceeds maximum allowed (${plan.spec_evidence.maximum}).`;

    case "negative.missing_required_query":
      return `Verify that ${method} ${path} rejects requests when required query parameter '${field}' is missing.`;

    case "negative.missing_required_path":
      return `Verify that ${method} ${path} rejects requests when required path parameter '${field}' is empty, malformed, or invalid.`;

    case "negative.missing_required_body_field": {
      const targetField = plan?.spec_evidence?.missing_field || field;
      const requiredFields = ensureArray(plan?.spec_evidence?.required_fields);

      return requiredFields.length > 0
        ? `Verify that ${method} ${path} rejects requests when required field '${targetField}' is missing from the request body. Documented required fields include: ${requiredFields.join(", ")}.`
        : `Verify that ${method} ${path} rejects requests when required field '${targetField}' is missing from the request body.`;
    }

    case "negative.invalid_enum": {
      const enumValues = ensureArray(plan?.spec_evidence?.enum_values);
      const invalidValue =
        plan?.spec_evidence?.invalid_value || "__invalid_enum_value__";

      return enumValues.length > 0
        ? `Verify that ${method} ${path} rejects requests when '${field}' is set to invalid value '${invalidValue}', which is outside the documented enum (${enumValues.join(", ")}).`
        : `Verify that ${method} ${path} rejects requests when '${field}' contains a value outside the documented enum.`;
    }

    case "negative.null_required_field": {
      const targetField = plan?.spec_evidence?.missing_field || field;
      const requiredFields = ensureArray(plan?.spec_evidence?.required_fields);

      return requiredFields.length > 0
        ? `Verify that ${method} ${path} rejects requests when required field '${targetField}' is set to null. Documented required fields include: ${requiredFields.join(", ")}.`
        : `Verify that ${method} ${path} rejects requests when required field '${targetField}' is null.`;
    }
    case "negative.invalid_type": {
      const expectedType = plan?.spec_evidence?.field_type || "documented";
      const invalidValue =
        plan?.spec_evidence?.invalid_value || "__invalid_type_value__";

      return `Verify that ${method} ${path} rejects requests when '${field}' is set to value '${invalidValue}', which does not match the documented type '${expectedType}'.`;
    }

    case "negative.invalid_format":
      return `Verify that ${method} ${path} rejects requests when '${field}' does not match the documented format.`;

    case "negative.string_too_long":
      return `Verify that ${method} ${path} rejects requests when '${field}' exceeds the documented maximum length.`;

    case "negative.numeric_above_maximum":
      return `Verify that ${method} ${path} rejects requests when '${field}' exceeds the documented maximum numeric value.`;

    case "negative.unsupported_content_type":
      return `Verify that ${method} ${path} rejects requests sent with an unsupported or invalid Content-Type header.`;

    case "success.min_payload":
      return `Verify that ${method} ${path} accepts a minimal valid payload containing only required documented fields.`;

    case "success.full_payload":
      return `Verify that ${method} ${path} accepts a complete valid payload including optional documented fields where applicable.`;

    case "contract.success": {
      const primaryStatus =
        plan?.spec_evidence?.primary_status ||
        ensureArray(plan?.expected_status_candidates)[0] ||
        "200";
      const responseFields = ensureArray(plan?.spec_evidence?.response_fields);

      return responseFields.length > 0
        ? `Verify that ${method} ${path} returns documented success status ${primaryStatus} and includes documented response fields: ${responseFields.join(", ")}.`
        : `Verify that ${method} ${path} returns documented success status ${primaryStatus} for a valid request.`;
    }

    case "contract.status_code": {
      const status =
        plan?.spec_evidence?.status ||
        ensureArray(plan?.expected_status_candidates)[0] ||
        "200";

      return `Verify that ${method} ${path} returns HTTP ${status} as documented for a valid request.`;
    }

    case "contract.content_type": {
      const contentTypes = ensureArray(plan?.spec_evidence?.content_types);

      return contentTypes.length > 0
        ? `Verify that ${method} ${path} returns one of the documented response content types: ${contentTypes.join(", ")}.`
        : `Verify that ${method} ${path} returns the documented response content type for a valid request.`;
    }

    case "contract.required_fields": {
      const requiredFields = ensureArray(plan?.spec_evidence?.required_fields);

      return requiredFields.length > 0
        ? `Verify that ${method} ${path} returns all mandatory response fields defined by the API contract, including: ${requiredFields.join(", ")}.`
        : `Verify that ${method} ${path} returns all mandatory response fields defined by the API contract.`;
    }

    case "contract.request_body":
      return `Verify that ${method} ${path} accepts a valid request payload that conforms to the documented request contract and processes it successfully.`;
    case "schema.response": {
      const nestedFields = ensureArray(plan?.spec_evidence?.nested_fields);
      const arrayFields = ensureArray(plan?.spec_evidence?.array_fields);

      return `Verify that ${method} ${path} returns a response body that conforms to the documented response schema${nestedFields.length > 0 ? `, including nested fields such as ${nestedFields.join(", ")}` : ""}${arrayFields.length > 0 ? ` and array structures such as ${arrayFields.join(", ")}` : ""}.`;
    }

    case "schema.required_fields": {
      const requiredFields = ensureArray(plan?.spec_evidence?.required_fields);

      return requiredFields.length > 0
        ? `Verify that ${method} ${path} returns all required fields defined in the documented response schema, including: ${requiredFields.join(", ")}.`
        : `Verify that ${method} ${path} returns all required fields defined in the documented response schema.`;
    }

    case "schema.field_types": {
      const typedFields = ensureArray(plan?.spec_evidence?.typed_fields);

      return typedFields.length > 0
        ? `Verify that ${method} ${path} returns response fields using documented data types such as: ${typedFields.join(", ")}.`
        : `Verify that ${method} ${path} returns response fields using the documented data types.`;
    }

    case "schema.request_body": {
      const nestedFields = ensureArray(plan?.spec_evidence?.nested_fields);
      const arrayFields = ensureArray(plan?.spec_evidence?.array_fields);

      return `Verify that the request body for ${method} ${path} conforms to the documented request schema${nestedFields.length > 0 ? `, including nested fields such as ${nestedFields.join(", ")}` : ""}${arrayFields.length > 0 ? ` and array structures such as ${arrayFields.join(", ")}` : ""}.`;
    }

    case "schema.request_required_fields": {
      const requiredFields = ensureArray(plan?.spec_evidence?.required_fields);

      return requiredFields.length > 0
        ? `Verify that the request body for ${method} ${path} includes all required documented fields, including: ${requiredFields.join(", ")}.`
        : `Verify that the request body for ${method} ${path} includes all required documented fields.`;
    }

    case "schema.request_field_types": {
      const typedFields = ensureArray(plan?.spec_evidence?.typed_fields);

      return typedFields.length > 0
        ? `Verify that the request body for ${method} ${path} uses documented field data types such as: ${typedFields.join(", ")}.`
        : `Verify that the request body for ${method} ${path} uses the documented field data types.`;
    }

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
  const field = plan.field_target || scenarioSuffix(plan) || "field";
  const family = scenarioFamily(plan);

  switch (family) {
    case "contract.success": {
      const responseFields = ensureArray(plan?.spec_evidence?.response_fields);

      steps.push(`Prepare a valid request for ${method} ${path}.`);
      steps.push(
        "Populate all required headers, parameters, and request fields with valid documented values.",
      );
      steps.push("Send the request.");
      steps.push("Capture the response status, headers, and body.");
      if (responseFields.length > 0) {
        steps.push(
          `Verify the response includes documented fields: ${responseFields.join(", ")}.`,
        );
      }
      break;
    }

    case "contract.status_code": {
      const status =
        plan?.spec_evidence?.status ||
        ensureArray(plan?.expected_status_candidates)[0] ||
        "200";

      steps.push(`Prepare a valid request for ${method} ${path}.`);
      steps.push("Send the request.");
      steps.push("Record the returned HTTP status code.");
      steps.push(`Verify the returned status code is ${status}.`);
      break;
    }

    case "contract.content_type": {
      const contentTypes = ensureArray(plan?.spec_evidence?.content_types);

      steps.push(`Prepare a valid request for ${method} ${path}.`);
      steps.push("Send the request.");
      steps.push("Capture the response headers.");
      if (contentTypes.length > 0) {
        steps.push(
          `Verify the returned Content-Type is one of: ${contentTypes.join(", ")}.`,
        );
      } else {
        steps.push(
          "Verify the returned Content-Type matches the documented media type.",
        );
      }
      break;
    }

    case "contract.required_fields": {
      const requiredFields = ensureArray(plan?.spec_evidence?.required_fields);

      steps.push(`Prepare a valid request for ${method} ${path}.`);
      steps.push("Send the request.");
      steps.push("Capture the response body.");
      if (requiredFields.length > 0) {
        steps.push(
          `Verify the response includes required fields: ${requiredFields.join(", ")}.`,
        );
      } else {
        steps.push(
          "Verify all documented mandatory response fields are present.",
        );
      }
      break;
    }

    case "contract.request_body":
      steps.push(`Prepare a valid request payload for ${method} ${path}.`);
      steps.push("Populate the request body using the documented contract.");
      steps.push("Send the request.");
      steps.push(
        "Verify the API accepts the documented payload without request-body validation errors.",
      );
      steps.push("Verify the request is processed successfully.");
      break;

    case "schema.response": {
      const nestedFields = ensureArray(plan?.spec_evidence?.nested_fields);
      const arrayFields = ensureArray(plan?.spec_evidence?.array_fields);

      steps.push(`Prepare a valid request for ${method} ${path}.`);
      steps.push("Send the request.");
      steps.push("Capture the response body.");
      steps.push(
        "Validate the response body against the documented response schema.",
      );
      if (nestedFields.length > 0) {
        steps.push(
          `Verify nested response fields such as ${nestedFields.join(", ")} are present and structured correctly.`,
        );
      }
      if (arrayFields.length > 0) {
        steps.push(
          `Verify array structures such as ${arrayFields.join(", ")} conform to the documented schema.`,
        );
      }
      break;
    }

    case "schema.required_fields": {
      const requiredFields = ensureArray(plan?.spec_evidence?.required_fields);

      steps.push(`Prepare a valid request for ${method} ${path}.`);
      steps.push("Send the request.");
      steps.push("Capture the response body.");
      if (requiredFields.length > 0) {
        steps.push(
          `Verify required response fields are present: ${requiredFields.join(", ")}.`,
        );
      } else {
        steps.push(
          "Verify all required fields defined in the response schema are present.",
        );
      }
      break;
    }

    case "schema.field_types": {
      const typedFields = ensureArray(plan?.spec_evidence?.typed_fields);

      steps.push(`Prepare a valid request for ${method} ${path}.`);
      steps.push("Send the request.");
      steps.push("Capture the response body.");
      if (typedFields.length > 0) {
        steps.push(
          `Verify documented field types for: ${typedFields.join(", ")}.`,
        );
      } else {
        steps.push(
          "Verify response field values match the documented data types.",
        );
      }
      break;
    }

    case "schema.request_body": {
      const nestedFields = ensureArray(plan?.spec_evidence?.nested_fields);
      const arrayFields = ensureArray(plan?.spec_evidence?.array_fields);

      steps.push(`Prepare a valid request body for ${method} ${path}.`);
      steps.push("Build the payload using the documented request schema.");
      if (nestedFields.length > 0) {
        steps.push(
          `Include nested request fields such as ${nestedFields.join(", ")} where applicable.`,
        );
      }
      if (arrayFields.length > 0) {
        steps.push(
          `Populate documented array structures such as ${arrayFields.join(", ")} where applicable.`,
        );
      }
      steps.push("Send the request.");
      steps.push("Verify no request-schema validation error occurs.");
      break;
    }
    case "success.min_payload":
      steps.push(`Prepare the minimal valid payload for ${method} ${path}.`);
      steps.push("Include only the required documented fields.");
      steps.push("Send the request.");
      steps.push("Verify the API accepts the minimal valid payload.");
      break;

    case "success.full_payload":
      steps.push(`Prepare the full valid payload for ${method} ${path}.`);
      steps.push(
        "Include required fields and all applicable optional documented fields.",
      );
      steps.push("Send the request.");
      steps.push("Verify the API accepts the complete payload successfully.");
      break;

    case "auth.missing_credentials":
      steps.push(`Prepare a valid request for ${method} ${path}.`);
      steps.push("Remove authentication credentials from the request.");
      steps.push("Send the request.");
      steps.push("Verify the API rejects the unauthenticated request.");
      break;

    case "auth.invalid_credentials":
      steps.push(`Prepare a valid request for ${method} ${path}.`);
      steps.push(
        "Replace the authentication credential with an invalid value.",
      );
      steps.push("Send the request.");
      steps.push(
        "Verify the API rejects the request as unauthorized or forbidden.",
      );
      break;

    case "negative.empty_body":
      steps.push(`Prepare a valid request for ${method} ${path}.`);
      steps.push("Remove the request body completely.");
      steps.push("Send the request.");
      steps.push(
        "Verify the API rejects the request because the body is required.",
      );
      break;

    case "negative.below_minimum":
      steps.push(
        `Set '${field}' to ${plan.spec_evidence.invalid_value} (below minimum).`,
      );
      break;

    case "negative.above_maximum":
      steps.push(
        `Set '${field}' to ${plan.spec_evidence.invalid_value} (above maximum).`,
      );
      break;

    case "negative.missing_required_query":
      steps.push(`Prepare a valid request for ${method} ${path}.`);
      steps.push(`Remove required query parameter '${field}'.`);
      steps.push("Send the request.");
      steps.push(
        "Verify the API rejects the request due to the missing query parameter.",
      );
      break;

    case "negative.missing_required_path":
      steps.push(`Prepare a valid request for ${method} ${path}.`);
      steps.push(
        `Set required path parameter '${field}' to an invalid or empty value.`,
      );
      steps.push("Send the request.");
      steps.push(
        "Verify the API rejects the request due to the invalid path parameter.",
      );
      break;

    case "negative.missing_required_body_field": {
      const targetField = plan?.spec_evidence?.missing_field || field;
      const requiredFields = ensureArray(plan?.spec_evidence?.required_fields);

      steps.push(`Prepare a valid request body for ${method} ${path}.`);
      steps.push(
        `Remove required field '${targetField}' from the request body.`,
      );
      if (requiredFields.length > 0) {
        steps.push(
          `Keep other required fields valid: ${requiredFields.filter((f) => f !== targetField).join(", ") || "none"}.`,
        );
      }
      steps.push("Send the request.");
      steps.push(
        "Verify the API rejects the request due to the missing required field.",
      );
      break;
    }

    case "negative.invalid_enum": {
      const enumSource = plan?.spec_evidence?.enum_source || "body";
      const invalidValue =
        plan?.spec_evidence?.invalid_value || "__invalid_enum_value__";
      const enumValues = ensureArray(plan?.spec_evidence?.enum_values);

      if (enumSource === "query") {
        steps.push(`Prepare a valid request for ${method} ${path}.`);
        steps.push(
          `Set query parameter '${field}' to invalid value ${JSON.stringify(invalidValue)}.`,
        );
      } else if (enumSource === "path") {
        steps.push(`Prepare a valid request for ${method} ${path}.`);
        steps.push(
          `Set path parameter '${field}' to invalid value ${JSON.stringify(invalidValue)}.`,
        );
      } else {
        steps.push(`Prepare a valid request body for ${method} ${path}.`);
        steps.push(
          `Set body field '${field}' to invalid value ${JSON.stringify(invalidValue)}.`,
        );
      }

      if (enumValues.length > 0) {
        steps.push(
          `Use a value that is outside the documented enum: ${enumValues.map((v) => JSON.stringify(v)).join(", ")}.`,
        );
      }

      steps.push("Send the request.");
      steps.push(
        "Verify the API rejects the request due to enum validation failure.",
      );
      break;
    }

    case "negative.null_required_field": {
      const targetField = plan?.spec_evidence?.missing_field || field;
      const requiredFields = ensureArray(plan?.spec_evidence?.required_fields);

      steps.push(`Prepare a valid request body for ${method} ${path}.`);
      steps.push(`Set required field '${targetField}' to null.`);
      if (requiredFields.length > 0) {
        steps.push(
          `Keep other required fields valid: ${requiredFields.filter((f) => f !== targetField).join(", ") || "none"}.`,
        );
      }
      steps.push("Send the request.");
      steps.push(
        "Verify the API rejects the request because a required field was set to null.",
      );
      break;
    }

    case "negative.invalid_type": {
      const expectedType = plan?.spec_evidence?.field_type || "documented";
      const invalidValue =
        plan?.spec_evidence?.invalid_value || "__invalid_type_value__";

      steps.push(`Prepare a valid request body for ${method} ${path}.`);
      steps.push(
        `Set body field '${field}' to invalid value ${JSON.stringify(invalidValue)} instead of expected type '${expectedType}'.`,
      );
      steps.push("Send the request.");
      steps.push(
        "Verify the API rejects the request due to request-body type validation failure.",
      );
      break;
    }

    case "negative.invalid_format":
      steps.push(`Prepare a valid request body for ${method} ${path}.`);
      steps.push(
        `Set '${field}' to a value that does not match the documented format.`,
      );
      steps.push("Send the request.");
      steps.push(
        "Verify the API rejects the request due to format validation failure.",
      );
      break;

    case "negative.string_too_long":
      steps.push(`Prepare a valid request body for ${method} ${path}.`);
      steps.push(
        `Set '${field}' to a string longer than the documented maximum length.`,
      );
      steps.push("Send the request.");
      steps.push(
        "Verify the API rejects the request due to string length validation.",
      );
      break;

    case "negative.numeric_above_maximum":
      steps.push(`Prepare a valid request body for ${method} ${path}.`);
      steps.push(
        `Set '${field}' to a numeric value above the documented maximum.`,
      );
      steps.push("Send the request.");
      steps.push(
        "Verify the API rejects the request due to numeric constraint validation.",
      );
      break;

    case "negative.unsupported_content_type":
      steps.push(`Prepare a valid request for ${method} ${path}.`);
      steps.push(
        "Replace the Content-Type header with an unsupported media type.",
      );
      steps.push("Send the request.");
      steps.push(
        "Verify the API rejects the request due to unsupported content type.",
      );
      break;

    default:
      steps.push(`Prepare a valid request for ${method} ${path}.`);
      steps.push("Send the request.");
      steps.push("Verify the API behavior matches the documented expectation.");
      break;
  }

  return steps;
}
function buildScenarioExpectedResults(plan, endpoint) {
  const statuses = ensureArray(plan?.expected_status_candidates).join(" or ");
  const field = plan.field_target || scenarioSuffix(plan) || "field";
  const family = scenarioFamily(plan);

  switch (family) {
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

    case "success.min_payload": {
      const requiredFields = ensureArray(
        getRequestBodySchema(endpoint)?.required,
      );
      return [
        `Response status should be ${statuses}`,
        "The API should accept the minimal valid payload",
        ...(requiredFields.length > 0
          ? [
              `The accepted payload should include required fields such as: ${requiredFields.join(", ")}`,
            ]
          : []),
        "No validation error should occur for the minimal valid payload",
      ];
    }
    case "schema.request_body":
      return [
        `Response status should be ${statuses}`,
        "Request body should conform to the documented request schema",
        "No request-schema validation error should occur for this valid payload",
      ];

    case "schema.request_required_fields": {
      const requestRequired = ensureArray(
        getRequestBodySchema(endpoint)?.required,
      );
      return [
        `Response status should be ${statuses}`,
        "All documented required request fields should be included",
        ...(requestRequired.length > 0
          ? [`Required request fields include: ${requestRequired.join(", ")}`]
          : []),
      ];
    }

    case "schema.request_field_types": {
      const requestFields = Object.keys(
        getSchemaProperties(getRequestBodySchema(endpoint)),
      );
      return [
        `Response status should be ${statuses}`,
        "Request body fields should use the documented data types",
        ...(requestFields.length > 0
          ? [`Validate request field types for: ${requestFields.join(", ")}`]
          : []),
      ];
    }

    case "success.full_payload": {
      const requestFields = Object.keys(
        buildValidRequest(endpoint, {}, "full").request_body || {},
      );
      return [
        `Response status should be ${statuses}`,
        "The API should accept the full valid payload",
        ...(requestFields.length > 0
          ? [
              `The accepted payload may include fields such as: ${requestFields.join(", ")}`,
            ]
          : []),
        "No validation error should occur for the full valid payload",
      ];
    }

    case "contract.success": {
      const primaryStatus =
        plan?.spec_evidence?.primary_status ||
        ensureArray(plan?.expected_status_candidates)[0] ||
        "200";
      const responseFields = ensureArray(plan?.spec_evidence?.response_fields);

      return [
        `Response status should be ${primaryStatus}`,
        "Response should follow the documented success contract",
        ...(responseFields.length > 0
          ? [
              `Response should include documented fields: ${responseFields.join(", ")}`,
            ]
          : ["Response should not be empty"]),
      ];
    }

    case "contract.status_code": {
      const status =
        plan?.spec_evidence?.status ||
        ensureArray(plan?.expected_status_candidates)[0] ||
        statuses;

      return [
        `Response status should be ${status}`,
        `Returned status code should match documented HTTP ${status}`,
        "No unexpected 4xx or 5xx response should be returned for valid input",
      ];
    }

    case "contract.content_type": {
      const contentTypes = ensureArray(plan?.spec_evidence?.content_types);

      return [
        `Response status should be ${statuses}`,
        ...(contentTypes.length > 0
          ? [
              `Response Content-Type should be one of: ${contentTypes.join(", ")}`,
            ]
          : ["Response should include the documented Content-Type header"]),
        "Returned media type should match the API contract",
      ];
    }

    case "contract.required_fields": {
      const requiredFields = ensureArray(plan?.spec_evidence?.required_fields);

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
        buildValidRequest(endpoint, {}, "full").request_body || {},
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

    case "schema.response": {
      const nestedFields = ensureArray(plan?.spec_evidence?.nested_fields);
      const arrayFields = ensureArray(plan?.spec_evidence?.array_fields);

      return [
        `Response status should be ${statuses}`,
        "Response body should conform to the documented response schema",
        ...(nestedFields.length > 0
          ? [
              `Nested response fields should be valid, including: ${nestedFields.join(", ")}`,
            ]
          : []),
        ...(arrayFields.length > 0
          ? [
              `Array structures should be valid, including: ${arrayFields.join(", ")}`,
            ]
          : []),
        "No undocumented structure should violate schema validation",
      ];
    }

    case "schema.required_fields": {
      const requiredFields = ensureArray(plan?.spec_evidence?.required_fields);

      return [
        `Response status should be ${statuses}`,
        "All schema-required response fields should be present",
        ...(requiredFields.length > 0
          ? [`Schema-required fields include: ${requiredFields.join(", ")}`]
          : []),
      ];
    }

    case "schema.field_types": {
      const typedFields = ensureArray(plan?.spec_evidence?.typed_fields);

      return [
        `Response status should be ${statuses}`,
        "Response fields should use the documented data types",
        ...(typedFields.length > 0
          ? [`Validate documented field types for: ${typedFields.join(", ")}`]
          : []),
      ];
    }

    case "schema.request_body": {
      const nestedFields = ensureArray(plan?.spec_evidence?.nested_fields);
      const arrayFields = ensureArray(plan?.spec_evidence?.array_fields);

      return [
        `Response status should be ${statuses}`,
        "Request body should conform to the documented request schema",
        ...(nestedFields.length > 0
          ? [
              `Nested request fields should be valid, including: ${nestedFields.join(", ")}`,
            ]
          : []),
        ...(arrayFields.length > 0
          ? [
              `Array request structures should be valid, including: ${arrayFields.join(", ")}`,
            ]
          : []),
        "No request-schema validation error should occur for this valid payload",
      ];
    }

    case "negative.empty_body":
      return [
        `Response status should be ${statuses}`,
        "Response should indicate missing required request body",
        "Error message should mention required body fields when available",
        "Request should not be processed successfully",
      ];

    case "negative.below_minimum":
      return [
        `Response status should be ${statuses}`,
        `Field '${field}' should be rejected for being below minimum`,
      ];

    case "negative.above_maximum":
      return [
        `Response status should be ${statuses}`,
        `Field '${field}' should be rejected for exceeding maximum`,
      ];

    case "negative.invalid_enum": {
      const invalidValue =
        plan?.spec_evidence?.invalid_value || "__invalid_enum_value__";
      const enumValues = ensureArray(plan?.spec_evidence?.enum_values);

      return [
        `Response status should be ${statuses}`,
        `Response should indicate that '${field}' contains invalid enum value ${JSON.stringify(invalidValue)}`,
        ...(enumValues.length > 0
          ? [
              `Accepted enum values for '${field}' are limited to: ${enumValues.map((v) => JSON.stringify(v)).join(", ")}`,
            ]
          : []),
        "Request should not be processed successfully",
      ];
    }

    case "negative.null_required_field": {
      const targetField = plan?.spec_evidence?.missing_field || field;
      const requiredFields = ensureArray(plan?.spec_evidence?.required_fields);

      return [
        `Response status should be ${statuses}`,
        `Response should indicate that required field '${targetField}' cannot be null`,
        ...(requiredFields.length > 0
          ? [
              `Other documented required fields remain: ${requiredFields.filter((f) => f !== targetField).join(", ") || "none"}`,
            ]
          : []),
        "Request should not be processed successfully",
      ];
    }
    case "negative.invalid_type": {
      const expectedType = plan?.spec_evidence?.field_type || "documented";
      const invalidValue =
        plan?.spec_evidence?.invalid_value || "__invalid_type_value__";

      return [
        `Response status should be ${statuses}`,
        `Response should indicate that field '${field}' has invalid type`,
        `Response should indicate expected type '${expectedType}' for '${field}'`,
        `Rejected value should be ${JSON.stringify(invalidValue)}`,
        "Request should not be processed successfully",
      ];
    }

    case "negative.invalid_format":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate invalid format for '${field}'`,
        "Request should not be processed successfully",
      ];

    case "negative.string_too_long":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate that '${field}' exceeds maximum length`,
        "Request should not be processed successfully",
      ];

    case "negative.numeric_above_maximum":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate that '${field}' exceeds maximum value`,
        "Request should not be processed successfully",
      ];

    case "negative.missing_required_query":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate that query parameter '${field}' is required`,
        "Request should not be processed successfully",
      ];

    case "negative.missing_required_path":
      return [
        `Response status should be ${statuses}`,
        `Response should indicate that path parameter '${field}' is invalid`,
        "Request should not be processed successfully",
      ];

    case "negative.unsupported_content_type":
      return [
        `Response status should be ${statuses}`,
        "Response should indicate unsupported or invalid Content-Type",
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
  const family = scenarioFamily(plan);

  preconditions.push(
    `Target endpoint ${method} ${endpoint?.path || "/"} is available in the selected environment`,
  );

  if (plan.test_type === "auth") {
    preconditions.push(
      "Endpoint is protected and normally requires valid authentication",
    );
  }

  if (
    plan.test_type === "contract" ||
    family === "success.min_payload" ||
    family === "success.full_payload" ||
    family === "schema.request_body" ||
    family === "schema.request_required_fields" ||
    family === "negative.below_minimum" ||
    family === "negative.above_maximum" ||
    family === "schema.request_field_types"
  ) {
    preconditions.push(
      "A valid request can be constructed from the documented API contract",
    );
  }

  if (
    plan.test_type === "schema" &&
    family !== "schema.request_body" &&
    family !== "schema.request_required_fields" &&
    family !== "schema.request_field_types"
  ) {
    preconditions.push(
      "The endpoint exposes a documented response schema for validation",
    );
  }

  if (
    family === "negative.empty_body" ||
    family === "negative.missing_required_body_field" ||
    family === "negative.invalid_enum" ||
    family === "negative.null_required_field" ||
    family === "negative.invalid_type" ||
    family === "negative.invalid_format" ||
    family === "negative.string_too_long" ||
    family === "negative.numeric_above_maximum" ||
    family === "negative.unsupported_content_type"
  ) {
    preconditions.push("Endpoint accepts request body content");
  }

  return preconditions;
}

function buildValidationFocus(plan, endpoint) {
  const family = scenarioFamily(plan);

  switch (family) {
    case "negative.empty_body":
      return [
        "request.body.required_fields",
        "error.response.structure",
        "status_code.validation",
      ];

    case "negative.missing_required_body_field":
      return [
        "request.body.required_fields",
        "request.body.missing_key_validation",
        "status_code.validation",
      ];

    case "negative.invalid_enum": {
      const enumSource = plan?.spec_evidence?.enum_source || "body";

      return [
        `request.${enumSource}.enum_constraints`,
        "error.response.structure",
        "status_code.validation",
      ];
    }

    case "negative.null_required_field":
      return [
        "request.body.required_fields",
        "request.body.nullability_constraints",
        "status_code.validation",
      ];

    case "negative.invalid_type":
      return [
        "request.body.type_constraints",
        "error.response.structure",
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

    case "negative.unsupported_content_type":
      return [
        "request.content_type.validation",
        "unsupported_media_type_handling",
        "status_code.validation",
      ];

    case "auth.missing_credentials":
    case "auth.invalid_credentials":
      return [
        "authentication.enforcement",
        "error.response.structure",
        "status_code.authorization",
      ];

    case "success.min_payload":
      return [
        "request.body.required_fields",
        "minimal_valid_payload_acceptance",
        "http.success_status",
      ];

    case "success.full_payload":
      return [
        "request.body.contract",
        "full_valid_payload_acceptance",
        "http.success_status",
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

    case "schema.request_body":
      return [
        "request.schema_validation",
        "request.top_level_structure",
        "documented_request_schema_compliance",
      ];

    case "schema.request_required_fields":
      return [
        "request.required_fields",
        "request.key_presence",
        "request_schema_completeness",
      ];

    case "schema.request_field_types":
      return [
        "request.field_types",
        "request.property_types",
        "documented_request_type_compliance",
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
    } else if (mode === "unsupported_content_type") {
      next.headers["Content-Type"] = "application/unsupported";
    }

    return next;
  }

  if (location === "query") {
    next.query_params = next.query_params || {};

    if (mode === "missing" && field) {
      delete next.query_params[field];
    }

    if (mode === "invalid_enum" && field) {
      next.query_params[field] =
        invalidate.invalid_value || "__invalid_enum_value__";
    }

    return next;
  }

  if (location === "path") {
    next.path_params = next.path_params || {};

    if (mode === "missing_or_malformed" && field) {
      next.path_params[field] = "";
    }

    if (mode === "invalid_enum" && field) {
      next.path_params[field] =
        invalidate.invalid_value || "__invalid_enum_value__";
    }

    return next;
  }

  if (location === "body") {
    if (mode === "empty_body") {
      next.request_body = undefined;
      return next;
    }

    next.request_body = isObject(next.request_body) ? next.request_body : {};

    if (mode === "missing_required_field" && field) {
      delete next.request_body[field];
    }

    if (mode === "invalid_enum" && field) {
      next.request_body[field] =
        invalidate.invalid_value || "__invalid_enum_value__";
    }

    if (mode === "null" && field) {
      next.request_body[field] = null;
    }
    if (mode === "invalid_type" && field) {
      next.request_body[field] =
        invalidate.invalid_value || "__invalid_type_value__";
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
    if (mode === "below_minimum" && field) {
      next.request_body[field] = invalidate.invalid_value;
    }

    if (mode === "above_maximum" && field) {
      next.request_body[field] = invalidate.invalid_value;
    }

    return next;
  }

  return next;
}

export function buildCaseFromScenarioPlan(endpoint, profile, plan) {
  const family = scenarioFamily(plan);

  let validReq;
  if (family === "success.min_payload") {
    validReq = buildValidRequest(endpoint, profile, "minimal");
  } else {
    validReq = buildValidRequest(endpoint, profile, "full");
  }

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
        : family === "success.min_payload" ||
            family === "success.full_payload" ||
            family === "contract.success" ||
            family === "schema.response"
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
      required_fields: ensureArray(
        getRequestBodySchema(endpoint, profile)?.required,
      ),
    },
  };
}

export function validateScenarioCase(tc, profile, plan) {
  const errors = [];
  const family = scenarioFamily(plan);

  const expectedJoined = ensureArray(tc?.expected_results)
    .join(" ")
    .toLowerCase();

  const stepsJoined = ensureArray(tc?.steps).join(" ").toLowerCase();

  const hasExplicit2xxStatus = /\b2\d\d\b/.test(expectedJoined);

  const hasPositiveSuccessLanguage =
    /\b(success|successful|accepted|completed)\b/.test(expectedJoined) &&
    !/\b(not|no|without|reject|rejected|fail|failed|unauthorized|forbidden|invalid|unsupported)\b/.test(
      expectedJoined,
    );

  if (
    (plan?.expected_outcome_family === "auth_failure" ||
      tc?.test_type === "auth") &&
    (hasExplicit2xxStatus || hasPositiveSuccessLanguage)
  ) {
    errors.push("Auth scenario contains success expectation.");
  }

  if (
    (plan?.expected_outcome_family === "validation_failure" ||
      tc?.test_type === "negative") &&
    (hasExplicit2xxStatus || hasPositiveSuccessLanguage)
  ) {
    errors.push("Negative scenario contains success expectation.");
  }

  if (
    isScenario(plan, "negative.missing_required_query") &&
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
    isScenario(plan, "auth.missing_credentials") &&
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
    isScenario(plan, "negative.empty_body") &&
    tc?.test_data?.request_body !== undefined
  ) {
    errors.push("Empty-body scenario still contains a request body.");
  }

  if (
    isScenario(plan, "negative.unsupported_content_type") &&
    lower(tc?.test_data?.headers?.["Content-Type"]) !==
      "application/unsupported"
  ) {
    errors.push(
      "Unsupported-content-type scenario did not set the invalid Content-Type header.",
    );
  }

  if (
    isScenario(plan, "success.min_payload") &&
    isObject(tc?.test_data?.request_body)
  ) {
    const keys = Object.keys(tc.test_data.request_body || {});
    const expectedRequired = ensureArray(tc?.meta?.required_fields || []);

    if (
      expectedRequired.length > 0 &&
      keys.some((k) => !expectedRequired.includes(k))
    ) {
      errors.push(
        "Minimal-payload scenario contains non-required body fields.",
      );
    }
  }

  if (
    isScenario(plan, "negative.missing_required_body_field") &&
    plan?.field_target &&
    tc?.test_data?.request_body &&
    Object.prototype.hasOwnProperty.call(
      tc.test_data.request_body,
      plan.field_target,
    )
  ) {
    errors.push(
      "Missing-required-body-field scenario still contains the targeted request body field.",
    );
  }
  if (
    isScenario(plan, "negative.invalid_type") &&
    plan?.field_target &&
    tc?.test_data?.request_body &&
    tc.test_data.request_body[plan.field_target] === undefined
  ) {
    errors.push(
      "Invalid-type scenario did not set a value for the targeted request body field.",
    );
  }

  if (
    isScenario(plan, "negative.invalid_type") &&
    plan?.field_target &&
    !stepsJoined.includes(String(plan?.field_target || "").toLowerCase())
  ) {
    errors.push(
      "Invalid-type scenario steps do not mention the targeted body field.",
    );
  }
  return {
    is_valid: errors.length === 0,
    errors,
  };
}
