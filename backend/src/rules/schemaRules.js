/**
 * Rule: endpoint has a response schema
 */
export function shouldGenerateSchemaResponse(endpoint) {
  if (endpoint?.responses && typeof endpoint.responses === "object") {
    for (const [code, val] of Object.entries(endpoint.responses)) {
      if (!/^2\d\d$/.test(String(code))) continue;

      const content = val?.content || {};
      const appJson =
        content["application/json"] || content["application/*+json"];

      if (appJson?.schema) return true;
    }
  }

  return !!endpoint?.response?.schemaSummary;
}

/**
 * Rule: endpoint has a request body schema
 */
export function shouldGenerateSchemaRequestBody(endpoint) {
  const content = endpoint?.requestBody?.content || {};
  return !!(
    content["application/json"]?.schema || content["application/*+json"]?.schema
  );
}
