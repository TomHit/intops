function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function normalizeMethod(m) {
  return String(m || "").toUpperCase();
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

function pathParamNamesFromUrl(path) {
  const out = [];
  const matches = String(path || "").matchAll(/\{([^}]+)\}/g);
  for (const m of matches) {
    if (m?.[1]) out.push(m[1]);
  }
  return out;
}

function getPreferredRequestMedia(requestBody) {
  const content = requestBody?.content || {};
  return (
    content["application/json"] ||
    content["application/*+json"] ||
    content["application/x-www-form-urlencoded"] ||
    content["multipart/form-data"] ||
    Object.values(content)[0] ||
    null
  );
}

function getPreferredResponse(opResponses) {
  const responses = isObject(opResponses) ? opResponses : {};

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

  return {
    status: preferredStatus,
    response: responses[preferredStatus],
  };
}

function safeString(v, max = 300) {
  return v == null ? "" : String(v).slice(0, max);
}

function makeIssue({
  endpointId,
  severity,
  code,
  message,
  blocking = false,
  where = "",
  suggestedFix = null,
}) {
  return {
    endpoint_id: endpointId,
    severity, // "error" | "warning" | "info"
    code,
    message,
    blocking,
    where,
    suggested_fix: suggestedFix,
  };
}

function makeSchemaPatchSuggestionForFreeForm(endpoint) {
  const exPath = endpoint?.path || "/example";
  const exMethod = normalizeMethod(endpoint?.method || "POST").toLowerCase();

  return {
    type: "openapi_patch",
    format: "yaml",
    content: `paths:
  ${exPath}:
    ${exMethod}:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                sample_field:
                  type: string
                  example: sample_value
              additionalProperties: false`,
  };
}

function makeParamSchemaSuggestion(paramName, paramIn) {
  return {
    type: "openapi_patch",
    format: "yaml",
    content: `parameters:
  - name: ${paramName}
    in: ${paramIn}
    required: ${paramIn === "path" ? "true" : "false"}
    schema:
      type: string
    example: sample_${paramName}`,
  };
}

function validateParams(endpoint, issues) {
  const endpointId = endpoint.id;
  const params = endpoint.params || {};
  const allBuckets = ["path", "query", "header", "cookie"];
  const seen = new Set();

  for (const bucket of allBuckets) {
    const arr = Array.isArray(params?.[bucket]) ? params[bucket] : [];

    for (const p of arr) {
      const key = `${bucket}:${p?.name || ""}`;

      if (seen.has(key)) {
        issues.push(
          makeIssue({
            endpointId,
            severity: "warning",
            code: "PARAM_DUPLICATE",
            message: `Duplicate parameter '${p?.name}' found in '${bucket}'.`,
            blocking: false,
            where: `params.${bucket}`,
          }),
        );
      } else {
        seen.add(key);
      }

      if (!p?.name) {
        issues.push(
          makeIssue({
            endpointId,
            severity: "error",
            code: "PARAM_NAME_MISSING",
            message: `A parameter in '${bucket}' is missing a name.`,
            blocking: true,
            where: `params.${bucket}`,
            suggestedFix: makeParamSchemaSuggestion("param_name", bucket),
          }),
        );
      }

      if (!p?.schema) {
        issues.push(
          makeIssue({
            endpointId,
            severity: "error",
            code: "PARAM_SCHEMA_MISSING",
            message: `Parameter '${p?.name}' in '${bucket}' is missing schema.`,
            blocking: true,
            where: `params.${bucket}.${p?.name || "unknown"}`,
            suggestedFix: makeParamSchemaSuggestion(
              p?.name || "param_name",
              bucket,
            ),
          }),
        );
      }
    }
  }

  const pathParamsFromUrl = pathParamNamesFromUrl(endpoint.path);
  const declaredPathParams = new Set(
    (Array.isArray(params.path) ? params.path : [])
      .map((p) => p?.name)
      .filter(Boolean),
  );

  for (const urlParam of pathParamsFromUrl) {
    if (!declaredPathParams.has(urlParam)) {
      issues.push(
        makeIssue({
          endpointId,
          severity: "error",
          code: "PATH_PARAM_MISSING",
          message: `Path template variable '{${urlParam}}' is present in URL but not declared in parameters.`,
          blocking: true,
          where: "path",
          suggestedFix: makeParamSchemaSuggestion(urlParam, "path"),
        }),
      );
    }
  }
}

function validateRequestBody(endpoint, issues) {
  const endpointId = endpoint.id;
  const method = normalizeMethod(endpoint.method);
  const body = endpoint.requestBody;

  const methodsThatUsuallyNeedBody = ["POST", "PUT", "PATCH"];
  if (!body && methodsThatUsuallyNeedBody.includes(method)) {
    issues.push(
      makeIssue({
        endpointId,
        severity: "warning",
        code: "REQUEST_BODY_MISSING",
        message: `No request body found for ${method} endpoint.`,
        blocking: false,
        where: "requestBody",
      }),
    );
    return;
  }

  if (!body) return;

  if (!isObject(body.content) || Object.keys(body.content).length === 0) {
    issues.push(
      makeIssue({
        endpointId,
        severity: "error",
        code: "REQUEST_BODY_SCHEMA_MISSING",
        message: "Request body exists but content/schema is missing.",
        blocking: true,
        where: "requestBody.content",
      }),
    );
    return;
  }

  const media = getPreferredRequestMedia(body);
  const schema = media?.schema || null;
  const contentType = Object.entries(body.content || {}).find(
    ([, v]) => v === media,
  )?.[0];

  if (!schema) {
    issues.push(
      makeIssue({
        endpointId,
        severity: "error",
        code: "REQUEST_BODY_SCHEMA_MISSING",
        message: `Request body media type '${contentType || "unknown"}' is missing schema.`,
        blocking: true,
        where: "requestBody.content",
      }),
    );
    return;
  }

  const hasProperties =
    isObject(schema.properties) && Object.keys(schema.properties).length > 0;
  const hasExample =
    schema.example !== undefined || schema.examples !== undefined;
  const allowsAdditional =
    schema.additionalProperties === true ||
    schema.additionalProperties === undefined;

  const isFreeFormObject =
    (schema.type === "object" || schema.type === undefined) &&
    !hasProperties &&
    allowsAdditional;
  if (isFreeFormObject) {
    issues.push(
      makeIssue({
        endpointId,
        severity: "error",
        code: "REQUEST_BODY_FREE_FORM",
        message:
          "Request body is a free-form object with no properties or examples. Accurate payload cannot be generated.",
        blocking: true,
        where: "requestBody.content",
        suggestedFix: makeSchemaPatchSuggestionForFreeForm(endpoint),
      }),
    );
  }

  if (
    schema.type === "object" &&
    !hasProperties &&
    !hasExample &&
    !allowsAdditional
  ) {
    issues.push(
      makeIssue({
        endpointId,
        severity: "warning",
        code: "REQUEST_BODY_OBJECT_WEAK",
        message:
          "Request body object has no properties/example. Payload generation may be incomplete.",
        blocking: false,
        where: "requestBody.content",
      }),
    );
  }

  if (contentType === "multipart/form-data" && !hasProperties) {
    issues.push(
      makeIssue({
        endpointId,
        severity: "warning",
        code: "MULTIPART_FIELDS_MISSING",
        message:
          "Multipart request body has no field definitions. File/form payload cannot be generated accurately.",
        blocking: false,
        where: "requestBody.content.multipart/form-data",
      }),
    );
  }
}

function validateResponses(endpoint, issues) {
  const endpointId = endpoint.id;
  const responses = endpoint.responses || {};
  const preferred = getPreferredResponse(responses);

  if (!preferred) {
    issues.push(
      makeIssue({
        endpointId,
        severity: "error",
        code: "RESPONSE_2XX_MISSING",
        message: "Endpoint has no usable response definition.",
        blocking: true,
        where: "responses",
      }),
    );
    return;
  }

  const { status, response } = preferred;
  const content = response?.content || {};
  const media =
    content["application/json"] ||
    content["application/*+json"] ||
    Object.values(content)[0] ||
    null;

  if (status !== "204" && !media && (!response || !response.description)) {
    issues.push(
      makeIssue({
        endpointId,
        severity: "warning",
        code: "RESPONSE_SCHEMA_MISSING",
        message: `Response '${status}' has no content/schema.`,
        blocking: false,
        where: `responses.${status}`,
      }),
    );
    return;
  }

  if (media && media.schema == null) {
    issues.push(
      makeIssue({
        endpointId,
        severity: "warning",
        code: "RESPONSE_SCHEMA_MISSING",
        message: `Response '${status}' media type is present but schema is missing.`,
        blocking: false,
        where: `responses.${status}.content`,
      }),
    );
    return;
  }

  if (
    media &&
    isObject(media.schema) &&
    Object.keys(media.schema).length === 0
  ) {
    issues.push(
      makeIssue({
        endpointId,
        severity: "warning",
        code: "RESPONSE_SCHEMA_EMPTY",
        message: `Response '${status}' schema is empty object. Contract validation will be weak.`,
        blocking: false,
        where: `responses.${status}.content`,
      }),
    );
  }
}

function validateEndpointBasics(endpoint, issues) {
  const endpointId = endpoint.id;

  if (!endpoint.method) {
    issues.push(
      makeIssue({
        endpointId,
        severity: "error",
        code: "METHOD_MISSING",
        message: "Endpoint method is missing.",
        blocking: true,
        where: "method",
      }),
    );
  }

  if (!endpoint.path) {
    issues.push(
      makeIssue({
        endpointId,
        severity: "error",
        code: "PATH_MISSING",
        message: "Endpoint path is missing.",
        blocking: true,
        where: "path",
      }),
    );
  }

  if (!endpoint.summary && !endpoint.operationId) {
    issues.push(
      makeIssue({
        endpointId,
        severity: "warning",
        code: "SUMMARY_MISSING",
        message: "Endpoint has no summary or operationId.",
        blocking: false,
        where: "summary",
      }),
    );
  }
}

function endpointStatusFromIssues(issues) {
  if (issues.some((x) => x.blocking)) return "blocked";
  if (issues.length > 0) return "partial";
  return "ready";
}

function scoreFromIssues(allIssues) {
  let score = 100;

  for (const issue of allIssues) {
    if (issue.blocking || issue.severity === "error") {
      score -= 15;
    } else if (issue.severity === "warning") {
      score -= 5;
    } else {
      score -= 1;
    }
  }

  if (score < 0) score = 0;
  return score;
}

function validateRefIntegrity(openapiDoc, endpoints) {
  const issues = [];
  const endpointIds = new Set(endpoints.map((e) => e.id));

  function walk(node, endpointId, path = "root") {
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, endpointId, `${path}[${i}]`));
      return;
    }

    if (!isObject(node)) return;

    if (typeof node.$ref === "string") {
      const resolved = resolveRef(node.$ref, openapiDoc);
      if (!resolved) {
        issues.push(
          makeIssue({
            endpointId,
            severity: "error",
            code: "REF_UNRESOLVED",
            message: `Unresolved $ref '${safeString(node.$ref, 200)}'.`,
            blocking: true,
            where: path,
          }),
        );
      }
    }

    for (const [k, v] of Object.entries(node)) {
      walk(v, endpointId, `${path}.${k}`);
    }
  }

  for (const endpoint of endpoints) {
    if (!endpointIds.has(endpoint.id)) continue;
    walk(endpoint, endpoint.id, "endpoint");
  }

  return issues;
}

export function validateSpecQuality(openapiDoc, endpoints = []) {
  const endpointResults = [];
  const allIssues = [];

  for (const endpoint of endpoints) {
    const issues = [];

    validateEndpointBasics(endpoint, issues);
    validateParams(endpoint, issues);
    validateRequestBody(endpoint, issues);
    validateResponses(endpoint, issues);

    const status = endpointStatusFromIssues(issues);

    endpointResults.push({
      endpoint_id: endpoint.id,
      method: endpoint.method,
      path: endpoint.path,
      status,
      issues_count: issues.length,
      issues,
    });

    allIssues.push(...issues);
  }

  const refIssues = validateRefIntegrity(openapiDoc, endpoints);
  allIssues.push(...refIssues);

  if (refIssues.length > 0) {
    const refIssuesByEndpoint = new Map();

    for (const issue of refIssues) {
      const arr = refIssuesByEndpoint.get(issue.endpoint_id) || [];
      arr.push(issue);
      refIssuesByEndpoint.set(issue.endpoint_id, arr);
    }

    for (const row of endpointResults) {
      const extra = refIssuesByEndpoint.get(row.endpoint_id) || [];
      if (extra.length > 0) {
        row.issues.push(...extra);
        row.issues_count = row.issues.length;
        row.status = endpointStatusFromIssues(row.issues);
      }
    }
  }

  const summary = {
    total_endpoints: endpointResults.length,
    ready: endpointResults.filter((x) => x.status === "ready").length,
    partial: endpointResults.filter((x) => x.status === "partial").length,
    blocked: endpointResults.filter((x) => x.status === "blocked").length,
    total_issues: allIssues.length,
    blocking_issues: allIssues.filter((x) => x.blocking).length,
    warnings: allIssues.filter((x) => x.severity === "warning").length,
  };

  const spec_health_score = scoreFromIssues(allIssues);

  return {
    spec_health_score,
    summary,
    endpoint_results: endpointResults,
    issues: allIssues,
  };
}
