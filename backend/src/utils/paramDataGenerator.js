import crypto from "crypto";

function randomInt(min = 1, max = 1000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomString(len = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function randomEmail() {
  return `qa_${randomString(6)}@example.com`;
}

function randomUuid() {
  return crypto.randomUUID();
}

function randomDateTime() {
  return new Date().toISOString();
}

function randomBool() {
  return Math.random() > 0.5;
}

function generateFromSchema(schema = {}, name = "") {
  if (!schema) return `<valid_${name}>`;

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }

  const type = schema.type || "string";
  const format = schema.format;

  if (format === "email") return randomEmail();
  if (format === "uuid") return randomUuid();
  if (format === "date-time") return randomDateTime();

  if (type === "integer" || type === "number") return randomInt();
  if (type === "boolean") return randomBool();
  if (type === "string") return randomString();

  if (type === "array") {
    return [generateFromSchema(schema.items || {}, name)];
  }

  if (type === "object") {
    const obj = {};
    const props = schema.properties || {};
    for (const k of Object.keys(props)) {
      obj[k] = generateFromSchema(props[k], k);
    }
    return obj;
  }

  return `<valid_${name}>`;
}

export function generateParamValue(param) {
  const schema = param?.schema || {};
  const name = param?.name || "param";
  return generateFromSchema(schema, name);
}

export function buildPathParams(endpoint) {
  const params = Array.isArray(endpoint?.params?.path)
    ? endpoint.params.path
    : [];

  const out = {};
  for (const p of params) {
    out[p.name] = generateParamValue(p);
  }
  return out;
}

export function buildQueryParams(endpoint) {
  const params = Array.isArray(endpoint?.params?.query)
    ? endpoint.params.query
    : [];

  const out = {};
  for (const p of params) {
    if (p.required) {
      out[p.name] = generateParamValue(p);
    } else {
      // optional param sometimes included
      if (Math.random() > 0.5) {
        out[p.name] = generateParamValue(p);
      }
    }
  }
  return out;
}

export function buildHeaders(endpoint) {
  const headers = {};

  if (Array.isArray(endpoint?.security) && endpoint.security.length > 0) {
    headers.Authorization = "Bearer <valid_token>";
  }

  const headerParams = Array.isArray(endpoint?.params?.header)
    ? endpoint.params.header
    : [];

  for (const p of headerParams) {
    headers[p.name] = generateParamValue(p);
  }

  return headers;
}
