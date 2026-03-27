function normalizeMethod(m) {
  return String(m || "").toUpperCase();
}

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}
export function extractEndpointsFullSelected(openapiDoc, selectedRefs = []) {
  const paths = openapiDoc?.paths || {};
  const out = [];
  const servers = buildServers(openapiDoc);

  const selectedSet = new Set(
    (selectedRefs || []).map(
      (e) => `${normalizeMethod(e?.method)} ${String(e?.path || "")}`,
    ),
  );

  for (const pth of Object.keys(paths)) {
    const pathItem = paths[pth] || {};

    for (const m of Object.keys(pathItem)) {
      const method = normalizeMethod(m);
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        continue;
      }

      const key = `${method} ${pth}`;
      if (selectedSet.size > 0 && !selectedSet.has(key)) continue;

      const op = pathItem[m];
      if (!isObject(op)) continue;

      const params = parseParams(pathItem, op, openapiDoc);

      const requestBody =
        normalizeRequestBody(op?.requestBody, openapiDoc) ||
        buildSwagger2RequestBody(pathItem, op, openapiDoc);

      const response = pickBestResponse(pathItem, op, openapiDoc);
      const tags = Array.isArray(op?.tags) ? op.tags : [];
      const summary = op?.summary || op?.operationId || "";
      const security = op?.security || openapiDoc?.security || [];

      out.push({
        id: `${method} ${pth}`,
        method,
        path: pth,
        host: openapiDoc?.host || "",
        basePath: openapiDoc?.basePath || "",
        schemes: Array.isArray(openapiDoc?.schemes) ? openapiDoc.schemes : [],
        servers,
        tags,
        summary: summary ? String(summary).slice(0, 160) : "",
        operationId: op?.operationId || "",
        description: op?.description
          ? String(op.description).slice(0, 500)
          : "",
        deprecated: !!op?.deprecated,
        security,
        requires_auth: hasAuth(op, openapiDoc),
        params,
        requestBody,
        response,
        responses: clone(op?.responses || {}),
      });
    }
  }

  return out;
}

function clone(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
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

function buildSwagger2ParamSchema(param = {}) {
  if (isObject(param.schema)) return clone(param.schema);

  const schema = {};

  if (param.type !== undefined) schema.type = param.type;
  if (param.format !== undefined) schema.format = param.format;
  if (param.enum !== undefined) schema.enum = clone(param.enum);
  if (param.default !== undefined) schema.default = clone(param.default);
  if (param.example !== undefined) schema.example = clone(param.example);
  if (param.pattern !== undefined) schema.pattern = param.pattern;
  if (param.minLength !== undefined) schema.minLength = param.minLength;
  if (param.maxLength !== undefined) schema.maxLength = param.maxLength;
  if (param.minimum !== undefined) schema.minimum = param.minimum;
  if (param.maximum !== undefined) schema.maximum = param.maximum;
  if (param.collectionFormat !== undefined) {
    schema.collectionFormat = param.collectionFormat;
  }

  if (param.items !== undefined) {
    schema.items = clone(param.items);
  }

  return Object.keys(schema).length > 0 ? schema : null;
}

function normalizeSchema(schema, openapiDoc, seenRefs = new Set()) {
  if (!isObject(schema)) return null;

  if (schema.$ref) {
    const ref = schema.$ref;
    if (seenRefs.has(ref)) return clone(schema);

    const resolved = resolveRef(ref, openapiDoc);
    if (!resolved) return clone(schema);

    const nextSeen = new Set(seenRefs);
    nextSeen.add(ref);

    const merged = normalizeSchema(resolved, openapiDoc, nextSeen) || {};
    return {
      ...clone(merged),
      ...Object.fromEntries(
        Object.entries(schema).filter(([k]) => k !== "$ref"),
      ),
    };
  }

  const out = clone(schema);

  if (isObject(out.properties)) {
    const newProps = {};
    for (const [key, value] of Object.entries(out.properties)) {
      newProps[key] = normalizeSchema(value, openapiDoc, seenRefs);
    }
    out.properties = newProps;
  }

  if (out.items) {
    out.items = normalizeSchema(out.items, openapiDoc, seenRefs);
  }

  if (Array.isArray(out.allOf)) {
    out.allOf = out.allOf.map((x) => normalizeSchema(x, openapiDoc, seenRefs));
  }

  if (Array.isArray(out.oneOf)) {
    out.oneOf = out.oneOf.map((x) => normalizeSchema(x, openapiDoc, seenRefs));
  }

  if (Array.isArray(out.anyOf)) {
    out.anyOf = out.anyOf.map((x) => normalizeSchema(x, openapiDoc, seenRefs));
  }

  if (out.additionalProperties && isObject(out.additionalProperties)) {
    out.additionalProperties = normalizeSchema(
      out.additionalProperties,
      openapiDoc,
      seenRefs,
    );
  }

  return out;
}

function resolveParameterObject(p, openapiDoc, seenRefs = new Set()) {
  if (!isObject(p)) return null;

  if (p.$ref) {
    const ref = p.$ref;
    if (seenRefs.has(ref)) return null;

    const resolved = resolveRef(ref, openapiDoc);
    if (!resolved) return null;

    const nextSeen = new Set(seenRefs);
    nextSeen.add(ref);

    const deref = resolveParameterObject(resolved, openapiDoc, nextSeen);
    if (!deref) return null;

    return {
      ...clone(deref),
      ...Object.fromEntries(Object.entries(p).filter(([k]) => k !== "$ref")),
    };
  }

  return clone(p);
}

function normalizeParam(p, openapiDoc) {
  const param = resolveParameterObject(p, openapiDoc);
  if (!isObject(param) || !param.name || !param.in) return null;

  const rawSchema = buildSwagger2ParamSchema(param);
  const schema = rawSchema ? normalizeSchema(rawSchema, openapiDoc) : null;

  return {
    name: param.name,
    in: param.in,
    required: !!param.required,
    description: param.description
      ? String(param.description).slice(0, 240)
      : "",
    style: param.style,
    explode: param.explode,
    deprecated: !!param.deprecated,
    allowEmptyValue: !!param.allowEmptyValue,
    example: pickExample(param) ?? pickExample(schema),
    schema,
    schemaSummary: summarizeSchema(schema),
  };
}

function buildSyntheticAuthParams(op, openapiDoc) {
  const out = [];
  const securityReqs = Array.isArray(op?.security)
    ? op.security
    : Array.isArray(openapiDoc?.security)
      ? openapiDoc.security
      : [];

  const schemes =
    openapiDoc?.components?.securitySchemes ||
    openapiDoc?.securityDefinitions ||
    {};

  const seen = new Set();

  for (const req of securityReqs) {
    if (!isObject(req)) continue;

    for (const schemeName of Object.keys(req)) {
      const scheme = schemes?.[schemeName];
      if (!isObject(scheme)) continue;

      if (scheme.type === "http" && scheme.scheme === "bearer") {
        const key = "header:Authorization";
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
          name: "Authorization",
          in: "header",
          required: true,
          description: `Auth header from security scheme '${schemeName}'`,
          example: "Bearer <token>",
          schema: { type: "string" },
          schemaSummary: { type: "string" },
          synthetic: true,
          authScheme: schemeName,
          authType: "bearer",
        });
        continue;
      }

      if (scheme.type === "apiKey") {
        const paramName = scheme.name;
        const paramIn = scheme.in;

        if (!paramName || !["header", "cookie", "query"].includes(paramIn)) {
          continue;
        }

        const key = `${paramIn}:${paramName}`;
        if (seen.has(key)) continue;
        seen.add(key);

        let example = `<${paramName}_value>`;
        if (String(paramName).toLowerCase().includes("token")) {
          example = "sample-token-123";
        }
        if (String(paramName).toLowerCase().includes("key")) {
          example = "sample-api-key-123";
        }

        out.push({
          name: paramName,
          in: paramIn,
          required: true,
          description: `API key ${paramIn} from security scheme '${schemeName}'`,
          example,
          schema: { type: "string" },
          schemaSummary: { type: "string" },
          synthetic: true,
          authScheme: schemeName,
          authType: "apiKey",
        });
        continue;
      }

      if (scheme.type === "oauth2") {
        const key = "header:Authorization";
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
          name: "Authorization",
          in: "header",
          required: true,
          description: `OAuth2 auth header from security scheme '${schemeName}'`,
          example: "Bearer <access_token>",
          schema: { type: "string" },
          schemaSummary: { type: "string" },
          synthetic: true,
          authScheme: schemeName,
          authType: "oauth2",
        });
      }
    }
  }

  return out;
}

function getOperationConsumes(pathItem, op, openapiDoc) {
  if (Array.isArray(op?.consumes) && op.consumes.length > 0) return op.consumes;
  if (Array.isArray(pathItem?.consumes) && pathItem.consumes.length > 0) {
    return pathItem.consumes;
  }
  if (Array.isArray(openapiDoc?.consumes) && openapiDoc.consumes.length > 0) {
    return openapiDoc.consumes;
  }
  return ["application/json"];
}

function getOperationProduces(pathItem, op, openapiDoc) {
  if (Array.isArray(op?.produces) && op.produces.length > 0) return op.produces;
  if (Array.isArray(pathItem?.produces) && pathItem.produces.length > 0) {
    return pathItem.produces;
  }
  if (Array.isArray(openapiDoc?.produces) && openapiDoc.produces.length > 0) {
    return openapiDoc.produces;
  }
  return ["application/json"];
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

function buildSwagger2RequestBody(pathItem, op, openapiDoc) {
  const merged = [
    ...(Array.isArray(pathItem?.parameters) ? pathItem.parameters : []),
    ...(Array.isArray(op?.parameters) ? op.parameters : []),
  ];

  const resolvedParams = merged
    .map((p) => resolveParameterObject(p, openapiDoc))
    .filter(Boolean);

  const bodyParam = resolvedParams.find((p) => p?.in === "body");
  const formParams = resolvedParams.filter((p) => p?.in === "formData");

  const consumes = getOperationConsumes(pathItem, op, openapiDoc);

  if (bodyParam?.schema) {
    const content = {};
    for (const contentType of consumes) {
      const schema = normalizeSchema(bodyParam.schema, openapiDoc);
      content[contentType] = {
        example: pickExample(bodyParam) ?? pickExample(schema),
        schema,
        schemaSummary: summarizeSchema(schema),
      };
    }

    const preferredType = content["application/json"]
      ? "application/json"
      : Object.keys(content)[0] || null;

    return {
      required: !!bodyParam.required,
      description: bodyParam.description
        ? String(bodyParam.description).slice(0, 240)
        : "",
      content,
      preferredContentType: preferredType,
    };
  }

  if (formParams.length > 0) {
    const properties = {};
    const required = [];

    for (const p of formParams) {
      const paramSchema = normalizeSchema(
        buildSwagger2ParamSchema(p) || {},
        openapiDoc,
      ) || {
        type: p.type,
        format: p.format,
        enum: p.enum,
        items: p.items ? normalizeSchema(p.items, openapiDoc) : undefined,
      };

      properties[p.name] = paramSchema;
      if (p.required) required.push(p.name);
    }

    const schema = {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    };

    const content = {};
    for (const contentType of consumes) {
      content[contentType] = {
        example: undefined,
        schema,
        schemaSummary: summarizeSchema(schema),
      };
    }

    const preferredType = content["application/x-www-form-urlencoded"]
      ? "application/x-www-form-urlencoded"
      : content["multipart/form-data"]
        ? "multipart/form-data"
        : Object.keys(content)[0] || null;

    return {
      required: required.length > 0,
      description: "",
      content,
      preferredContentType: preferredType,
    };
  }

  return null;
}

function resolveRequestBodyObject(
  requestBody,
  openapiDoc,
  seenRefs = new Set(),
) {
  if (!isObject(requestBody)) return null;

  if (requestBody.$ref) {
    const ref = requestBody.$ref;
    if (seenRefs.has(ref)) return null;

    const resolved = resolveRef(ref, openapiDoc);
    if (!resolved) return null;

    const nextSeen = new Set(seenRefs);
    nextSeen.add(ref);

    const deref = resolveRequestBodyObject(resolved, openapiDoc, nextSeen);
    if (!deref) return null;

    return {
      ...clone(deref),
      ...Object.fromEntries(
        Object.entries(requestBody).filter(([k]) => k !== "$ref"),
      ),
    };
  }

  return clone(requestBody);
}

function normalizeRequestBody(requestBody, openapiDoc) {
  const body = resolveRequestBodyObject(requestBody, openapiDoc);
  if (!isObject(body)) return null;

  const content = normalizeMediaContent(body.content || {}, openapiDoc);

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
    required: !!body.required,
    description: body.description ? String(body.description).slice(0, 240) : "",
    content,
    preferredContentType: preferredType,
  };
}

function resolveResponseObject(resp, openapiDoc, seenRefs = new Set()) {
  if (!isObject(resp)) return null;

  if (resp.$ref) {
    const ref = resp.$ref;
    if (seenRefs.has(ref)) return null;

    const resolved = resolveRef(ref, openapiDoc);
    if (!resolved) return null;

    const nextSeen = new Set(seenRefs);
    nextSeen.add(ref);

    const deref = resolveResponseObject(resolved, openapiDoc, nextSeen);
    if (!deref) return null;

    return {
      ...clone(deref),
      ...Object.fromEntries(Object.entries(resp).filter(([k]) => k !== "$ref")),
    };
  }

  return clone(resp);
}

function normalizeSwagger2Response(responseObj, produces, openapiDoc) {
  if (!isObject(responseObj)) return null;

  const schema = normalizeSchema(responseObj.schema || null, openapiDoc);
  const headers = clone(responseObj.headers || {});
  const examples = clone(responseObj.examples || {});

  const content = {};
  for (const contentType of produces) {
    const example =
      examples?.[contentType] ??
      pickExample(responseObj) ??
      pickExample(schema);

    content[contentType] = {
      example,
      schema,
      schemaSummary: summarizeSchema(schema),
    };
  }

  const preferredContentType = content["application/json"]
    ? "application/json"
    : Object.keys(content)[0] || null;

  return {
    description: responseObj.description
      ? String(responseObj.description).slice(0, 240)
      : "",
    headers,
    contentType: preferredContentType,
    content,
    schemaSummary: preferredContentType
      ? content[preferredContentType]?.schemaSummary || null
      : null,
  };
}

function pickBestResponse(pathItem, op, openapiDoc) {
  const responses = isObject(op?.responses) ? op.responses : {};

  const successCodes = Object.keys(responses)
    .filter((code) => /^2\d\d$/.test(String(code)))
    .sort((a, b) => Number(a) - Number(b));

  const preferredStatus =
    successCodes[0] || (responses.default ? "default" : null);

  if (!preferredStatus) return null;

  const chosen = resolveResponseObject(responses[preferredStatus], openapiDoc);
  if (!chosen) return null;

  if (chosen.content) {
    const content = normalizeMediaContent(chosen.content || {}, openapiDoc);

    const preferredContentType = content["application/json"]
      ? "application/json"
      : content["application/*+json"]
        ? "application/*+json"
        : Object.keys(content)[0] || null;

    return {
      status: preferredStatus,
      description: chosen.description
        ? String(chosen.description).slice(0, 240)
        : "",
      headers: clone(chosen.headers || {}),
      contentType: preferredContentType,
      content,
      schemaSummary: preferredContentType
        ? content[preferredContentType]?.schemaSummary || null
        : null,
    };
  }

  const produces = getOperationProduces(pathItem, op, openapiDoc);
  const normalized = normalizeSwagger2Response(chosen, produces, openapiDoc);

  return normalized
    ? {
        status: preferredStatus,
        ...normalized,
      }
    : null;
}

function parseParams(pathItem, op, openapiDoc) {
  const out = {
    query: [],
    path: [],
    header: [],
    cookie: [],
  };

  const merged = [
    ...(Array.isArray(pathItem?.parameters) ? pathItem.parameters : []),
    ...(Array.isArray(op?.parameters) ? op.parameters : []),
  ];

  const seen = new Set();

  for (const p of merged) {
    const resolved = resolveParameterObject(p, openapiDoc);
    if (!resolved) continue;

    // body/formData handled in requestBody normalization
    if (resolved.in === "body" || resolved.in === "formData") continue;

    const n = normalizeParam(resolved, openapiDoc);
    if (!n) continue;

    const key = `${n.in}:${n.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!out[n.in]) out[n.in] = [];
    out[n.in].push(n);
  }

  const authParams = buildSyntheticAuthParams(op, openapiDoc);

  for (const p of authParams) {
    const key = `${p.in}:${p.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!out[p.in]) out[p.in] = [];
    out[p.in].push(p);
  }

  return out;
}

function buildServers(openapiDoc) {
  if (Array.isArray(openapiDoc?.servers) && openapiDoc.servers.length > 0) {
    return clone(openapiDoc.servers);
  }

  const host = String(openapiDoc?.host || "").trim();
  const basePath = String(openapiDoc?.basePath || "").trim();
  const schemes =
    Array.isArray(openapiDoc?.schemes) && openapiDoc.schemes.length > 0
      ? openapiDoc.schemes
      : ["https"];

  if (!host) return [];

  return schemes.map((scheme) => ({
    url: `${scheme}://${host}${basePath}`,
  }));
}

function hasAuth(op, openapiDoc) {
  const securityReqs = Array.isArray(op?.security)
    ? op.security
    : Array.isArray(openapiDoc?.security)
      ? openapiDoc.security
      : [];

  return securityReqs.length > 0;
}
export function extractEndpointsLite(openapiDoc) {
  const paths = openapiDoc?.paths || {};
  const out = [];
  const servers = buildServers(openapiDoc);

  for (const pth of Object.keys(paths)) {
    const pathItem = paths[pth] || {};

    for (const m of Object.keys(pathItem)) {
      const method = normalizeMethod(m);
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        continue;
      }

      const op = pathItem[m];
      if (!isObject(op)) continue;

      const tags = Array.isArray(op?.tags) ? op.tags : [];
      const summary = op?.summary || op?.operationId || "";
      const security = op?.security || openapiDoc?.security || [];

      out.push({
        id: `${method} ${pth}`,
        method,
        path: pth,
        host: openapiDoc?.host || "",
        basePath: openapiDoc?.basePath || "",
        schemes: Array.isArray(openapiDoc?.schemes) ? openapiDoc.schemes : [],
        servers,
        tags,
        summary: summary ? String(summary).slice(0, 160) : "",
        operationId: op?.operationId || "",
        description: op?.description
          ? String(op.description).slice(0, 300)
          : "",
        deprecated: !!op?.deprecated,
        security,
        requires_auth: hasAuth(op, openapiDoc),
      });
    }
  }

  return out;
}
export function extractEndpointsFull(openapiDoc) {
  const paths = openapiDoc?.paths || {};
  const out = [];
  const servers = buildServers(openapiDoc);

  for (const pth of Object.keys(paths)) {
    const pathItem = paths[pth] || {};

    for (const m of Object.keys(pathItem)) {
      const method = normalizeMethod(m);
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        continue;
      }

      const op = pathItem[m];
      if (!isObject(op)) continue;

      const params = parseParams(pathItem, op, openapiDoc);

      const requestBody =
        normalizeRequestBody(op?.requestBody, openapiDoc) ||
        buildSwagger2RequestBody(pathItem, op, openapiDoc);

      const response = pickBestResponse(pathItem, op, openapiDoc);
      const tags = Array.isArray(op?.tags) ? op.tags : [];
      const summary = op?.summary || op?.operationId || "";
      const security = op?.security || openapiDoc?.security || [];

      out.push({
        id: `${method} ${pth}`,
        method,
        path: pth,
        host: openapiDoc?.host || "",
        basePath: openapiDoc?.basePath || "",
        schemes: Array.isArray(openapiDoc?.schemes) ? openapiDoc.schemes : [],
        servers,
        tags,
        summary: summary ? String(summary).slice(0, 160) : "",
        operationId: op?.operationId || "",
        description: op?.description
          ? String(op.description).slice(0, 500)
          : "",
        deprecated: !!op?.deprecated,
        security,
        requires_auth: hasAuth(op, openapiDoc),
        params,
        requestBody,
        response,
        responses: clone(op?.responses || {}),
      });
    }
  }

  return out;
}
