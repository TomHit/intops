import { TEMPLATE_REGISTRY } from "./templateRegistry.js";
import { resolveEndpointTestData } from "./testDataResolver.js";

import { evaluateRules } from "../engine/evaluateRules.js";
import {
  buildScenarioPlans,
  buildCaseFromScenarioPlan,
  validateScenarioCase,
} from "./scenarioEngine.js";
/* ------------------ BASIC HELPERS ------------------ */

function firstItem(list) {
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}
function isScenarioOwnedTemplateKey(templateKey) {
  const key = String(templateKey || "")
    .trim()
    .toLowerCase();
  return key.startsWith("negative.") || key.startsWith("auth.");
}

function shouldUseScenarioOwnership(rule, scenarioTemplateKeys) {
  const templateKey = getTemplateKey(rule);
  if (!templateKey) return false;
  if (!isScenarioOwnedTemplateKey(templateKey)) return false;
  return scenarioTemplateKeys.has(templateKey);
}

function getReferenceByPrefix(tc, prefix) {
  const refs = Array.isArray(tc?.references) ? tc.references : [];
  return (
    refs.find((x) =>
      String(x || "")
        .toLowerCase()
        .startsWith(prefix.toLowerCase()),
    ) || ""
  );
}

function getTemplateKeyFromCase(tc) {
  return getReferenceByPrefix(tc, "template_key:")
    .replace(/^template_key:/i, "")
    .trim()
    .toLowerCase();
}

function firstByLocation(list, location) {
  const items = Array.isArray(list) ? list : [];
  return items.find((x) => x?.location === location) || items[0] || null;
}

function mergeObjects(base, extra) {
  return {
    ...(base && typeof base === "object" ? base : {}),
    ...(extra && typeof extra === "object" ? extra : {}),
  };
}

function lc(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function paramName(param) {
  return String(param?.name || "").trim();
}

function isInternalOrDebugParam(name) {
  const n = lc(name);
  return (
    n.startsWith("debug_") || n.startsWith("trace_") || n.startsWith("test_")
  );
}

function findParamByName(list, name) {
  const target = lc(name);
  return (Array.isArray(list) ? list : []).find((p) => lc(p?.name) === target);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensureObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

/* ------------------ GENERIC VALUE RESOLVER ------------------ */

function semanticSampleValue(name, schema = {}) {
  const n = lc(name);
  const type = lc(schema?.type);
  const format = lc(schema?.format);

  if (Array.isArray(schema?.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }

  if (schema?.example !== undefined) return schema.example;
  if (schema?.default !== undefined) return schema.default;

  if (n === "accept") return "application/json";
  if (n === "content-type") return "application/json";
  if (n.includes("email")) return "qa.user@example.com";
  if (n === "id" || n.endsWith("id") || n.endsWith("_id")) return "12345";

  if (format === "uuid") return "123e4567-e89b-12d3-a456-426614174000";
  if (format === "date-time") return "2026-01-01T00:00:00Z";
  if (format === "date") return "2026-01-01";

  if (type === "boolean") return false;
  if (type === "integer" || type === "number") return 1;
  if (type === "array") return [];
  if (type === "object") return {};

  return "sample_value";
}

function normalizeParamValue(name, schema, currentValue) {
  if (
    currentValue === undefined ||
    currentValue === null ||
    currentValue === ""
  ) {
    return semanticSampleValue(name, schema);
  }

  if (Array.isArray(schema?.enum) && schema.enum.length > 0) {
    return schema.enum.includes(currentValue) ? currentValue : schema.enum[0];
  }

  const n = lc(name);

  if (n === "accept") return "application/json";
  if (n === "content-type") return "application/json";

  return currentValue;
}

/* ------------------ REQUEST BUILDERS ------------------ */

function buildPositiveParams(
  paramDefs,
  resolvedValues = {},
  { includeOptional = false } = {},
) {
  const out = {};
  const defs = Array.isArray(paramDefs) ? paramDefs : [];

  for (const param of defs) {
    const name = paramName(param);
    if (!name) continue;
    if (isInternalOrDebugParam(name)) continue;
    if (!includeOptional && !param?.required) continue;

    const schema = param?.schema || {};
    const existing = resolvedValues?.[name];
    out[name] = normalizeParamValue(name, schema, existing);
  }

  return out;
}

function keepUsefulHeaders(endpoint, resolvedHeaders = {}) {
  const headerDefs = endpoint?.params?.header || [];
  const out = {};

  for (const param of headerDefs) {
    const name = paramName(param);
    if (!name) continue;
    if (isInternalOrDebugParam(name)) continue;

    if (
      !param?.required &&
      lc(name) !== "accept" &&
      lc(name) !== "content-type"
    ) {
      continue;
    }

    const schema = param?.schema || {};
    const existing =
      resolvedHeaders?.[name] ??
      resolvedHeaders?.[name?.toLowerCase?.()] ??
      resolvedHeaders?.[
        Object.keys(resolvedHeaders || {}).find((k) => lc(k) === lc(name))
      ];

    out[name] = normalizeParamValue(name, schema, existing);
  }

  if (!("Accept" in out) && !("accept" in out)) {
    out.Accept = "application/json";
  }

  return out;
}

function alignDeviceValues(request) {
  const next = {
    path_params: { ...(request?.path_params || {}) },
    query_params: { ...(request?.query_params || {}) },
    headers: { ...(request?.headers || {}) },
    cookies: { ...(request?.cookies || {}) },
    request_body: request?.request_body,
  };

  const q = next.query_params;
  const h = next.headers;

  const queryDeviceKey = Object.keys(q).find((k) =>
    ["device", "deviceid", "device_id"].includes(lc(k)),
  );
  const headerDeviceKey = Object.keys(h).find((k) => lc(k) === "x-device-id");

  const unifiedDevice =
    (queryDeviceKey && q[queryDeviceKey]) ||
    (headerDeviceKey && h[headerDeviceKey]);

  if (!unifiedDevice) return next;

  if (queryDeviceKey) q[queryDeviceKey] = unifiedDevice;
  if (headerDeviceKey) h[headerDeviceKey] = unifiedDevice;

  return next;
}

function buildMinimalPositiveRequest(endpoint, resolved) {
  const pathParams = buildPositiveParams(
    endpoint?.params?.path || [],
    resolved?.valid?.path || {},
    { includeOptional: true },
  );

  const queryParams = buildPositiveParams(
    endpoint?.params?.query || [],
    resolved?.valid?.query || {},
    { includeOptional: false },
  );

  const headers = keepUsefulHeaders(endpoint, resolved?.valid?.headers || {});

  return alignDeviceValues({
    path_params: pathParams,
    query_params: queryParams,
    headers,
    cookies: resolved?.valid?.cookies || {},
    request_body: resolved?.valid?.body,
  });
}

function sanitizePositiveQueryParams(endpoint, query = {}) {
  const defs = endpoint?.params?.query || [];
  const out = {};

  for (const [key, value] of Object.entries(query || {})) {
    if (isInternalOrDebugParam(key)) continue;

    const def = findParamByName(defs, key);
    out[key] = normalizeParamValue(key, def?.schema || {}, value);
  }

  return out;
}

function sanitizePositiveHeaders(endpoint, headers = {}) {
  const defs = endpoint?.params?.header || [];
  const out = {};

  for (const [key, value] of Object.entries(headers || {})) {
    if (isInternalOrDebugParam(key)) continue;

    const def = findParamByName(defs, key);
    out[key] = normalizeParamValue(key, def?.schema || {}, value);
  }

  if (!("Accept" in out) && !("accept" in out)) {
    out.Accept = "application/json";
  }

  const normalized = {};
  for (const [key, value] of Object.entries(out)) {
    if (lc(key) === "x-device-id") normalized["X-Device-Id"] = value;
    else if (lc(key) === "accept") normalized["Accept"] = "application/json";
    else normalized[key] = value;
  }

  return normalized;
}

function sanitizePositivePathParams(endpoint, pathParams = {}) {
  const defs = endpoint?.params?.path || [];
  const out = {};

  for (const [key, value] of Object.entries(pathParams || {})) {
    const def = findParamByName(defs, key);
    out[key] = normalizeParamValue(key, def?.schema || {}, value);
  }

  return out;
}

function sanitizePositiveTestData(endpoint, testData = {}) {
  const cleaned = {
    path_params: sanitizePositivePathParams(
      endpoint,
      testData?.path_params || {},
    ),
    query_params: sanitizePositiveQueryParams(
      endpoint,
      testData?.query_params || {},
    ),
    headers: sanitizePositiveHeaders(endpoint, testData?.headers || {}),
    cookies: testData?.cookies || {},
    request_body: testData?.request_body,
  };

  return alignDeviceValues(cleaned);
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function trimLeadingSlash(value) {
  return String(value || "").replace(/^\/+/, "");
}

function joinUrlParts(base, path) {
  const b = trimTrailingSlash(base);
  const p = trimLeadingSlash(path);
  if (!b) return path || "/";
  if (!p) return b || "/";
  return `${b}/${p}`;
}

function buildBaseUrl(endpoint) {
  const serverUrl =
    Array.isArray(endpoint?.servers) && endpoint.servers.length > 0
      ? endpoint.servers[0]?.url
      : "";

  if (serverUrl) {
    return trimTrailingSlash(serverUrl);
  }

  const scheme =
    Array.isArray(endpoint?.schemes) && endpoint.schemes.length > 0
      ? endpoint.schemes[0]
      : "https";

  const host = String(endpoint?.host || "").trim();
  const basePath = String(endpoint?.basePath || "").trim();

  if (host) {
    return trimTrailingSlash(`${scheme}://${host}${basePath}`);
  }

  return trimTrailingSlash(basePath);
}

function resolvePathTemplate(path, pathParams = {}) {
  let out = String(path || "/");

  for (const [key, value] of Object.entries(pathParams || {})) {
    out = out.replaceAll(`{${key}}`, encodeURIComponent(String(value)));
  }

  return out;
}

function buildQueryString(queryParams = {}) {
  const pairs = [];

  for (const [key, value] of Object.entries(queryParams || {})) {
    if (value === undefined || value === null || value === "") continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        pairs.push(
          `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`,
        );
      }
      continue;
    }

    if (typeof value === "object") {
      pairs.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(value))}`,
      );
      continue;
    }

    pairs.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    );
  }

  return pairs.length > 0 ? `?${pairs.join("&")}` : "";
}

function buildEndpointUrls(endpoint, testData = {}, apiPath = "/") {
  const baseUrl = buildBaseUrl(endpoint);
  const rawPath = String(apiPath || endpoint?.path || "/");
  const resolvedPath = resolvePathTemplate(
    rawPath,
    testData?.path_params || {},
  );
  const queryString = buildQueryString(testData?.query_params || {});

  return {
    base_url: baseUrl,
    full_url_template: joinUrlParts(baseUrl, rawPath),
    full_url_resolved: `${joinUrlParts(baseUrl, resolvedPath)}${queryString}`,
  };
}

/* ------------------ TEMPLATE HANDLING ------------------ */

function isPositiveTemplateKey(templateKey) {
  const key = String(templateKey || "")
    .trim()
    .toLowerCase();
  return (
    key.startsWith("contract.") ||
    key.startsWith("schema.") ||
    key === "auth.valid_credentials"
  );
}

/* ------------------ DATA RESOLUTION ------------------ */

function inferResolvedTestData(templateKey, endpoint) {
  const resolved =
    endpoint?._resolvedTestData || resolveEndpointTestData(endpoint);

  const validRequest = isPositiveTemplateKey(templateKey)
    ? buildMinimalPositiveRequest(endpoint, resolved)
    : {
        path_params: resolved?.valid?.path || {},
        query_params: resolved?.valid?.query || {},
        headers: resolved?.valid?.headers || {},
        cookies: resolved?.valid?.cookies || {},
        request_body: resolved?.valid?.body,
      };

  switch (templateKey) {
    case "negative.missing_required_query":
      return (
        firstByLocation(resolved?.negative?.missingRequired, "query")
          ?.request || validRequest
      );

    case "negative.missing_required_path":
      return (
        firstByLocation(resolved?.negative?.missingRequired, "path")?.request ||
        validRequest
      );

    case "negative.empty_body":
      return (
        firstByLocation(resolved?.negative?.missingRequired, "body")
          ?.request || {
          ...validRequest,
          request_body: undefined,
        }
      );

    case "negative.invalid_query_type":
      return (
        firstItem(resolved?.negative?.invalidType)?.request || validRequest
      );

    case "negative.invalid_enum":
      return (
        firstItem(resolved?.negative?.invalidEnum)?.request || validRequest
      );

    case "negative.invalid_format":
      return (
        firstItem(resolved?.negative?.invalidFormat)?.request || validRequest
      );

    case "negative.string_too_long":
      return (
        firstItem(resolved?.negative?.stringTooLong)?.request || validRequest
      );

    case "negative.numeric_above_maximum":
      return (
        firstItem(resolved?.negative?.numericAboveMaximum)?.request ||
        validRequest
      );

    case "negative.null_required_field":
      return (
        firstItem(resolved?.negative?.nullRequiredField)?.request ||
        validRequest
      );

    case "negative.invalid_content_type":
      return {
        ...validRequest,
        headers: {
          ...(validRequest.headers || {}),
          "Content-Type": "text/plain",
        },
      };

    case "negative.malformed_json":
      return {
        ...validRequest,
        headers: {
          ...(validRequest.headers || {}),
          "Content-Type": "application/json",
        },
        request_body: "{invalid-json",
      };

    case "negative.additional_property": {
      const body = resolved?.valid?.body;
      if (body && typeof body === "object" && !Array.isArray(body)) {
        return {
          ...validRequest,
          request_body: {
            ...body,
            unexpectedProperty: "extra-value",
          },
        };
      }
      return validRequest;
    }

    case "negative.invalid_pagination": {
      const query = { ...(validRequest.query_params || {}) };

      if ("page" in query) query.page = -1;
      else if ("limit" in query) query.limit = -1;
      else if ("offset" in query) query.offset = -1;
      else if ("page_size" in query) query.page_size = -1;
      else if ("pagesize" in query) query.pagesize = -1;
      else if ("per_page" in query) query.per_page = -1;
      else if ("size" in query) query.size = -1;
      else if ("cursor" in query) query.cursor = "invalid-cursor";
      else query.page = -1;

      return {
        ...validRequest,
        query_params: query,
      };
    }

    case "negative.resource_not_found": {
      const pathParams = { ...(validRequest.path_params || {}) };
      const keys = Object.keys(pathParams);

      if (keys.length > 0) {
        pathParams[keys[0]] = "999999999";
      } else {
        pathParams.id = "999999999";
      }

      return {
        ...validRequest,
        path_params: pathParams,
      };
    }

    case "negative.conflict": {
      const body = resolved?.valid?.body;
      if (body && typeof body === "object" && !Array.isArray(body)) {
        return {
          ...validRequest,
          request_body: {
            ...body,
          },
        };
      }
      return validRequest;
    }

    case "negative.rate_limit":
      return validRequest;

    case "negative.unsupported_method":
      return validRequest;

    case "auth.missing_credentials": {
      const headers = { ...(validRequest.headers || {}) };

      delete headers.Authorization;
      delete headers.authorization;
      delete headers["X-API-Key"];
      delete headers["x-api-key"];
      delete headers.Cookie;
      delete headers.cookie;

      return {
        ...validRequest,
        headers,
      };
    }

    case "auth.invalid_credentials": {
      const headers = { ...(validRequest.headers || {}) };

      if ("Authorization" in headers || "authorization" in headers) {
        headers.Authorization = "Bearer invalid-token";
        delete headers.authorization;
      } else if ("X-API-Key" in headers || "x-api-key" in headers) {
        headers["X-API-Key"] = "invalid-api-key";
        delete headers["x-api-key"];
      } else if ("Cookie" in headers || "cookie" in headers) {
        headers.Cookie = "session=invalid-session";
        delete headers.cookie;
      } else {
        headers.Authorization = "Bearer invalid-token";
      }

      return {
        ...validRequest,
        headers,
      };
    }

    case "auth.expired_credentials": {
      const headers = { ...(validRequest.headers || {}) };

      if ("Authorization" in headers || "authorization" in headers) {
        headers.Authorization = "Bearer expired-token";
        delete headers.authorization;
      } else if ("Cookie" in headers || "cookie" in headers) {
        headers.Cookie = "session=expired-session";
        delete headers.cookie;
      } else {
        headers.Authorization = "Bearer expired-token";
      }

      return {
        ...validRequest,
        headers,
      };
    }

    case "auth.forbidden_role": {
      const headers = { ...(validRequest.headers || {}) };

      if ("Authorization" in headers || "authorization" in headers) {
        headers.Authorization = "Bearer valid-but-low-privilege-token";
        delete headers.authorization;
      } else {
        headers.Authorization = "Bearer valid-but-low-privilege-token";
      }

      return {
        ...validRequest,
        headers,
      };
    }

    default:
      return validRequest;
  }
}

/* ------------------ CASE ANNOTATION ------------------ */

function annotateCase(tc, rule, endpoint) {
  if (!tc) return null;

  tc.references = ensureArray(tc.references);
  tc.preconditions = ensureArray(tc.preconditions);
  tc.steps = ensureArray(tc.steps);
  tc.expected_results = ensureArray(tc.expected_results);
  tc.validation_focus = ensureArray(tc.validation_focus);
  tc.test_data = ensureObject(tc.test_data);

  tc.api_details = {
    method: String(
      tc?.api_details?.method || endpoint?.method || "GET",
    ).toUpperCase(),
    path: tc?.api_details?.path || endpoint?.path || "/",
  };

  if (rule?.rule_id) {
    tc.references.push(`rule_id:${rule.rule_id}`);
  }
  if (rule?.scenario) {
    tc.references.push(`scenario:${rule.scenario}`);
  }

  const templateKey = getTemplateKey(rule);
  if (templateKey) {
    tc.references.push(`template_key:${templateKey}`);
  }

  if (rule?.category && !tc.test_type) {
    tc.test_type = String(rule.category).toLowerCase();
  }

  if (!tc.module) {
    tc.module =
      (Array.isArray(endpoint?.tags) && endpoint.tags[0]) ||
      String(endpoint?.path || "")
        .split("/")
        .filter(Boolean)[0] ||
      "Default";
  }

  if (typeof tc.review_notes !== "string") {
    tc.review_notes = rule?.notes ? String(rule.notes) : "";
  } else if (!tc.review_notes && rule?.notes) {
    tc.review_notes = String(rule.notes);
  }

  if (typeof tc.needs_review !== "boolean") {
    tc.needs_review = false;
  }

  const resolvedData = inferResolvedTestData(templateKey, endpoint);

  const mergedTestData = {
    path_params: mergeObjects(
      resolvedData?.path_params,
      tc?.test_data?.path_params,
    ),
    query_params: mergeObjects(
      resolvedData?.query_params,
      tc?.test_data?.query_params,
    ),
    headers: mergeObjects(resolvedData?.headers, tc?.test_data?.headers),
    cookies: mergeObjects(resolvedData?.cookies, tc?.test_data?.cookies),
    request_body:
      tc?.test_data?.request_body !== undefined &&
      tc?.test_data?.request_body !== null
        ? tc.test_data.request_body
        : resolvedData?.request_body,
  };

  tc.test_data = isPositiveTemplateKey(templateKey)
    ? sanitizePositiveTestData(endpoint, mergedTestData)
    : mergedTestData;

  if (endpoint?.requires_auth) {
    tc.test_data.headers = {
      ...(tc.test_data.headers || {}),
      Authorization:
        tc.test_data.headers?.Authorization || "Bearer <valid_token>",
    };
  }

  if (tc.api_details.method === "GET") {
    delete tc.test_data.request_body;
  }

  if (
    ["POST", "PUT", "PATCH"].includes(tc.api_details.method) &&
    (tc.test_data.request_body === undefined ||
      tc.test_data.request_body === null ||
      (typeof tc.test_data.request_body === "object" &&
        !Array.isArray(tc.test_data.request_body) &&
        Object.keys(tc.test_data.request_body).length === 0))
  ) {
    tc.needs_review = true;

    if (!tc.review_notes) {
      tc.review_notes =
        "Request body could not be fully resolved from the API specification.";
    }
  }

  const urls = buildEndpointUrls(
    endpoint,
    tc.test_data,
    tc?.api_details?.path || endpoint?.path || "/",
  );

  tc.api_details = {
    ...tc.api_details,
    base_url: urls.base_url,
    full_url_template: urls.full_url_template,
    full_url_resolved: urls.full_url_resolved,
  };

  return tc;
}

/* ------------------ RULE HANDLING ------------------ */

function resolveLegacyTemplateKey(rule) {
  const category = String(rule?.category || "").toLowerCase();
  const appliesWhen = String(rule?.applies_when || "").trim();
  const ruleId = String(rule?.rule_id || "").trim();

  if (category === "contract") {
    if (
      ruleId === "CONTRACT_001" ||
      appliesWhen === "endpoint_exists" ||
      appliesWhen === "success_response_documented"
    ) {
      return "contract.success";
    }

    if (
      ruleId === "CONTRACT_005" ||
      appliesWhen === "response_has_required_fields"
    ) {
      return "contract.required_fields";
    }

    if (
      ruleId === "CONTRACT_004" ||
      appliesWhen === "endpoint_has_documented_success_status"
    ) {
      return "contract.status_code";
    }

    if (
      ruleId === "CONTRACT_002" ||
      appliesWhen === "response_content_type_documented"
    ) {
      return "contract.content_type";
    }

    if (
      ruleId === "CONTRACT_003" ||
      appliesWhen === "response_headers_documented"
    ) {
      return "contract.response_headers";
    }

    if (
      ruleId === "CONTRACT_008" ||
      appliesWhen === "endpoint_has_query_params" ||
      appliesWhen === "query_params_documented"
    ) {
      return "contract.query_params";
    }

    if (
      ruleId === "CONTRACT_009" ||
      appliesWhen === "endpoint_has_path_params" ||
      appliesWhen === "path_params_documented"
    ) {
      return "contract.path_params";
    }

    if (
      ruleId === "CONTRACT_010" ||
      appliesWhen === "request_body_schema_exists" ||
      appliesWhen === "request_body_documented"
    ) {
      return "contract.request_body";
    }

    if (
      ruleId === "CONTRACT_012" ||
      ruleId === "CONTRACT_013" ||
      appliesWhen === "error_responses_documented" ||
      appliesWhen === "operation_metadata_exists"
    ) {
      return "contract.error_response";
    }

    return "contract.success";
  }

  if (category === "schema") {
    if (
      appliesWhen === "request_body_schema_exists" ||
      appliesWhen === "request_body_has_required_fields" ||
      appliesWhen === "method_is_post_and_has_request_body" ||
      appliesWhen === "method_is_put_or_patch_and_has_request_body"
    ) {
      return "schema.request_body";
    }

    if (ruleId === "SCHEMA_001" || appliesWhen === "response_schema_exists") {
      return "schema.response";
    }

    if (
      ruleId === "SCHEMA_002" ||
      appliesWhen === "response_schema_has_required_fields"
    ) {
      return "schema.required_fields";
    }

    if (
      ruleId === "SCHEMA_003" ||
      appliesWhen === "response_schema_has_typed_fields"
    ) {
      return "schema.field_types";
    }

    if (
      ruleId === "SCHEMA_004" ||
      appliesWhen === "response_schema_has_enum_fields"
    ) {
      return "schema.enum";
    }

    if (
      ruleId === "SCHEMA_005" ||
      appliesWhen === "response_schema_has_nested_objects"
    ) {
      return "schema.nested_objects";
    }

    if (
      ruleId === "SCHEMA_006" ||
      appliesWhen === "response_schema_has_array_fields"
    ) {
      return "schema.array";
    }

    if (
      ruleId === "SCHEMA_007" ||
      appliesWhen === "response_schema_has_format_fields"
    ) {
      return "schema.format";
    }

    if (
      ruleId === "SCHEMA_008" ||
      appliesWhen === "response_schema_has_numeric_constraints"
    ) {
      return "schema.numeric_constraints";
    }

    if (
      ruleId === "SCHEMA_009" ||
      appliesWhen === "response_schema_has_string_constraints"
    ) {
      return "schema.string_constraints";
    }

    if (
      ruleId === "SCHEMA_010" ||
      appliesWhen === "response_schema_has_pattern_fields"
    ) {
      return "schema.pattern";
    }

    if (ruleId === "SCHEMA_011" || appliesWhen === "schema_has_composition") {
      return "schema.composition";
    }

    return "schema.response";
  }

  if (category === "negative") {
    if (
      ruleId === "NEGATIVE_001" ||
      appliesWhen === "endpoint_has_required_query"
    ) {
      return "negative.missing_required_query";
    }

    if (
      ruleId === "NEGATIVE_002" ||
      appliesWhen === "endpoint_has_path_params"
    ) {
      return "negative.missing_required_path";
    }

    if (
      ruleId === "NEGATIVE_003" ||
      appliesWhen === "query_params_have_typed_schema"
    ) {
      return "negative.invalid_query_type";
    }

    if (
      ruleId === "NEGATIVE_004" ||
      appliesWhen === "response_or_request_schema_has_enum" ||
      appliesWhen === "query_or_body_has_enum"
    ) {
      return "negative.invalid_enum";
    }

    if (
      ruleId === "NEGATIVE_005" ||
      appliesWhen === "schema_has_string_format" ||
      appliesWhen === "schema_has_date_or_datetime_fields" ||
      appliesWhen === "query_or_body_has_format"
    ) {
      return "negative.invalid_format";
    }

    if (
      ruleId === "NEGATIVE_006" ||
      appliesWhen === "schema_has_string_constraints" ||
      appliesWhen === "query_or_body_has_string_max_length"
    ) {
      return "negative.string_too_long";
    }

    if (
      ruleId === "NEGATIVE_007" ||
      appliesWhen === "schema_has_numeric_constraints" ||
      appliesWhen === "query_or_body_has_numeric_maximum"
    ) {
      return "negative.numeric_above_maximum";
    }

    if (
      ruleId === "NEGATIVE_008" ||
      appliesWhen === "request_body_schema_controls_additional_properties" ||
      appliesWhen === "request_body_is_object"
    ) {
      return "negative.additional_property";
    }

    if (ruleId === "NEGATIVE_009" || appliesWhen === "endpoint_can_conflict") {
      return "negative.conflict";
    }

    if (
      ruleId === "NEGATIVE_010" ||
      appliesWhen === "endpoint_has_rate_limit_contract"
    ) {
      return "negative.rate_limit";
    }

    if (
      ruleId === "NEGATIVE_011" ||
      appliesWhen === "endpoint_has_pagination_params" ||
      appliesWhen === "endpoint_has_pagination"
    ) {
      return "negative.invalid_pagination";
    }

    if (
      ruleId === "NEGATIVE_012" ||
      appliesWhen === "request_body_has_required_fields"
    ) {
      return "negative.null_required_field";
    }

    if (ruleId === "NEGATIVE_018" || appliesWhen === "endpoint_exists") {
      return "negative.unsupported_method";
    }

    if (
      ruleId === "NEGATIVE_019" ||
      ruleId === "NEGATIVE_107" ||
      appliesWhen === "request_body_schema_exists"
    ) {
      return "negative.invalid_content_type";
    }

    if (ruleId === "NEGATIVE_020" || ruleId === "NEGATIVE_113") {
      return "negative.malformed_json";
    }

    if (ruleId === "NEGATIVE_021" || appliesWhen === "request_body_required") {
      return "negative.empty_body";
    }

    if (
      ruleId === "NEGATIVE_024" ||
      appliesWhen === "endpoint_has_resource_identifier"
    ) {
      return "negative.resource_not_found";
    }

    if (ruleId === "NEGATIVE_014" || appliesWhen === "endpoint_requires_auth") {
      return "auth.missing_credentials";
    }

    if (ruleId === "NEGATIVE_015") {
      return "auth.invalid_credentials";
    }

    if (ruleId === "NEGATIVE_016") {
      return "auth.expired_credentials";
    }

    if (
      ruleId === "NEGATIVE_017" ||
      appliesWhen === "endpoint_requires_role_scope"
    ) {
      return "auth.forbidden_role";
    }

    return "negative.missing_required_query";
  }

  if (category === "auth") {
    if (ruleId === "AUTH_001" || appliesWhen === "endpoint_requires_auth") {
      return "auth.missing_credentials";
    }

    if (ruleId === "AUTH_002") {
      return "auth.invalid_credentials";
    }

    if (ruleId === "AUTH_003") {
      return "auth.expired_credentials";
    }

    if (
      ruleId === "AUTH_004" ||
      appliesWhen === "endpoint_requires_role_scope"
    ) {
      return "auth.forbidden_role";
    }

    return "auth.missing_credentials";
  }

  return "";
}

function getTemplateKey(rule) {
  const direct = String(rule?.template_key || "").trim();
  if (direct) return direct;
  return resolveLegacyTemplateKey(rule);
}

function buildCaseFromCsvRule(rule, endpoint) {
  const templateKey = getTemplateKey(rule);
  const fn = TEMPLATE_REGISTRY[templateKey];

  if (!fn) {
    console.warn(
      `No template found for rule ${rule?.rule_id || "UNKNOWN"} using template_key=${templateKey}`,
    );
    return null;
  }

  return annotateCase(fn(endpoint), rule, endpoint);
}

async function resolveCsvRules(endpoint, options = {}) {
  const result = await evaluateRules(endpoint, options);
  return Array.isArray(result) ? result : result?.rules || [];
}

/* ------------------ MAIN GENERATION ------------------ */

function normalizeDedupText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getReferenceValue(tc, prefix) {
  const refs = Array.isArray(tc?.references) ? tc.references : [];
  const found = refs.find((x) =>
    String(x || "")
      .toLowerCase()
      .startsWith(prefix),
  );
  return found ? normalizeDedupText(found) : "";
}

function buildDedupKey(tc) {
  const method = String(
    tc?.api_details?.method || tc?.method || "GET",
  ).toUpperCase();

  const path = String(tc?.api_details?.path || tc?.path || "/").trim();

  const testType = normalizeDedupText(tc?.test_type);

  const title = normalizeDedupText(tc?.title);
  const objective = normalizeDedupText(tc?.objective);

  // Include test data fingerprint for uniqueness
  const testData = JSON.stringify(tc?.test_data || {});

  return `${method}|${path}|${testType}|${title}|${objective}|${testData}`;
}

function dedupeCases(cases) {
  const out = [];
  const seen = new Set();

  for (const tc of ensureArray(cases)) {
    const key = buildDedupKey(tc);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tc);
  }

  return out;
}

export async function generateCasesForEndpoint(endpoint, options = {}) {
  const enrichedEndpoint = {
    ...endpoint,
    _resolvedTestData: resolveEndpointTestData(endpoint),
  };

  const evalResult = await evaluateRules(enrichedEndpoint, options);
  const profile = evalResult?.profile || {};
  const matchedRules = Array.isArray(evalResult?.rules) ? evalResult.rules : [];

  const cases = [];

  const scenarioPlans = buildScenarioPlans(
    enrichedEndpoint,
    profile,
    matchedRules,
  );

  const scenarioTemplateKeys = new Set(
    scenarioPlans.map((p) => p?.template_key).filter(Boolean),
  );

  for (const plan of scenarioPlans) {
    try {
      const tc = buildCaseFromScenarioPlan(enrichedEndpoint, profile, plan);
      const validation = validateScenarioCase(tc, profile, plan);

      if (!validation.is_valid) {
        console.warn("Scenario case rejected:", {
          scenario_id: plan?.scenario_id,
          template_key: plan?.template_key,
          errors: validation.errors,
        });
        continue;
      }

      cases.push(tc);
    } catch (err) {
      console.error(
        `Scenario plan build failed for ${plan?.template_key || "unknown"}`,
        err,
      );
    }
  }

  for (const rule of matchedRules) {
    try {
      const templateKey = getTemplateKey(rule);

      if (scenarioTemplateKeys.has(templateKey)) {
        continue;
      }

      const tc = buildCaseFromCsvRule(rule, enrichedEndpoint);
      if (tc) {
        cases.push(tc);
      }
    } catch (err) {
      console.error(
        `Template build failed for CSV rule: ${rule?.rule_id || "UNKNOWN"}`,
        err,
      );
    }
  }

  return dedupeCases(cases);
}

function isGenericTitle(value) {
  const t = String(value || "")
    .trim()
    .toLowerCase();

  const genericNegativeTitles = new Set([
    "reject invalid request for login",
    "reject request for login",
    "invalid request for login",
  ]);

  return (
    !t ||
    t.startsWith("verify") ||
    t.startsWith("validate") ||
    genericNegativeTitles.has(t)
  );
}

function formatGeneratedCase(tc, endpoint) {
  if (!tc) return tc;

  const method = tc.api_details?.method || "GET";
  const path = tc.api_details?.path || "/";
  const testType = String(tc.test_type || "").toLowerCase();
  const templateKey = getTemplateKeyFromCase(tc);
  const isScenarioCase =
    getReferenceByPrefix(tc, "source:").toLowerCase() ===
      "source:scenario_engine" ||
    ensureArray(tc.references).includes("source:scenario_engine");

  /* ---------------- TITLE FIX ---------------- */

  const cleanPath = String(path || "/").trim();

  const resourceName =
    cleanPath
      .split("/")
      .filter(Boolean)
      .filter((part) => !part.startsWith("{") && !part.endsWith("}"))
      .pop() || "resource";

  const readableResource = resourceName
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

  const titleMap = {
    "contract.success": cleanPath.includes("login")
      ? "Login with valid credentials returns success response"
      : `Successful response is returned for ${readableResource.toLowerCase()}`,

    "contract.required_fields": cleanPath.includes("login")
      ? "Validate required fields in login success response"
      : `Validate required fields in ${readableResource.toLowerCase()} success response`,

    "contract.status_code": cleanPath.includes("login")
      ? "Validate login success status code"
      : `Validate success status code for ${readableResource.toLowerCase()}`,

    "contract.content_type": cleanPath.includes("login")
      ? "Validate login response content type"
      : `Validate response content type for ${readableResource.toLowerCase()}`,

    "contract.response_headers": cleanPath.includes("login")
      ? "Validate login response headers"
      : `Validate response headers for ${readableResource.toLowerCase()}`,

    "contract.query_params": cleanPath.includes("login")
      ? "Validate login query parameter contract"
      : `Validate query parameter contract for ${readableResource.toLowerCase()}`,

    "contract.path_params": cleanPath.includes("login")
      ? "Validate login path parameter contract"
      : `Validate path parameter contract for ${readableResource.toLowerCase()}`,

    "contract.request_body": cleanPath.includes("login")
      ? "Validate login request body contract"
      : `Validate request body contract for ${readableResource.toLowerCase()}`,

    "contract.error_response": cleanPath.includes("login")
      ? "Validate login error response contract"
      : `Validate error response contract for ${readableResource.toLowerCase()}`,

    "schema.response": cleanPath.includes("login")
      ? "Validate login response schema"
      : `Validate ${readableResource.toLowerCase()} response schema`,

    "schema.request_body": cleanPath.includes("login")
      ? "Validate login request body schema"
      : `Validate ${readableResource.toLowerCase()} request body schema`,

    "schema.required_fields": cleanPath.includes("login")
      ? "Validate required fields in login response"
      : `Validate required fields in ${readableResource.toLowerCase()} response`,

    "schema.field_types": cleanPath.includes("login")
      ? "Validate data types in login response"
      : `Validate field types in ${readableResource.toLowerCase()} response`,

    "schema.enum": cleanPath.includes("login")
      ? "Validate enum values in login response"
      : `Validate enum values in ${readableResource.toLowerCase()} response`,

    "schema.nested_objects": cleanPath.includes("login")
      ? "Validate nested objects in login response"
      : `Validate nested objects in ${readableResource.toLowerCase()} response`,

    "schema.array": cleanPath.includes("login")
      ? "Validate array fields in login response"
      : `Validate array fields in ${readableResource.toLowerCase()} response`,

    "schema.format": cleanPath.includes("login")
      ? "Validate field formats in login response"
      : `Validate field formats in ${readableResource.toLowerCase()} response`,

    "schema.numeric_constraints": cleanPath.includes("login")
      ? "Validate numeric constraints in login response"
      : `Validate numeric constraints in ${readableResource.toLowerCase()} response`,

    "schema.string_constraints": cleanPath.includes("login")
      ? "Validate string constraints in login response"
      : `Validate string constraints in ${readableResource.toLowerCase()} response`,

    "schema.pattern": cleanPath.includes("login")
      ? "Validate pattern-based fields in login response"
      : `Validate pattern-based fields in ${readableResource.toLowerCase()} response`,

    "schema.composition": cleanPath.includes("login")
      ? "Validate composed schema in login response"
      : `Validate composed schema in ${readableResource.toLowerCase()} response`,

    "negative.missing_required_query": cleanPath.includes("login")
      ? "Reject login request with missing required query parameters"
      : `Reject request for ${readableResource.toLowerCase()} with missing required query parameters`,

    "negative.missing_required_path": cleanPath.includes("login")
      ? "Reject login request with missing required path parameters"
      : `Reject request for ${readableResource.toLowerCase()} with missing required path parameters`,

    "negative.invalid_query_type": cleanPath.includes("login")
      ? "Reject login request with invalid query parameter type"
      : `Reject request for ${readableResource.toLowerCase()} with invalid query parameter type`,

    "negative.invalid_enum": cleanPath.includes("login")
      ? "Reject login request with invalid enum value"
      : `Reject request for ${readableResource.toLowerCase()} with invalid enum value`,

    "negative.invalid_format": cleanPath.includes("login")
      ? "Reject login request with invalid field format"
      : `Reject request for ${readableResource.toLowerCase()} with invalid field format`,

    "negative.string_too_long": cleanPath.includes("login")
      ? "Reject login request when string length exceeds limit"
      : `Reject request for ${readableResource.toLowerCase()} when string length exceeds limit`,

    "negative.numeric_above_maximum": cleanPath.includes("login")
      ? "Reject login request when numeric value exceeds maximum"
      : `Reject request for ${readableResource.toLowerCase()} when numeric value exceeds maximum`,

    "negative.additional_property": cleanPath.includes("login")
      ? "Reject login request with unsupported additional property"
      : `Reject request for ${readableResource.toLowerCase()} with unsupported additional property`,

    "negative.conflict": cleanPath.includes("login")
      ? "Return conflict for duplicate or invalid login state"
      : `Return conflict for ${readableResource.toLowerCase()} when resource state prevents operation`,

    "negative.rate_limit": cleanPath.includes("login")
      ? "Rate limit repeated login attempts"
      : `Rate limit repeated requests for ${readableResource.toLowerCase()}`,

    "negative.invalid_pagination": cleanPath.includes("login")
      ? "Reject login request with invalid pagination values"
      : `Reject request for ${readableResource.toLowerCase()} with invalid pagination values`,

    "negative.null_required_field": cleanPath.includes("login")
      ? "Reject login request when required field is null"
      : `Reject request for ${readableResource.toLowerCase()} when required field is null`,

    "negative.invalid_content_type": cleanPath.includes("login")
      ? "Reject login request with unsupported content type"
      : `Reject request for ${readableResource.toLowerCase()} with unsupported content type`,

    "negative.malformed_json": cleanPath.includes("login")
      ? "Reject login request with malformed JSON body"
      : `Reject request for ${readableResource.toLowerCase()} with malformed JSON body`,

    "negative.empty_body": cleanPath.includes("login")
      ? "Reject login request with empty body"
      : `Reject request for ${readableResource.toLowerCase()} with empty body`,

    "negative.resource_not_found": cleanPath.includes("login")
      ? "Return not found for invalid login resource identifier"
      : `Return not found for invalid ${readableResource.toLowerCase()} resource identifier`,

    "negative.unsupported_method": cleanPath.includes("login")
      ? "Reject unsupported HTTP method on login endpoint"
      : `Reject unsupported HTTP method on ${readableResource.toLowerCase()} endpoint`,

    "auth.missing_credentials": cleanPath.includes("login")
      ? "Reject login-related request without authentication credentials"
      : `Reject ${readableResource.toLowerCase()} request without authentication credentials`,

    "auth.invalid_credentials": cleanPath.includes("login")
      ? "Reject login request with invalid authentication credentials"
      : `Reject ${readableResource.toLowerCase()} request with invalid authentication credentials`,

    "auth.expired_credentials": cleanPath.includes("login")
      ? "Reject login request with expired authentication credentials"
      : `Reject ${readableResource.toLowerCase()} request with expired authentication credentials`,

    "auth.forbidden_role": cleanPath.includes("login")
      ? "Reject login-related request for insufficient role permissions"
      : `Reject ${readableResource.toLowerCase()} request for insufficient role permissions`,
  };
  if (isScenarioCase && (testType === "negative" || testType === "auth")) {
    const cleaned = { ...tc };

    if (method === "GET" && cleaned?.test_data) {
      delete cleaned.test_data.request_body;
    }

    return cleaned;
  }

  if (titleMap[templateKey]) {
    tc.title = titleMap[templateKey];
  } else if (isGenericTitle(tc.title)) {
    if (testType === "contract") {
      tc.title =
        method === "POST"
          ? `Create ${readableResource.toLowerCase()} successfully`
          : `Retrieve ${readableResource.toLowerCase()} successfully`;
    } else if (testType === "negative") {
      tc.title = `Reject invalid request for ${readableResource.toLowerCase()}`;
    } else if (testType === "schema") {
      tc.title = `Validate ${readableResource.toLowerCase()} response schema`;
    } else if (testType === "auth") {
      tc.title = `Validate authentication rules for ${readableResource.toLowerCase()}`;
    }
  }
  /* ---------------- STEPS FIX ---------------- */

  const steps = [];

  const hasHeaders =
    tc.test_data?.headers && Object.keys(tc.test_data.headers).length > 0;
  const hasQueryParams =
    tc.test_data?.query_params &&
    Object.keys(tc.test_data.query_params).length > 0;
  const hasPathParams =
    tc.test_data?.path_params &&
    Object.keys(tc.test_data.path_params).length > 0;
  const hasBody =
    method !== "GET" &&
    tc.test_data?.request_body !== undefined &&
    tc.test_data?.request_body !== null &&
    !(
      typeof tc.test_data.request_body === "object" &&
      !Array.isArray(tc.test_data.request_body) &&
      Object.keys(tc.test_data.request_body).length === 0
    );

  const sendVariants = [
    "Send the request.",
    "Execute the request.",
    "Submit the API call.",
  ];
  const sendStep = sendVariants[cleanPath.length % sendVariants.length];

  if (testType === "schema") {
    steps.push(`Set HTTP method to ${method}.`);
    steps.push(`Use endpoint path: ${cleanPath}.`);

    if (hasHeaders) steps.push("Add required headers.");
    if (hasPathParams) steps.push("Provide valid path parameter values.");
    if (hasQueryParams) steps.push("Provide required query parameter values.");

    if (templateKey === "schema.request_body") {
      steps.push("Prepare a valid request body using documented fields.");
      steps.push(sendStep);
      steps.push(
        "Validate the request payload structure against the documented schema before execution.",
      );
    } else {
      steps.push(sendStep);
      steps.push("Capture the response body.");

      if (templateKey === "schema.response") {
        steps.push(
          "Validate the overall response structure against the documented schema.",
        );
      } else if (templateKey === "schema.required_fields") {
        steps.push("Verify that all required response fields are present.");
      } else if (templateKey === "schema.field_types") {
        steps.push(
          "Verify that response field data types match the documented schema.",
        );
      } else {
        steps.push(
          "Validate the response structure against the documented schema.",
        );
      }
    }
  } else if (testType === "negative") {
    steps.push(`Set HTTP method to ${method}.`);
    steps.push(`Use endpoint path: ${cleanPath}.`);

    if (hasHeaders) steps.push("Add required headers.");
    if (hasPathParams) steps.push("Provide valid path parameter values.");
    if (hasQueryParams) steps.push("Provide required query parameter values.");
    if (hasBody) steps.push("Prepare a valid request body first.");

    if (templateKey === "negative.missing_required_query") {
      steps.push("Remove one or more required query parameters.");
    } else if (templateKey === "negative.missing_required_path") {
      steps.push("Remove or omit a required path parameter.");
    } else if (templateKey === "negative.invalid_query_type") {
      steps.push("Set a query parameter to an invalid data type.");
    } else if (templateKey === "negative.invalid_enum") {
      steps.push("Set an enum field to an unsupported value.");
    } else if (templateKey === "negative.invalid_format") {
      steps.push("Set a field to an invalid format.");
    } else if (templateKey === "negative.string_too_long") {
      steps.push("Set a string field longer than the allowed maximum length.");
    } else if (templateKey === "negative.numeric_above_maximum") {
      steps.push("Set a numeric field above the allowed maximum value.");
    } else if (templateKey === "negative.additional_property") {
      steps.push("Add an unsupported extra property to the request.");
    } else if (templateKey === "negative.conflict") {
      steps.push(
        "Repeat or modify the request to trigger a conflict condition.",
      );
    } else if (templateKey === "negative.rate_limit") {
      steps.push("Send repeated requests rapidly to trigger rate limiting.");
    } else if (templateKey === "negative.invalid_pagination") {
      steps.push("Set pagination fields to invalid values.");
    } else if (templateKey === "negative.null_required_field") {
      steps.push("Set a required field to null.");
    } else if (templateKey === "negative.invalid_content_type") {
      steps.push("Set the Content-Type header to an unsupported value.");
    } else if (templateKey === "negative.malformed_json") {
      steps.push("Send a malformed JSON request body.");
    } else if (templateKey === "negative.empty_body") {
      steps.push("Remove the required request body.");
    } else if (templateKey === "negative.resource_not_found") {
      steps.push("Use a non-existent resource identifier.");
    } else if (templateKey === "negative.unsupported_method") {
      steps.push("Call the endpoint using an unsupported HTTP method.");
    } else {
      steps.push(
        "Modify the request with invalid, unsupported, or missing input.",
      );
    }

    steps.push(sendStep);
  } else if (testType === "contract") {
    steps.push(`Set HTTP method to ${method}.`);
    steps.push(`Use endpoint path: ${cleanPath}.`);

    if (hasHeaders) steps.push("Add required headers.");
    if (hasPathParams) steps.push("Provide valid path parameter values.");
    if (hasQueryParams) steps.push("Provide required query parameter values.");
    if (hasBody) steps.push("Provide request body with required fields.");

    steps.push(sendStep);

    if (templateKey === "contract.success") {
      steps.push("Verify that the request is accepted successfully.");
    } else if (templateKey === "contract.status_code") {
      steps.push(
        "Verify that the returned HTTP status code matches the documented success status.",
      );
    } else if (templateKey === "contract.required_fields") {
      steps.push(
        "Verify that the documented required response fields are present.",
      );
    } else if (templateKey === "contract.content_type") {
      steps.push(
        "Verify that the response content type matches the API contract.",
      );
    } else if (templateKey === "contract.response_headers") {
      steps.push("Verify that documented response headers are present.");
    } else if (templateKey === "contract.request_body") {
      steps.push(
        "Verify that the request body structure matches the documented contract.",
      );
    } else if (templateKey === "contract.query_params") {
      steps.push("Verify that query parameters are supported as documented.");
    } else if (templateKey === "contract.path_params") {
      steps.push("Verify that path parameters are supported as documented.");
    } else if (templateKey === "contract.error_response") {
      steps.push(
        "Verify that documented error response definitions exist for this endpoint.",
      );
    }
  } else if (testType === "auth") {
    steps.push(`Set HTTP method to ${method}.`);
    steps.push(`Use endpoint path: ${cleanPath}.`);

    if (hasPathParams) steps.push("Provide valid path parameter values.");
    if (hasQueryParams) steps.push("Provide required query parameter values.");
    if (hasBody) steps.push("Provide request body with required fields.");

    if (templateKey === "auth.missing_credentials") {
      steps.push("Do not send authentication credentials.");
    } else if (templateKey === "auth.invalid_credentials") {
      steps.push("Send invalid authentication credentials.");
    } else if (templateKey === "auth.expired_credentials") {
      steps.push("Send expired authentication credentials.");
    } else if (templateKey === "auth.forbidden_role") {
      steps.push("Send valid credentials with insufficient permissions.");
    }

    steps.push(sendStep);
  } else {
    steps.push(`Set HTTP method to ${method}.`);
    steps.push(`Use endpoint path: ${cleanPath}.`);

    if (hasHeaders) steps.push("Add required headers.");
    if (hasPathParams) steps.push("Provide valid path parameter values.");
    if (hasQueryParams) steps.push("Provide required query parameter values.");
    if (hasBody) steps.push("Provide request body with required fields.");

    steps.push(sendStep);
  }

  tc.steps = steps;

  /* ---------------- EXPECTED RESULTS FIX ---------------- */

  const expected = [];

  if (testType === "contract") {
    if (templateKey === "contract.success") {
      expected.push("API returns the documented success response.");
      expected.push("Response is valid for a correct request.");
    } else if (templateKey === "contract.status_code") {
      expected.push("HTTP status code matches the documented success status.");
    } else if (templateKey === "contract.required_fields") {
      expected.push("All documented required response fields are present.");
    } else if (templateKey === "contract.content_type") {
      expected.push("Response content type matches the API specification.");
    } else if (templateKey === "contract.response_headers") {
      expected.push("Documented response headers are present in the response.");
    } else if (templateKey === "contract.request_body") {
      expected.push(
        "Request body is accepted when it matches the documented contract.",
      );
    } else if (templateKey === "contract.query_params") {
      expected.push(
        "Documented query parameters are accepted and handled correctly.",
      );
    } else if (templateKey === "contract.path_params") {
      expected.push(
        "Documented path parameters are accepted and handled correctly.",
      );
    } else if (templateKey === "contract.error_response") {
      expected.push(
        "Error responses are documented for applicable failure scenarios.",
      );
    } else {
      expected.push("API behavior matches the documented contract.");
    }
  }

  if (testType === "negative") {
    if (templateKey === "negative.missing_required_query") {
      expected.push(
        "API rejects the request because required query parameters are missing.",
      );
      expected.push("Client error response is returned.");
    } else if (templateKey === "negative.missing_required_path") {
      expected.push(
        "API rejects the request because required path parameters are missing.",
      );
      expected.push("Client error response is returned.");
    } else if (templateKey === "negative.invalid_query_type") {
      expected.push(
        "API rejects the request because a query parameter has an invalid type.",
      );
    } else if (templateKey === "negative.invalid_enum") {
      expected.push(
        "API rejects the request because an enum field has an unsupported value.",
      );
    } else if (templateKey === "negative.invalid_format") {
      expected.push(
        "API rejects the request because one or more fields have invalid format.",
      );
    } else if (templateKey === "negative.string_too_long") {
      expected.push(
        "API rejects the request because a string field exceeds the allowed length.",
      );
    } else if (templateKey === "negative.numeric_above_maximum") {
      expected.push(
        "API rejects the request because a numeric field exceeds the maximum allowed value.",
      );
    } else if (templateKey === "negative.additional_property") {
      expected.push(
        "API rejects the request because it contains unsupported additional properties.",
      );
    } else if (templateKey === "negative.conflict") {
      expected.push(
        "API returns conflict because the operation cannot be completed in the current resource state.",
      );
    } else if (templateKey === "negative.rate_limit") {
      expected.push("API rate limits excessive repeated requests.");
    } else if (templateKey === "negative.invalid_pagination") {
      expected.push(
        "API rejects the request because pagination values are invalid.",
      );
    } else if (templateKey === "negative.null_required_field") {
      expected.push(
        "API rejects the request because a required field is null.",
      );
    } else if (templateKey === "negative.invalid_content_type") {
      expected.push(
        "API rejects the request because the content type is unsupported.",
      );
    } else if (templateKey === "negative.malformed_json") {
      expected.push(
        "API rejects the request because the JSON body is malformed.",
      );
    } else if (templateKey === "negative.empty_body") {
      expected.push(
        "API rejects the request because the required request body is missing.",
      );
    } else if (templateKey === "negative.resource_not_found") {
      expected.push(
        "API returns not found for an invalid resource identifier.",
      );
    } else if (templateKey === "negative.unsupported_method") {
      expected.push("API rejects unsupported HTTP methods for this endpoint.");
    } else {
      expected.push(
        "API rejects the request with an appropriate client error response.",
      );
    }
  }
  if (testType === "auth") {
    if (templateKey === "auth.missing_credentials") {
      expected.push(
        "API rejects the request because authentication credentials are missing.",
      );
      expected.push("Unauthorized response is returned.");
    } else if (templateKey === "auth.invalid_credentials") {
      expected.push(
        "API rejects the request because authentication credentials are invalid.",
      );
      expected.push("Unauthorized response is returned.");
    } else if (templateKey === "auth.expired_credentials") {
      expected.push(
        "API rejects the request because authentication credentials are expired.",
      );
      expected.push("Unauthorized response is returned.");
    } else if (templateKey === "auth.forbidden_role") {
      expected.push(
        "API rejects the request because the user does not have sufficient permissions.",
      );
      expected.push("Forbidden response is returned.");
    } else {
      expected.push(
        "API enforces authentication and authorization rules correctly.",
      );
    }
  }

  if (testType === "schema") {
    if (templateKey === "schema.request_body") {
      expected.push("Request body matches the documented schema.");
      expected.push("All required request fields are present.");
      expected.push("Request field data types match the schema definition.");
    } else if (templateKey === "schema.response") {
      expected.push("Response matches the documented schema.");
      expected.push("Response structure is valid.");
    } else if (templateKey === "schema.required_fields") {
      expected.push("All required response fields are present.");
    } else if (templateKey === "schema.field_types") {
      expected.push("Response field data types match the schema definition.");
    } else {
      expected.push("Response matches the documented schema.");
    }
  }

  tc.expected_results = expected;

  /* ---------------- CLEANUP ---------------- */

  if (method === "GET") {
    delete tc.test_data.request_body;
  }

  return tc;
}

export async function generateCasesForEndpoints(endpoints, options = {}) {
  const allCases = [];

  for (const endpoint of endpoints || []) {
    const cases = await generateCasesForEndpoint(endpoint, options);
    const formattedCases = cases.map((tc) => formatGeneratedCase(tc, endpoint));
    allCases.push(...formattedCases);
  }

  return dedupeCases(allCases);
}
