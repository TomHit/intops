function getResponseSchema(endpoint) {
  if (endpoint?.responses && typeof endpoint.responses === "object") {
    for (const [code, val] of Object.entries(endpoint.responses)) {
      if (!/^2\d\d$/.test(String(code))) continue;

      const content = val?.content || {};
      const schema =
        content["application/json"]?.schema ||
        content["application/*+json"]?.schema ||
        null;

      if (schema) return schema;
    }
  }

  return null;
}

function getRequestSchema(endpoint) {
  const content = endpoint?.requestBody?.content || {};
  return (
    content["application/json"]?.schema ||
    content["application/*+json"]?.schema ||
    null
  );
}

function getSchemaProperties(schema) {
  return schema?.properties && typeof schema.properties === "object"
    ? schema.properties
    : {};
}

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

export function shouldGenerateSchemaRequiredFields(endpoint) {
  const schema = getResponseSchema(endpoint);
  return Array.isArray(schema?.required) && schema.required.length > 0;
}

export function shouldGenerateSchemaTypedFields(endpoint) {
  const schema = getResponseSchema(endpoint);
  const props = getSchemaProperties(schema);

  return Object.values(props).some(
    (v) => !!v?.type || !!v?.format || !!v?.items || !!v?.properties,
  );
}

export function shouldGenerateSchemaEnum(endpoint) {
  const schema = getResponseSchema(endpoint);
  const props = getSchemaProperties(schema);

  return Object.values(props).some(
    (v) => Array.isArray(v?.enum) && v.enum.length > 0,
  );
}

export function shouldGenerateSchemaNestedObjects(endpoint) {
  const schema = getResponseSchema(endpoint);
  const props = getSchemaProperties(schema);

  return Object.values(props).some(
    (v) => v?.type === "object" || !!v?.properties,
  );
}

export function shouldGenerateSchemaArray(endpoint) {
  const schema = getResponseSchema(endpoint);
  const props = getSchemaProperties(schema);

  return Object.values(props).some((v) => v?.type === "array" || !!v?.items);
}

export function shouldGenerateSchemaFormat(endpoint) {
  const schema = getResponseSchema(endpoint);
  const props = getSchemaProperties(schema);

  return Object.values(props).some((v) => typeof v?.format === "string");
}

export function shouldGenerateSchemaNumericConstraints(endpoint) {
  const schema = getResponseSchema(endpoint);
  const props = getSchemaProperties(schema);

  return Object.values(props).some(
    (v) => v?.minimum !== undefined || v?.maximum !== undefined,
  );
}

export function shouldGenerateSchemaStringConstraints(endpoint) {
  const schema = getResponseSchema(endpoint);
  const props = getSchemaProperties(schema);

  return Object.values(props).some(
    (v) => v?.minLength !== undefined || v?.maxLength !== undefined,
  );
}

export function shouldGenerateSchemaPattern(endpoint) {
  const schema = getResponseSchema(endpoint);
  const props = getSchemaProperties(schema);

  return Object.values(props).some((v) => typeof v?.pattern === "string");
}

export function shouldGenerateSchemaComposition(endpoint) {
  const responseSchema = getResponseSchema(endpoint);
  const requestSchema = getRequestSchema(endpoint);

  return !!(
    responseSchema?.oneOf ||
    responseSchema?.anyOf ||
    responseSchema?.allOf ||
    requestSchema?.oneOf ||
    requestSchema?.anyOf ||
    requestSchema?.allOf
  );
}

export function shouldGenerateRequestBodyRequiredFields(endpoint) {
  const schema = getRequestSchema(endpoint);
  return Array.isArray(schema?.required) && schema.required.length > 0;
}
