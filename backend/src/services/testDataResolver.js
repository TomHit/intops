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
      if (isObject(first) && first.value !== undefined)
        return clone(first.value);
      if (first !== undefined) return clone(first);
    }
  }

  return undefined;
}

function inferStringFromPattern(pattern) {
  if (!pattern || typeof pattern !== "string") return undefined;
  if (pattern === "^[A-Z]{3}$") return "ABC";
  if (pattern === "^[A-Z]{2,5}$") return "TEST";
  return undefined;
}

function resolveValidPrimitive(schema = {}) {
  const exampleValue = firstDefined(
    pickExample(schema),
    schema.default,
    Array.isArray(schema.enum) && schema.enum.length > 0
      ? schema.enum[0]
      : undefined,
  );

  if (exampleValue !== undefined) {
    return { value: exampleValue, source: "example/default/enum" };
  }

  if (schema.format === "uuid") {
    return { value: "123e4567-e89b-12d3-a456-426614174000", source: "format" };
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

  const patternValue = inferStringFromPattern(schema.pattern);
  if (patternValue !== undefined) {
    return { value: patternValue, source: "pattern" };
  }

  switch (schema.type) {
    case "integer":
      return {
        value: Number.isFinite(schema.minimum) ? schema.minimum : 1,
        source: "type",
      };
    case "number":
      return {
        value: Number.isFinite(schema.minimum) ? schema.minimum : 1.5,
        source: "type",
      };
    case "boolean":
      return { value: true, source: "type" };
    case "array":
      return { value: [], source: "type" };
    case "object":
      return { value: {}, source: "type" };
    case "string":
    default:
      if (schema.minLength && schema.minLength > 0) {
        return {
          value: "a".repeat(Math.max(schema.minLength, 1)),
          source: "type",
        };
      }
      return { value: "sample", source: "type" };
  }
}

function resolveValidValue(schema = {}) {
  if (!schema || typeof schema !== "object") {
    return { value: "sample", source: "fallback" };
  }

  if (schema.oneOf?.length) return resolveValidValue(schema.oneOf[0]);
  if (schema.anyOf?.length) return resolveValidValue(schema.anyOf[0]);
  if (schema.allOf?.length)
    return resolveObjectSchema({ type: "object", allOf: schema.allOf });

  if (schema.type === "object" || schema.properties) {
    return resolveObjectSchema(schema);
  }

  if (schema.type === "array") {
    const itemResolved = resolveValidValue(schema.items || { type: "string" });
    return {
      value: [itemResolved.value],
      source: `array:${itemResolved.source}`,
    };
  }

  return resolveValidPrimitive(schema);
}

function resolveObjectSchema(schema = {}) {
  const out = {};
  const required = Array.isArray(schema.required)
    ? new Set(schema.required)
    : new Set();
  const props = isObject(schema.properties) ? schema.properties : {};

  for (const [name, propSchema] of Object.entries(props)) {
    if (required.size > 0 && !required.has(name)) continue;
    const resolved = resolveValidValue(propSchema || {});
    out[name] = resolved.value;
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

function buildInvalidFormatValue(schema = {}) {
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
function toRequestShape(valid) {
  return {
    path_params: clone(valid.path),
    query_params: clone(valid.query),
    headers: clone(valid.headers),
    request_body: clone(valid.body),
  };
}

export function resolveEndpointTestData(endpoint) {
  const result = {
    valid: {
      path: {},
      query: {},
      headers: {},
      body: undefined,
    },
    negative: {
      missingRequired: [],
      invalidType: [],
      invalidEnum: [],
      invalidFormat: [],
      stringTooLong: [],
      numericAboveMaximum: [],
      boundary: [],
    },
    sourceMap: {},
  };

  const groups = [
    { key: "path", fields: endpoint?.params?.path || [] },
    { key: "query", fields: endpoint?.params?.query || [] },
    { key: "headers", fields: endpoint?.params?.header || [] },
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
        resolved = resolveValidValue(schema);
      }

      result.valid[group.key][field.name] = resolved.value;
      result.sourceMap[`${group.key}.${field.name}`] = resolved.source;
    }
  }

  const preferredBodyType = endpoint?.requestBody?.preferredContentType;
  const preferredBody = preferredBodyType
    ? endpoint?.requestBody?.content?.[preferredBodyType]
    : null;

  if (preferredBody?.example !== undefined) {
    result.valid.body = clone(preferredBody.example);
    result.sourceMap.body = "request_body_example";
  } else if (preferredBody?.schema) {
    const resolvedBody = resolveValidValue(preferredBody.schema);
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

      if (Array.isArray(schema.enum) && schema.enum.length > 0) {
        const badEnum = "__INVALID_ENUM__";
        const req = clone(result.valid);
        req[group.key][fieldName] = badEnum;
        result.negative.invalidEnum.push({
          field: fieldName,
          location: group.key,
          badValue: badEnum,
          request: toRequestShape(req),
        });
      }

      const badFormat = buildInvalidFormatValue(schema);
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

  return result;
}
