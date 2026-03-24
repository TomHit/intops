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

function resolveJsonPointer(root, ref) {
  if (!ref || typeof ref !== "string" || !ref.startsWith("#/")) {
    return null;
  }

  const parts = ref
    .slice(2)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));

  let current = root;

  for (const part of parts) {
    if (!isObject(current) && !Array.isArray(current)) {
      return null;
    }
    current = current[part];
    if (current === undefined) return null;
  }

  return current;
}

function resolveSchemaRef(schema, endpoint, seen = new Set()) {
  if (!isObject(schema)) return schema;

  if (schema.$ref && typeof schema.$ref === "string") {
    if (seen.has(schema.$ref)) return schema;

    seen.add(schema.$ref);

    const rootDoc =
      endpoint?._openapiDoc ||
      endpoint?.openapiDoc ||
      endpoint?.__openapiDoc ||
      null;

    if (!rootDoc) return schema;

    const resolved = resolveJsonPointer(rootDoc, schema.$ref);
    if (!resolved) return schema;

    return resolveSchemaRef(resolved, endpoint, seen);
  }

  return schema;
}

function firstDefined(...values) {
  for (const v of values) {
    if (v !== undefined) return v;
  }
  return undefined;
}

function pickExample(source) {
  if (!isObject(source)) return undefined;

  if (source.example !== undefined) return clone(source.example);

  if (source.examples !== undefined) {
    if (Array.isArray(source.examples) && source.examples.length > 0) {
      return clone(source.examples[0]);
    }
    if (isObject(source.examples)) {
      const first = Object.values(source.examples)[0];
      if (isObject(first) && first.value !== undefined) {
        return clone(first.value);
      }
      if (first !== undefined) return clone(first);
    }
  }

  return undefined;
}

function inferStringFromPattern(pattern) {
  if (!pattern || typeof pattern !== "string") return undefined;

  if (pattern === "^[A-Z]{3}$") return "ABC";
  if (pattern === "^[A-Z]{2,5}$") return "TEST";
  if (pattern === "^\\d{10}$" || pattern === "^[0-9]{10}$") return "9876543210";
  if (pattern === "^\\d{6}$" || pattern === "^[0-9]{6}$") return "123456";

  return undefined;
}

function genericFieldHint(fieldName = "", schema = {}) {
  const n = String(fieldName || "").toLowerCase();

  if (schema.format === "email" || n.includes("email")) return "qa@example.com";
  if (schema.format === "uuid") return "123e4567-e89b-12d3-a456-426614174000";
  if (schema.format === "date") return "2026-01-01";
  if (schema.format === "date-time") return "2026-01-01T00:00:00Z";
  if (schema.format === "uri" || schema.format === "url") {
    return "https://example.com/resource";
  }
  if (schema.format === "binary") return "sample-file.bin";

  if (n === "id" || n.endsWith("_id") || n.endsWith("id")) return "12345";
  if (n.includes("phone") || n.includes("mobile")) return "9876543210";
  if (n.includes("otp") || n.endsWith("_code") || n === "code") return "123456";
  if (n.includes("token")) return "sample-token-123";
  if (n.includes("password") || n.includes("passwd")) return "Test@123";
  if (n.includes("username") || n.includes("user_name")) return "qa_user";
  if (n.includes("name")) return "sample_name";
  if (n.includes("title")) return "Sample Title";
  if (n.includes("description")) return "Sample description";
  if (n.includes("slug")) return "sample-slug";

  return undefined;
}

function coerceStringLength(value, schema = {}) {
  if (typeof value !== "string") return value;

  let out = value;

  if (typeof schema.minLength === "number" && out.length < schema.minLength) {
    out = out + "a".repeat(schema.minLength - out.length);
  }

  if (typeof schema.maxLength === "number" && out.length > schema.maxLength) {
    out = out.slice(0, schema.maxLength);
  }

  return out;
}

function fieldSignalScore(fieldName = "", schema = {}, required = false) {
  let score = 0;

  if (required) score += 100;
  if (pickExample(schema) !== undefined) score += 40;
  if (schema.default !== undefined) score += 25;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) score += 20;
  if (schema.format) score += 15;
  if (schema.pattern) score += 10;
  if (
    typeof schema.minimum === "number" ||
    typeof schema.maximum === "number" ||
    typeof schema.minLength === "number" ||
    typeof schema.maxLength === "number"
  ) {
    score += 8;
  }

  const n = String(fieldName || "").toLowerCase();
  if (n.includes("id")) score += 3;
  if (n.includes("email")) score += 4;
  if (n.includes("name")) score += 2;
  if (n.includes("date") || n.includes("time")) score += 2;
  if (n.includes("password")) score += 5;
  if (n.includes("token")) score += 5;

  return score;
}

function resolveValidPrimitive(schema = {}, fieldName = "") {
  const exampleValue = firstDefined(
    pickExample(schema),
    schema.default,
    Array.isArray(schema.enum) && schema.enum.length > 0
      ? schema.enum[0]
      : undefined,
  );

  if (exampleValue !== undefined) {
    return { value: clone(exampleValue), source: "example/default/enum" };
  }

  const hint = genericFieldHint(fieldName, schema);

  if (
    hint !== undefined &&
    (schema.type === "integer" || schema.type === "number")
  ) {
    return {
      value: schema.type === "integer" ? 123 : 123.45,
      source: "numeric_hint",
    };
  }

  if (hint !== undefined && schema.type !== "boolean") {
    return {
      value: coerceStringLength(hint, schema),
      source: "generic_hint",
    };
  }

  const patternValue = inferStringFromPattern(schema.pattern);
  if (patternValue !== undefined) {
    return {
      value: coerceStringLength(patternValue, schema),
      source: "pattern",
    };
  }

  switch (schema.type) {
    case "integer": {
      if (Number.isFinite(schema.minimum) && Number.isFinite(schema.maximum)) {
        return {
          value: Math.floor((schema.minimum + schema.maximum) / 2),
          source: "range_mid",
        };
      }
      if (Number.isFinite(schema.minimum)) {
        return { value: schema.minimum, source: "minimum" };
      }
      if (Number.isFinite(schema.maximum)) {
        return { value: schema.maximum - 1, source: "maximum" };
      }
      return { value: 1, source: "type" };
    }

    case "number": {
      if (Number.isFinite(schema.minimum) && Number.isFinite(schema.maximum)) {
        return {
          value: (schema.minimum + schema.maximum) / 2,
          source: "range_mid",
        };
      }
      if (Number.isFinite(schema.minimum)) {
        return { value: schema.minimum, source: "minimum" };
      }
      if (Number.isFinite(schema.maximum)) {
        return { value: schema.maximum - 0.1, source: "maximum" };
      }
      return { value: 1.5, source: "type" };
    }

    case "boolean":
      return { value: false, source: "type" };

    case "array":
      return { value: [], source: "type" };

    case "object":
      return { value: {}, source: "type" };

    case "string":
    default: {
      let str = fieldName ? `<valid_${fieldName}>` : "sample";

      if (typeof schema.minLength === "number" && schema.minLength > 0) {
        str = "a".repeat(Math.max(schema.minLength, 1));
      }

      return {
        value: coerceStringLength(str, schema),
        source: "type",
      };
    }
  }
}

function mergeObjectSchemas(parts = []) {
  const merged = {
    type: "object",
    properties: {},
    required: [],
  };

  for (const part of parts) {
    if (!isObject(part)) continue;

    if (isObject(part.properties)) {
      merged.properties = {
        ...merged.properties,
        ...part.properties,
      };
    }

    if (Array.isArray(part.required)) {
      merged.required.push(...part.required);
    }
  }

  merged.required = Array.from(new Set(merged.required));
  return merged;
}

function resolveObjectSchema(schema = {}) {
  const out = {};
  const required = Array.isArray(schema.required)
    ? new Set(schema.required)
    : new Set();
  const props = isObject(schema.properties) ? schema.properties : {};

  const ranked = Object.entries(props)
    .map(([name, propSchema]) => ({
      name,
      schema: propSchema || {},
      required: required.has(name),
      score: fieldSignalScore(name, propSchema || {}, required.has(name)),
    }))
    .sort((a, b) => b.score - a.score);

  if (!isObject(schema.properties) && !Array.isArray(schema.required)) {
    return {
      value: { sample_field: "sample_value" },
      source: "object-generic",
    };
  }

  let chosen;

  if (required.size > 0) {
    chosen = ranked.filter((x) => x.required);
  } else {
    chosen = ranked.filter((x) => x.score > 0).slice(0, 4);

    if (chosen.length === 0) {
      chosen = ranked.slice(0, 2);
    }
  }

  for (const item of chosen) {
    const resolved = resolveValidValue(item.schema, item.name);
    out[item.name] = resolved.value;
  }

  if (Object.keys(out).length === 0 && ranked.length > 0) {
    const first = ranked[0];
    const resolved = resolveValidValue(first.schema, first.name);
    out[first.name] = resolved.value;
  }

  if (Object.keys(out).length === 0 && ranked.length > 0) {
    const fallback = ranked.slice(0, 2);

    for (const item of fallback) {
      const resolved = resolveValidValue(item.schema, item.name);
      out[item.name] = resolved.value;
    }

    return { value: out, source: "object-fallback" };
  }

  return { value: out, source: "object" };
}

function resolveValidValue(schema = {}, fieldName = "") {
  if (!schema || typeof schema !== "object") {
    return { value: "sample", source: "fallback" };
  }

  const directExample = pickExample(schema);
  if (directExample !== undefined) {
    return { value: clone(directExample), source: "schema_example" };
  }

  if (schema.oneOf?.length) {
    return resolveValidValue(schema.oneOf[0], fieldName);
  }

  if (schema.anyOf?.length) {
    return resolveValidValue(schema.anyOf[0], fieldName);
  }

  if (schema.allOf?.length) {
    const merged = mergeObjectSchemas(schema.allOf);
    return resolveObjectSchema(merged);
  }

  if (schema.type === "object" || schema.properties) {
    return resolveObjectSchema(schema);
  }

  if (schema.type === "array") {
    const itemResolved = resolveValidValue(
      schema.items || { type: "string" },
      fieldName ? `${fieldName}_item` : "item",
    );

    const minItems = Number.isInteger(schema.minItems) ? schema.minItems : 1;
    const arr = [];

    for (let i = 0; i < Math.max(minItems, 1); i++) {
      arr.push(clone(itemResolved.value));
    }

    return {
      value: arr,
      source: `array:${itemResolved.source}`,
    };
  }

  return resolveValidPrimitive(schema, fieldName);
}

function buildInvalidTypeValue(schema = {}, validValue) {
  switch (schema.type) {
    case "string":
      return 12345;
    case "integer":
    case "number":
      return "not-a-number";
    case "boolean":
      return "not-a-boolean";
    case "array":
      return "not-an-array";
    case "object":
      return "not-an-object";
    default:
      return validValue === null ? 1 : null;
  }
}

function buildInvalidFormatValue(schema = {}, fieldName = "") {
  const n = String(fieldName || "").toLowerCase();

  switch (schema.format) {
    case "uuid":
      return "not-a-uuid";
    case "email":
      return "not-an-email";
    case "date":
      return "99-99-9999";
    case "date-time":
      return "not-a-datetime";
    case "uri":
    case "url":
      return "not-a-url";
    default:
      if (schema.pattern) return "INVALID_PATTERN_VALUE";
      if (n.includes("email")) return "invalid-email";
      if (n.includes("phone") || n.includes("mobile")) return "12abc";
      return undefined;
  }
}

function buildBoundaryCases(schema = {}) {
  const out = [];

  if (typeof schema.minimum === "number") {
    out.push({
      kind: "below_minimum",
      badValue: schema.minimum - 1,
    });
  }

  if (typeof schema.maximum === "number") {
    out.push({
      kind: "above_maximum",
      badValue: schema.maximum + 1,
    });
  }

  if (typeof schema.minLength === "number" && schema.minLength > 0) {
    out.push({
      kind: "below_min_length",
      badValue: "a".repeat(Math.max(schema.minLength - 1, 0)),
    });
  }

  if (typeof schema.maxLength === "number") {
    out.push({
      kind: "above_max_length",
      badValue: "a".repeat(schema.maxLength + 1),
    });
  }

  return out;
}

function buildInvalidEnumValue(schema = {}) {
  const enumVals = Array.isArray(schema.enum) ? schema.enum : [];
  if (enumVals.length === 0) return undefined;

  const first = enumVals[0];

  if (typeof first === "number") return 999999;
  if (typeof first === "boolean") return "not-boolean-enum";
  return "__INVALID_ENUM__";
}

function toRequestShape(valid) {
  return {
    path_params: clone(valid.path),
    query_params: clone(valid.query),
    headers: clone(valid.headers),
    cookies: clone(valid.cookies),
    request_body: clone(valid.body),
  };
}

function buildBodyRequiredFieldNegatives(validBody, requestSchema = {}) {
  const out = [];

  if (!isObject(validBody)) return out;

  const requiredFields = Array.isArray(requestSchema?.required)
    ? requestSchema.required
    : [];

  for (const fieldName of requiredFields) {
    if (!(fieldName in validBody)) continue;

    const missingBody = clone(validBody);
    delete missingBody[fieldName];

    out.push({
      kind: "body_missing_required_field",
      field: fieldName,
      badValue: undefined,
      requestBody: missingBody,
    });

    out.push({
      kind: "body_null_required_field",
      field: fieldName,
      badValue: null,
      requestBody: {
        ...clone(validBody),
        [fieldName]: null,
      },
    });
  }

  return out;
}

function normalizeHeaderName(name = "") {
  const lower = String(name || "").toLowerCase();
  if (lower === "accept") return "Accept";
  if (lower === "content-type") return "Content-Type";
  if (lower === "authorization") return "Authorization";
  return name;
}

function getPreferredRequestBodyContent(requestBody) {
  const content = requestBody?.content;
  if (!isObject(content)) return null;

  if (
    requestBody?.preferredContentType &&
    content[requestBody.preferredContentType]
  ) {
    return {
      mediaType: requestBody.preferredContentType,
      mediaDef: content[requestBody.preferredContentType],
    };
  }

  if (content["application/json"]) {
    return {
      mediaType: "application/json",
      mediaDef: content["application/json"],
    };
  }

  if (content["application/*+json"]) {
    return {
      mediaType: "application/*+json",
      mediaDef: content["application/*+json"],
    };
  }

  for (const [mediaType, mediaDef] of Object.entries(content)) {
    if (mediaDef?.schema && mediaType.toLowerCase().includes("json")) {
      return { mediaType, mediaDef };
    }
  }

  const first = Object.entries(content).find(
    ([, mediaDef]) => mediaDef?.schema,
  );
  if (first) {
    return { mediaType: first[0], mediaDef: first[1] };
  }

  return null;
}

function detectEndpointType(endpoint) {
  const path = String(endpoint?.path || "").toLowerCase();
  const method = String(endpoint?.method || "").toUpperCase();

  if (
    path.includes("login") ||
    path.includes("logout") ||
    path.includes("signup") ||
    path.includes("signin") ||
    path.includes("auth") ||
    path.includes("token") ||
    path.includes("session") ||
    path.includes("password")
  ) {
    return "auth";
  }

  if (method === "POST") return "create";
  if (method === "PUT" || method === "PATCH") return "update";
  if (method === "DELETE") return "delete";
  if (method === "GET" && path.includes("{")) return "get_by_id";
  if (method === "GET") return "list";

  return "generic";
}

function detectAuth(endpoint) {
  if (Array.isArray(endpoint?.security) && endpoint.security.length > 0) {
    return "required";
  }

  const headerParams = Array.isArray(endpoint?.params?.header)
    ? endpoint.params.header
    : [];

  const hasAuthHeaderParam = headerParams.some(
    (h) => String(h?.name || "").toLowerCase() === "authorization",
  );

  if (hasAuthHeaderParam) return "required";

  return "none";
}

function extractResponseSchema(endpoint) {
  const responses = endpoint?.responses || {};
  const preferred = ["200", "201", "202", "204", "default"];

  for (const code of preferred) {
    const res = responses[code];
    if (!res) continue;

    const content = res.content || {};
    const jsonLike =
      content["application/json"] ||
      content["application/*+json"] ||
      Object.values(content).find((v) => v?.schema);

    if (jsonLike?.schema) {
      return resolveSchemaRef(jsonLike.schema, endpoint);
    }

    if (code === "204") return null;
  }

  return null;
}

function getSuccessStatusCandidates(endpoint) {
  const responses = endpoint?.responses || {};
  const candidates = Object.keys(responses)
    .filter((k) => /^\d+$/.test(k) && Number(k) >= 200 && Number(k) < 300)
    .map((k) => Number(k))
    .sort((a, b) => a - b);

  if (candidates.length > 0) return candidates;

  const method = String(endpoint?.method || "").toUpperCase();
  if (method === "POST") return [201, 200];
  if (method === "DELETE") return [204, 200];
  return [200];
}

function inferIntentPrefix(groupKey, fieldName) {
  const loc = groupKey === "headers" ? "header" : groupKey;
  return `${loc}_${String(fieldName || "").toLowerCase()}`;
}

function pushNegative(arr, item) {
  arr.push(item);
}

export function resolveEndpointTestData(endpoint) {
  const endpointType = detectEndpointType(endpoint);
  const auth = detectAuth(endpoint);
  const responseSchema = extractResponseSchema(endpoint);
  const successStatusCandidates = getSuccessStatusCandidates(endpoint);

  const result = {
    endpoint_type: endpointType,
    auth,
    response_schema: responseSchema,
    success_status_candidates: successStatusCandidates,
    valid: {
      path: {},
      query: {},
      headers: {},
      cookies: {},
      body: undefined,
    },
    negative: {
      missingRequired: [],
      invalidType: [],
      invalidEnum: [],
      invalidFormat: [],
      stringTooLong: [],
      numericAboveMaximum: [],
      nullRequiredField: [],
      boundary: [],
    },
    sourceMap: {},
    body_style: undefined,
  };

  const groups = [
    { key: "path", fields: endpoint?.params?.path || [] },
    { key: "query", fields: endpoint?.params?.query || [] },
    { key: "headers", fields: endpoint?.params?.header || [] },
    { key: "cookies", fields: endpoint?.params?.cookie || [] },
  ];

  for (const group of groups) {
    for (const field of group.fields) {
      const schema = field?.schema || {};
      const directExample = firstDefined(
        field?.example,
        pickExample(field),
        pickExample(schema),
      );

      let resolved;
      if (directExample !== undefined) {
        resolved = { value: clone(directExample), source: "param_example" };
      } else {
        resolved = resolveValidValue(schema, field?.name);
      }

      if (group.key === "path" && directExample === undefined) {
        if (schema.format === "uuid") {
          resolved = {
            value: "123e4567-e89b-12d3-a456-426614174000",
            source: "path_uuid_sample",
          };
        } else if (schema.type === "integer") {
          resolved = {
            value: 123,
            source: "path_integer_sample",
          };
        } else if (schema.type === "string" && resolved.value === "sample") {
          resolved = {
            value: String(field?.name || "")
              .toLowerCase()
              .includes("id")
              ? "123"
              : "sample-id",
            source: "path_string_sample",
          };
        }
      }

      const fieldName =
        group.key === "headers" ? normalizeHeaderName(field.name) : field.name;

      result.valid[group.key][fieldName] = resolved.value;
      result.sourceMap[`${group.key}.${fieldName}`] = resolved.source;
    }
  }

  if (!result.valid.headers["Accept"]) {
    result.valid.headers["Accept"] = "application/json";
    result.sourceMap["headers.Accept"] = "default_header";
  }

  const preferredBodyInfo = getPreferredRequestBodyContent(
    endpoint?.requestBody,
  );
  const preferredBodyType = preferredBodyInfo?.mediaType;
  const preferredBody = preferredBodyInfo?.mediaDef;

  if (!result.valid.headers["Content-Type"] && endpoint?.requestBody) {
    result.valid.headers["Content-Type"] =
      preferredBodyType || "application/json";
    result.sourceMap["headers.Content-Type"] = "default_header";
  }

  result.body_style = preferredBodyType || undefined;

  const resolvedRequestSchema = resolveSchemaRef(
    preferredBody?.schema,
    endpoint,
  );

  const bodyExample = firstDefined(
    preferredBody?.example,
    pickExample(preferredBody),
    pickExample(resolvedRequestSchema),
  );

  if (bodyExample !== undefined) {
    result.valid.body = clone(bodyExample);
    result.sourceMap.body = "request_body_example";
  } else if (resolvedRequestSchema) {
    const resolvedBody = resolveValidValue(
      resolvedRequestSchema,
      "request_body",
    );
    result.valid.body = resolvedBody.value;
    result.sourceMap.body = `request_body_${resolvedBody.source}`;
  }

  if (auth === "required" && !result.valid.headers["Authorization"]) {
    result.valid.headers["Authorization"] = "Bearer <valid_token>";
    result.sourceMap["headers.Authorization"] = "auth_default";
  }

  for (const group of groups) {
    for (const field of group.fields) {
      const schema = field?.schema || {};
      const fieldName =
        group.key === "headers" ? normalizeHeaderName(field.name) : field.name;
      const validValue = result.valid[group.key][fieldName];
      const intentPrefix = inferIntentPrefix(group.key, fieldName);

      if (field.required) {
        const missingReq = clone(result.valid);
        delete missingReq[group.key][fieldName];

        pushNegative(result.negative.missingRequired, {
          field: fieldName,
          location: group.key,
          intent: `missing_required_${intentPrefix}`,
          request: toRequestShape(missingReq),
        });
      }

      const badType = buildInvalidTypeValue(schema, validValue);
      if (badType !== undefined) {
        const req = clone(result.valid);
        req[group.key][fieldName] = badType;

        pushNegative(result.negative.invalidType, {
          field: fieldName,
          location: group.key,
          badValue: badType,
          intent: `invalid_type_${intentPrefix}`,
          request: toRequestShape(req),
        });
      }

      const badEnum = buildInvalidEnumValue(schema);
      if (badEnum !== undefined) {
        const req = clone(result.valid);
        req[group.key][fieldName] = badEnum;

        pushNegative(result.negative.invalidEnum, {
          field: fieldName,
          location: group.key,
          badValue: badEnum,
          intent: `invalid_enum_${intentPrefix}`,
          request: toRequestShape(req),
        });
      }

      const badFormat = buildInvalidFormatValue(schema, fieldName);
      if (badFormat !== undefined) {
        const req = clone(result.valid);
        req[group.key][fieldName] = badFormat;

        pushNegative(result.negative.invalidFormat, {
          field: fieldName,
          location: group.key,
          badValue: badFormat,
          intent: `invalid_format_${intentPrefix}`,
          request: toRequestShape(req),
        });
      }

      for (const boundaryCase of buildBoundaryCases(schema)) {
        const req = clone(result.valid);
        req[group.key][fieldName] = boundaryCase.badValue;

        const item = {
          field: fieldName,
          location: group.key,
          badValue: boundaryCase.badValue,
          kind: boundaryCase.kind,
          intent: `${boundaryCase.kind}_${intentPrefix}`,
          request: toRequestShape(req),
        };

        pushNegative(result.negative.boundary, item);

        if (boundaryCase.kind === "above_max_length") {
          pushNegative(result.negative.stringTooLong, item);
        }

        if (boundaryCase.kind === "above_maximum") {
          pushNegative(result.negative.numericAboveMaximum, item);
        }
      }
    }
  }

  if (endpoint?.requestBody?.required) {
    const req = clone(result.valid);
    req.body = undefined;

    pushNegative(result.negative.missingRequired, {
      field: "request_body",
      location: "body",
      intent: "missing_required_request_body",
      request: toRequestShape(req),
    });
  }

  for (const bodyNeg of buildBodyRequiredFieldNegatives(
    result.valid.body,
    resolvedRequestSchema || {},
  )) {
    if (bodyNeg.kind === "body_missing_required_field") {
      pushNegative(result.negative.missingRequired, {
        field: bodyNeg.field,
        location: "body",
        intent: `missing_required_body_${String(bodyNeg.field).toLowerCase()}`,
        request: {
          path_params: clone(result.valid.path),
          query_params: clone(result.valid.query),
          headers: clone(result.valid.headers),
          cookies: clone(result.valid.cookies),
          request_body: clone(bodyNeg.requestBody),
        },
      });
    }

    if (bodyNeg.kind === "body_null_required_field") {
      pushNegative(result.negative.nullRequiredField, {
        field: bodyNeg.field,
        location: "body",
        badValue: null,
        intent: `null_required_body_${String(bodyNeg.field).toLowerCase()}`,
        request: {
          path_params: clone(result.valid.path),
          query_params: clone(result.valid.query),
          headers: clone(result.valid.headers),
          cookies: clone(result.valid.cookies),
          request_body: clone(bodyNeg.requestBody),
        },
      });
    }
  }

  if (auth === "required") {
    const missingAuthReq = clone(result.valid);
    delete missingAuthReq.headers.Authorization;

    pushNegative(result.negative.missingRequired, {
      field: "Authorization",
      location: "headers",
      intent: "missing_auth_token",
      request: toRequestShape(missingAuthReq),
    });
  }

  return result;
}
