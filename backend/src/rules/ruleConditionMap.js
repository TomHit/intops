import {
  shouldGenerateContractSuccess,
  shouldGenerateContractRequiredFields,
} from "./contractRules.js";

import {
  shouldGenerateSchemaResponse,
  shouldGenerateSchemaRequestBody,
} from "./schemaRules.js";

import {
  shouldGenerateNegativeMissingRequiredQuery,
  shouldGenerateAuthMissingCredentials,
} from "./negativeRules.js";

function endpointExists(endpoint) {
  return !!endpoint;
}

function normalizeMethod(method) {
  return String(method || "").toUpperCase();
}

function methodIsGet(endpoint) {
  return normalizeMethod(endpoint?.method) === "GET";
}

function methodIsPost(endpoint) {
  return normalizeMethod(endpoint?.method) === "POST";
}

function methodIsPut(endpoint) {
  return normalizeMethod(endpoint?.method) === "PUT";
}

function methodIsPatch(endpoint) {
  return normalizeMethod(endpoint?.method) === "PATCH";
}

function methodIsDelete(endpoint) {
  return normalizeMethod(endpoint?.method) === "DELETE";
}

function methodIsWrite(endpoint) {
  return ["POST", "PUT", "PATCH"].includes(normalizeMethod(endpoint?.method));
}

function getSuccessResponses(endpoint) {
  const responses = endpoint?.responses || {};
  return Object.entries(responses).filter(([code]) =>
    /^2\d\d$/.test(String(code)),
  );
}

function getFirstSuccessResponse(endpoint) {
  const matches = getSuccessResponses(endpoint);
  return matches.length > 0 ? matches[0][1] : null;
}

function responseHasContentType(endpoint) {
  const res = getFirstSuccessResponse(endpoint);
  const content = res?.content || {};
  return Object.keys(content).length > 0 || !!endpoint?.response?.contentType;
}

function responseHasHeaders(endpoint) {
  const res = getFirstSuccessResponse(endpoint);
  return !!(res?.headers && Object.keys(res.headers).length > 0);
}

function endpointHasPathParams(endpoint) {
  return (
    Array.isArray(endpoint?.params?.path) && endpoint.params.path.length > 0
  );
}

function endpointHasQueryParams(endpoint) {
  return (
    Array.isArray(endpoint?.params?.query) && endpoint.params.query.length > 0
  );
}

function requestBodyHasOptionalFields(endpoint) {
  const schema =
    endpoint?.requestBody?.content?.["application/json"]?.schema ||
    endpoint?.requestBody?.content?.["application/*+json"]?.schema ||
    null;

  const props = schema?.properties || {};
  const propKeys = Object.keys(props);
  const required = Array.isArray(schema?.required) ? schema.required : [];

  return propKeys.length > required.length;
}

function successResponseIs204(endpoint) {
  return !!endpoint?.responses?.["204"];
}

function endpointHasDocumentedError(endpoint) {
  const responses = endpoint?.responses || {};
  return Object.keys(responses).some((code) => /^[45]\d\d$/.test(String(code)));
}

function endpointHasSummaryOrOperationId(endpoint) {
  return !!endpoint?.summary;
}

function responseSchema(endpoint) {
  const responses = endpoint?.responses || {};

  for (const [code, val] of Object.entries(responses)) {
    if (!/^2\d\d$/.test(String(code))) continue;

    const schema =
      val?.content?.["application/json"]?.schema ||
      val?.content?.["application/*+json"]?.schema ||
      null;

    if (schema) return schema;
  }

  return null;
}

function responseSchemaHasEnum(endpoint) {
  const schema = responseSchema(endpoint);
  const props = schema?.properties || {};
  return Object.values(props).some(
    (p) => Array.isArray(p?.enum) && p.enum.length > 0,
  );
}

function responseSchemaHasNestedObjects(endpoint) {
  const schema = responseSchema(endpoint);
  const props = schema?.properties || {};
  return Object.values(props).some(
    (p) => p?.type === "object" || !!p?.properties,
  );
}

function responseSchemaHasArray(endpoint) {
  const schema = responseSchema(endpoint);
  const props = schema?.properties || {};
  return Object.values(props).some((p) => p?.type === "array" || !!p?.items);
}

function requestBodySchema(endpoint) {
  return (
    endpoint?.requestBody?.content?.["application/json"]?.schema ||
    endpoint?.requestBody?.content?.["application/*+json"]?.schema ||
    null
  );
}

function requestBodySchemaHasArray(endpoint) {
  const schema = requestBodySchema(endpoint);
  const props = schema?.properties || {};
  return Object.values(props).some((p) => p?.type === "array" || !!p?.items);
}

function responseSchemaHasNullable(endpoint) {
  const schema = responseSchema(endpoint);
  const props = schema?.properties || {};
  return Object.values(props).some((p) => p?.nullable === true);
}

function responseSchemaHasStringFormat(endpoint) {
  const schema = responseSchema(endpoint);
  const props = schema?.properties || {};
  return Object.values(props).some((p) => typeof p?.format === "string");
}

function responseSchemaHasNumericConstraints(endpoint) {
  const schema = responseSchema(endpoint);
  const props = schema?.properties || {};
  return Object.values(props).some(
    (p) => p?.minimum !== undefined || p?.maximum !== undefined,
  );
}

function responseSchemaHasStringConstraints(endpoint) {
  const schema = responseSchema(endpoint);
  const props = schema?.properties || {};
  return Object.values(props).some(
    (p) => p?.minLength !== undefined || p?.maxLength !== undefined,
  );
}

function responseSchemaHasPattern(endpoint) {
  const schema = responseSchema(endpoint);
  const props = schema?.properties || {};
  return Object.values(props).some((p) => typeof p?.pattern === "string");
}

function responseSchemaHasComposition(endpoint) {
  const schema = responseSchema(endpoint);
  return !!(schema?.oneOf || schema?.anyOf || schema?.allOf);
}

function requestBodySchemaHasComposition(endpoint) {
  const schema = requestBodySchema(endpoint);
  return !!(schema?.oneOf || schema?.anyOf || schema?.allOf);
}

function endpointHasPaginationParams(endpoint) {
  const names = (endpoint?.params?.query || []).map((p) =>
    String(p?.name || "").toLowerCase(),
  );
  return names.some((n) =>
    ["page", "limit", "offset", "pagesize", "page_size"].includes(n),
  );
}

function endpointHasSortingParams(endpoint) {
  const names = (endpoint?.params?.query || []).map((p) =>
    String(p?.name || "").toLowerCase(),
  );
  return names.some((n) =>
    ["sort", "sortby", "order", "orderby", "order_by"].includes(n),
  );
}

function endpointHasFilterParams(endpoint) {
  const names = (endpoint?.params?.query || []).map((p) =>
    String(p?.name || "").toLowerCase(),
  );
  return names.some(
    (n) => n.includes("filter") || n === "status" || n === "type",
  );
}

export const RULE_CONDITION_MAP = {
  endpoint_exists: endpointExists,

  endpoint_has_2xx_response: shouldGenerateContractSuccess,
  endpoint_has_documented_success_status: shouldGenerateContractSuccess,
  method_is_get_and_has_2xx_response: (endpoint) =>
    methodIsGet(endpoint) && shouldGenerateContractSuccess(endpoint),
  method_is_write_and_has_2xx_response: (endpoint) =>
    methodIsWrite(endpoint) && shouldGenerateContractSuccess(endpoint),

  response_has_content_type: responseHasContentType,
  response_has_headers: responseHasHeaders,
  endpoint_has_path_params: endpointHasPathParams,
  endpoint_has_query_params: endpointHasQueryParams,
  request_body_has_optional_fields: requestBodyHasOptionalFields,
  success_response_is_204: successResponseIs204,
  endpoint_has_documented_4xx_or_5xx: endpointHasDocumentedError,
  endpoint_has_summary_or_operationid: endpointHasSummaryOrOperationId,

  response_schema_exists: shouldGenerateSchemaResponse,
  response_has_required_fields: shouldGenerateContractRequiredFields,
  request_body_schema_exists: shouldGenerateSchemaRequestBody,
  request_body_has_required_fields: shouldGenerateSchemaRequestBody,

  response_schema_has_enum: responseSchemaHasEnum,
  response_schema_has_nested_objects: responseSchemaHasNestedObjects,
  response_schema_has_array: responseSchemaHasArray,
  request_body_schema_has_array: requestBodySchemaHasArray,
  response_schema_has_nullable: responseSchemaHasNullable,
  response_schema_has_string_format: responseSchemaHasStringFormat,
  response_schema_has_numeric_constraints: responseSchemaHasNumericConstraints,
  response_schema_has_string_constraints: responseSchemaHasStringConstraints,
  response_schema_has_pattern: responseSchemaHasPattern,
  response_schema_has_composition: responseSchemaHasComposition,
  request_body_schema_has_composition: requestBodySchemaHasComposition,

  endpoint_has_required_query: shouldGenerateNegativeMissingRequiredQuery,
  endpoint_requires_auth: shouldGenerateAuthMissingCredentials,

  method_is_delete: methodIsDelete,
  method_is_post_and_has_request_body: (endpoint) =>
    methodIsPost(endpoint) && shouldGenerateSchemaRequestBody(endpoint),
  method_is_put_or_patch_and_has_request_body: (endpoint) =>
    (methodIsPut(endpoint) || methodIsPatch(endpoint)) &&
    shouldGenerateSchemaRequestBody(endpoint),

  endpoint_has_pagination_params: endpointHasPaginationParams,
  endpoint_has_sorting_params: endpointHasSortingParams,
  endpoint_has_filter_params: endpointHasFilterParams,
  endpoint_has_sorting_or_filtering_params: (endpoint) =>
    endpointHasSortingParams(endpoint) || endpointHasFilterParams(endpoint),
};
