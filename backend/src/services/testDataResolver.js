function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
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
  if (pattern.includes("@")) return "qa@example.com";

  return undefined;
}

function fieldNameHints(fieldName = "") {
  const n = String(fieldName || "").toLowerCase();

  if (n === "email" || n.endsWith("_email") || n.includes("email")) {
    return "qa@example.com";
  }
  if (n === "password" || n.includes("password") || n === "passcode") {
    return "Secret123!";
  }
  if (
    n === "username" ||
    n === "user_name" ||
    n.includes("username") ||
    n === "login"
  ) {
    return "testuser";
  }
  if (n === "phone" || n.includes("phone") || n.includes("mobile")) {
    return "9876543210";
  }
  if (n === "first_name") return "John";
  if (n === "last_name") return "Doe";
  if (n === "fullname" || n === "full_name" || n === "name") return "John Doe";
  if (n === "city") return "Mumbai";
  if (n === "country") return "India";
  if (n === "state") return "MH";
  if (n === "zip" || n === "zipcode" || n === "postal_code") return "400001";
  if (n === "url" || n.endsWith("_url") || n.includes("website")) {
    return "https://example.com";
  }
  if (n === "authorization" || n === "auth") return "Bearer sample-token-123";
  if (n.includes("bearer")) return "Bearer sample-token-123";
  if (n === "token" || n.includes("token")) return "sample-token-123";
  if (n === "api_key" || n === "apikey" || n.includes("api_key")) {
    return "sample-api-key-123";
  }
  if (n.includes("session")) return "sample-session-token";
  if (n.includes("csrf")) return "csrf-token-123";
  if (n === "x-device-token" || n === "device-token") {
    return "sample-device-token";
  }
  if (n.includes("device")) return "device-123";
  if (n === "otp" || n.includes("otp")) return "123456";
  if (n === "code" || n.endsWith("_code")) return "123456";
  if (n === "status") return "active";
  if (n === "type") return "default";
  if (n === "role") return "user";
  if (n === "slug") return "sample-slug";
  if (n === "title") return "Sample Title";
  if (n === "description") return "Sample description";
  if (n === "address") return "221B Baker Street";
  if (n === "dob" || n === "birth_date") return "1990-01-01";
  if (n === "date") return "2026-01-01";
  if (n === "datetime" || n.endsWith("_at") || n.includes("timestamp")) {
    return "2026-01-01T00:00:00Z";
  }
  if (n === "id" || n.endsWith("_id") || n === "userid" || n === "user_id") {
    return "sample-id";
  }

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
  const fieldHint = fieldNameHints(fieldName);

  if (
    fieldHint !== undefined &&
    (schema.type === "integer" || schema.type === "number")
  ) {
    return {
      value: schema.type === "integer" ? 123 : 123.45,
      source: "field_hint_numeric",
    };
  }

  if (fieldHint !== undefined && schema.type !== "boolean") {
    return {
      value: coerceStringLength(fieldHint, schema),
      source: "field_hint",
    };
  }

  if (schema.format === "uuid") {
    return {
      value: "123e4567-e89b-12d3-a456-426614174000",
      source: "format",
    };
  }
  if (schema.format === "email") {
    return { value: "qa@example.com", source: "format" };
  }
  if (schema.format === "date") {
    return { value: "2026-01-01", source: "format" };
  }
  if (schema.format === "date-time") {
    return { value: "2026-01-01T00:00:00Z", source: "format" };
  }
  if (schema.format === "uri" || schema.format === "url") {
    return { value: "https://example.com/resource", source: "format" };
  }
  if (schema.format === "binary") {
    return { value: "sample-file.bin", source: "format" };
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
      return { value: true, source: "type" };

    case "array":
      return { value: [], source: "type" };

    case "object":
      return { value: {}, source: "type" };

    case "string":
    default: {
      let str = "sample";

      if (fieldHint !== undefined) {
        str = fieldHint;
      } else if (typeof schema.minLength === "number" && schema.minLength > 0) {
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

function resolveObjectSchema(schema = {}) {
  const out = {};
  const required = Array.isArray(schema.required)
    ? new Set(schema.required)
    : new Set();
  const props = isObject(schema.properties) ? schema.properties : {};

  const entries = Object.entries(props);

  for (const [name, propSchema] of entries) {
    const shouldInclude =
      required.size === 0 ? Object.keys(out).length < 3 : required.has(name);

    if (!shouldInclude) continue;

    const resolved = resolveValidValue(propSchema || {}, name);
    out[name] = resolved.value;
  }

  if (Object.keys(out).length === 0 && entries.length > 0) {
    const [firstName, firstSchema] = entries[0];
    const resolved = resolveValidValue(firstSchema || {}, firstName);
    out[firstName] = resolved.value;
  }

  if (Object.keys(out).length === 0) {
    return { value: {}, source: "object-empty" };
  }

  return { value: out, source: "object" };
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

export function resolveEndpointTestData(endpoint) {
  const result = {
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

      // Path params should be realistic values for manual execution
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
            value: field?.name?.toLowerCase().includes("id")
              ? "123"
              : "sample-id",
            source: "path_string_sample",
          };
        }
      }

      result.valid[group.key][field.name] = resolved.value;
      result.sourceMap[`${group.key}.${field.name}`] = resolved.source;
    }
  }
  // Default headers for manual execution
  if (!result.valid.headers["Accept"]) {
    result.valid.headers["Accept"] = "application/json";
    result.sourceMap["headers.Accept"] = "default_header";
  }

  if (!result.valid.headers["Content-Type"] && endpoint?.requestBody) {
    result.valid.headers["Content-Type"] =
      endpoint.requestBody.preferredContentType || "application/json";
    result.sourceMap["headers.Content-Type"] = "default_header";
  }

  const preferredBodyType = endpoint?.requestBody?.preferredContentType;
  const preferredBody = preferredBodyType
    ? endpoint?.requestBody?.content?.[preferredBodyType]
    : null;
  const bodyExample = firstDefined(
    preferredBody?.example,
    pickExample(preferredBody),
    pickExample(preferredBody?.schema),
  );

  if (bodyExample !== undefined) {
    result.valid.body = clone(bodyExample);
    result.sourceMap.body = "request_body_example";
  } else if (preferredBody?.schema) {
    const resolvedBody = resolveValidValue(
      preferredBody.schema,
      "request_body",
    );
    result.valid.body = resolvedBody.value;
    result.sourceMap.body = `request_body_${resolvedBody.source}`;
  }

  for (const group of groups) {
    for (const field of group.fields) {
      const schema = field?.schema || {};
      const fieldName = field.name;
      const validValue = result.valid[group.key][fieldName];

      if (field.required) {
        const missingReq = clone(result.valid);
        delete missingReq[group.key][fieldName];
        result.negative.missingRequired.push({
          field: fieldName,
          location: group.key,
          request: toRequestShape(missingReq),
        });
      }

      const badType = buildInvalidTypeValue(schema, validValue);
      if (badType !== undefined) {
        const req = clone(result.valid);
        req[group.key][fieldName] = badType;
        result.negative.invalidType.push({
          field: fieldName,
          location: group.key,
          badValue: badType,
          request: toRequestShape(req),
        });
      }

      const badEnum = buildInvalidEnumValue(schema);
      if (badEnum !== undefined) {
        const req = clone(result.valid);
        req[group.key][fieldName] = badEnum;
        result.negative.invalidEnum.push({
          field: fieldName,
          location: group.key,
          badValue: badEnum,
          request: toRequestShape(req),
        });
      }

      const badFormat = buildInvalidFormatValue(schema, fieldName);
      if (badFormat !== undefined) {
        const req = clone(result.valid);
        req[group.key][fieldName] = badFormat;
        result.negative.invalidFormat.push({
          field: fieldName,
          location: group.key,
          badValue: badFormat,
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
          request: toRequestShape(req),
        };

        result.negative.boundary.push(item);

        if (boundaryCase.kind === "above_max_length") {
          result.negative.stringTooLong.push(item);
        }

        if (boundaryCase.kind === "above_maximum") {
          result.negative.numericAboveMaximum.push(item);
        }
      }
    }
  }

  if (endpoint?.requestBody?.required) {
    const req = clone(result.valid);
    req.body = undefined;
    result.negative.missingRequired.push({
      field: "request_body",
      location: "body",
      request: toRequestShape(req),
    });
  }

  for (const bodyNeg of buildBodyRequiredFieldNegatives(
    result.valid.body,
    preferredBody?.schema || {},
  )) {
    if (bodyNeg.kind === "body_missing_required_field") {
      result.negative.missingRequired.push({
        field: bodyNeg.field,
        location: "body",
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
      result.negative.nullRequiredField.push({
        field: bodyNeg.field,
        location: "body",
        badValue: null,
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

  return result;
}
