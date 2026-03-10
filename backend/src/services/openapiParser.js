function normalizeMethod(m) {
  return String(m || "").toUpperCase();
}

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function pickExample(obj) {
  if (!isObject(obj)) return undefined;

  if (obj.example !== undefined) return clone(obj.example);

  if (obj.examples !== undefined) {
    if (Array.isArray(obj.examples) && obj.examples.length > 0) {
      return clone(obj.examples[0]);
    }
    if (isObject(obj.examples)) {
      const first = Object.values(obj.examples)[0];
      if (isObject(first) && first.value !== undefined) {
        return clone(first.value);
      }
      if (first !== undefined) return clone(first);
    }
  }

  return undefined;
}

function resolveRef(ref, openapiDoc) {
  if (
    typeof ref !== "string" ||
    !ref.startsWith("#/") ||
    !isObject(openapiDoc)
  ) {
    return null;
  }

  const parts = ref.slice(2).split("/");
  let cur = openapiDoc;

  for (const rawPart of parts) {
    const part = rawPart.replace(/~1/g, "/").replace(/~0/g, "~");
    cur = cur?.[part];
    if (cur === undefined) return null;
  }

  return cur || null;
}

function dereferenceSchema(schema, openapiDoc, seenRefs = new Set()) {
  if (!isObject(schema)) return schema;

  if (schema.$ref) {
    const ref = schema.$ref;

    if (seenRefs.has(ref)) {
      return { ...schema };
    }

    const resolved = resolveRef(ref, openapiDoc);
    if (!resolved) {
      return { ...schema };
    }

    const nextSeen = new Set(seenRefs);
    nextSeen.add(ref);

    const derefResolved = dereferenceSchema(resolved, openapiDoc, nextSeen);

    const merged = {
      ...clone(derefResolved),
      ...Object.fromEntries(
        Object.entries(schema).filter(([k]) => k !== "$ref"),
      ),
    };

    return merged;
  }

  const out = { ...clone(schema) };

  if (isObject(out.properties)) {
    const newProps = {};
    for (const [key, value] of Object.entries(out.properties)) {
      newProps[key] = dereferenceSchema(value, openapiDoc, seenRefs);
    }
    out.properties = newProps;
  }

  if (out.items) {
    out.items = dereferenceSchema(out.items, openapiDoc, seenRefs);
  }

  if (Array.isArray(out.allOf)) {
    out.allOf = out.allOf.map((x) =>
      dereferenceSchema(x, openapiDoc, seenRefs),
    );
  }

  if (Array.isArray(out.oneOf)) {
    out.oneOf = out.oneOf.map((x) =>
      dereferenceSchema(x, openapiDoc, seenRefs),
    );
  }

  if (Array.isArray(out.anyOf)) {
    out.anyOf = out.anyOf.map((x) =>
      dereferenceSchema(x, openapiDoc, seenRefs),
    );
  }

  if (out.additionalProperties && isObject(out.additionalProperties)) {
    out.additionalProperties = dereferenceSchema(
      out.additionalProperties,
      openapiDoc,
      seenRefs,
    );
  }

  return out;
}

function summarizeSchema(schema) {
  if (!isObject(schema)) return null;

  const type = schema.type || (schema.properties ? "object" : undefined);
  const required = Array.isArray(schema.required)
    ? schema.required.slice(0, 20)
    : [];
  const props =
    schema.properties && typeof schema.properties === "object"
      ? Object.keys(schema.properties).slice(0, 30)
      : [];

  return {
    type,
    required,
    properties: props,
    enum: Array.isArray(schema.enum) ? schema.enum.slice(0, 10) : undefined,
    format: schema.format,
    pattern: schema.pattern,
    minLength: schema.minLength,
    maxLength: schema.maxLength,
    minimum: schema.minimum,
    maximum: schema.maximum,
  };
}

function normalizeSchema(schema, openapiDoc) {
  if (!isObject(schema)) return null;
  return dereferenceSchema(schema, openapiDoc);
}

function normalizeParam(p, openapiDoc) {
  if (!isObject(p) || !p.name || !p.in) return null;

  const schema = normalizeSchema(p.schema || {}, openapiDoc);

  return {
    name: p.name,
    in: p.in,
    required: !!p.required,
    description: p.description ? String(p.description).slice(0, 240) : "",
    style: p.style,
    explode: p.explode,
    deprecated: !!p.deprecated,
    allowEmptyValue: !!p.allowEmptyValue,
    example: pickExample(p) ?? pickExample(schema),
    schema,
    schemaSummary: summarizeSchema(schema),
  };
}

function parseParams(pathItem, op, openapiDoc) {
  const out = { query: [], path: [], header: [], cookie: [] };
  const merged = [
    ...(Array.isArray(pathItem?.parameters) ? pathItem.parameters : []),
    ...(Array.isArray(op?.parameters) ? op.parameters : []),
  ];

  const seen = new Set();

  for (const p of merged) {
    const n = normalizeParam(p, openapiDoc);
    if (!n) continue;

    const key = `${n.in}:${n.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!out[n.in]) out[n.in] = [];
    out[n.in].push(n);
  }

  return out;
}

function normalizeMediaContent(content = {}, openapiDoc) {
  const out = {};

  for (const [contentType, media] of Object.entries(content || {})) {
    const schema = normalizeSchema(media?.schema || null, openapiDoc);

    out[contentType] = {
      example: pickExample(media) ?? pickExample(schema),
      schema,
      schemaSummary: summarizeSchema(schema),
    };
  }

  return out;
}

function normalizeRequestBody(requestBody, openapiDoc) {
  if (!isObject(requestBody)) return null;

  const content = normalizeMediaContent(requestBody.content || {}, openapiDoc);
  const preferredType = content["application/json"]
    ? "application/json"
    : content["application/*+json"]
      ? "application/*+json"
      : content["application/x-www-form-urlencoded"]
        ? "application/x-www-form-urlencoded"
        : content["multipart/form-data"]
          ? "multipart/form-data"
          : Object.keys(content)[0] || null;

  return {
    required: !!requestBody.required,
    description: requestBody.description
      ? String(requestBody.description).slice(0, 240)
      : "",
    content,
    preferredContentType: preferredType,
  };
}

function pickBestResponse(op, openapiDoc) {
  const responses = isObject(op?.responses) ? op.responses : {};
  const preferredStatus = responses["200"]
    ? "200"
    : responses["201"]
      ? "201"
      : responses["202"]
        ? "202"
        : responses["204"]
          ? "204"
          : responses.default
            ? "default"
            : Object.keys(responses)[0] || null;

  if (!preferredStatus) return null;

  const chosen = responses[preferredStatus];
  const content = normalizeMediaContent(chosen?.content || {}, openapiDoc);
  const preferredContentType = content["application/json"]
    ? "application/json"
    : content["application/*+json"]
      ? "application/*+json"
      : Object.keys(content)[0] || null;

  return {
    status: preferredStatus,
    description: chosen?.description
      ? String(chosen.description).slice(0, 240)
      : "",
    contentType: preferredContentType,
    content,
    schemaSummary: preferredContentType
      ? content[preferredContentType]?.schemaSummary || null
      : null,
  };
}

export function extractEndpoints(openapiDoc) {
  const paths = openapiDoc?.paths || {};
  const out = [];

  for (const pth of Object.keys(paths)) {
    const pathItem = paths[pth] || {};

    for (const m of Object.keys(pathItem)) {
      const method = normalizeMethod(m);
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) continue;

      const op = pathItem[m];
      const tags = Array.isArray(op?.tags) ? op.tags : [];
      const summary = op?.summary || op?.operationId || "";
      const params = parseParams(pathItem, op, openapiDoc);
      const requestBody = normalizeRequestBody(op?.requestBody, openapiDoc);
      const resp = pickBestResponse(op, openapiDoc);

      out.push({
        id: `${method} ${pth}`,
        method,
        path: pth,
        tags,
        summary: summary ? String(summary).slice(0, 160) : "",
        operationId: op?.operationId || "",
        description: op?.description
          ? String(op.description).slice(0, 500)
          : "",
        deprecated: !!op?.deprecated,
        params,
        requestBody,
        response: resp,
        responses: clone(op?.responses || {}),
        security: op?.security || openapiDoc?.security || [],
      });
    }
  }

  return out;
}
