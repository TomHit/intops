import {
  makeContractSuccessTemplate,
  makeContractRequiredFieldsTemplate,
} from "../templates/contractTemplates.js";

import {
  makeSchemaResponseTemplate,
  makeSchemaRequestBodyTemplate,
} from "../templates/schemaTemplates.js";

import { makeNegativeMissingRequiredQueryTemplate } from "../templates/negativeTemplates.js";

import { makeAuthMissingCredentialsTemplate } from "../templates/authTemplates.js";

/**
 * Helper: check if endpoint has a success response
 */
function hasSuccessResponse(endpoint) {
  const responses = endpoint?.responses || endpoint?.response || null;
  if (!responses) return false;

  const keys = Object.keys(responses || {});
  return keys.some((k) => /^2\d\d$/.test(String(k)));
}

/**
 * Helper: check if response likely has schema
 */
function hasResponseSchema(endpoint) {
  const responses = endpoint?.responses || endpoint?.response || null;
  if (!responses) return false;

  for (const [code, val] of Object.entries(responses)) {
    if (!/^2\d\d$/.test(String(code))) continue;

    const content = val?.content || {};
    const appJson = content["application/json"];
    if (appJson?.schema) return true;
  }

  return false;
}

/**
 * Helper: check if request body schema exists
 */
function hasRequestBodySchema(endpoint) {
  return !!endpoint?.requestBody?.content?.["application/json"]?.schema;
}

/**
 * Helper: check required query params
 */
function hasRequiredQuery(endpoint) {
  return (
    Array.isArray(endpoint?.params?.query) &&
    endpoint.params.query.some((p) => p.required)
  );
}

/**
 * Helper: check auth/security
 */
function hasSecurity(endpoint) {
  if (Array.isArray(endpoint?.security)) {
    return endpoint.security.length > 0;
  }
  return !!endpoint?.security;
}

/**
 * Generate all applicable test cases for one endpoint
 */
export function generateCasesForEndpoint(endpoint, options = {}) {
  const include = Array.isArray(options?.include)
    ? options.include
    : ["smoke", "contract", "negative"];

  const cases = [];

  // -----------------------------
  // CONTRACT / SMOKE templates
  // -----------------------------
  if (
    (include.includes("smoke") || include.includes("contract")) &&
    hasSuccessResponse(endpoint)
  ) {
    cases.push(makeContractSuccessTemplate(endpoint));
  }

  if (include.includes("contract") && hasResponseSchema(endpoint)) {
    cases.push(makeContractRequiredFieldsTemplate(endpoint));
  }

  // -----------------------------
  // SCHEMA templates
  // -----------------------------
  if (include.includes("contract") && hasResponseSchema(endpoint)) {
    cases.push(makeSchemaResponseTemplate(endpoint));
  }

  if (include.includes("contract") && hasRequestBodySchema(endpoint)) {
    cases.push(makeSchemaRequestBodyTemplate(endpoint));
  }

  // -----------------------------
  // NEGATIVE templates
  // -----------------------------
  if (include.includes("negative") && hasRequiredQuery(endpoint)) {
    cases.push(makeNegativeMissingRequiredQueryTemplate(endpoint));
  }

  // -----------------------------
  // AUTH templates
  // -----------------------------
  if (
    (include.includes("negative") || include.includes("auth")) &&
    hasSecurity(endpoint)
  ) {
    cases.push(makeAuthMissingCredentialsTemplate(endpoint));
  }

  return cases;
}

/**
 * Generate test cases for multiple endpoints
 */
export function generateCasesForEndpoints(endpoints, options = {}) {
  const eps = Array.isArray(endpoints) ? endpoints : [];
  let allCases = [];

  for (const endpoint of eps) {
    const cases = generateCasesForEndpoint(endpoint, options);
    allCases = allCases.concat(cases);
  }

  return allCases;
}
