import {
  shouldGenerateContractSuccess,
  shouldGenerateContractRequiredFields,
} from "./contractRules.js";

import {
  shouldGenerateSchemaResponse,
  shouldGenerateSchemaRequestBody,
  shouldGenerateSchemaRequiredFields,
  shouldGenerateSchemaTypedFields,
  shouldGenerateSchemaEnum,
  shouldGenerateSchemaNestedObjects,
  shouldGenerateSchemaArray,
  shouldGenerateSchemaFormat,
  shouldGenerateSchemaNumericConstraints,
  shouldGenerateSchemaStringConstraints,
  shouldGenerateSchemaPattern,
  shouldGenerateSchemaComposition,
  shouldGenerateRequestBodyRequiredFields,
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

function endpointHasResourceIdentifier(endpoint) {
  return endpointHasPathParams(endpoint);
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
  return !!endpoint?.summary || !!endpoint?.operationId;
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

function requestBodySchema(endpoint) {
  return (
    endpoint?.requestBody?.content?.["application/json"]?.schema ||
    endpoint?.requestBody?.content?.["application/*+json"]?.schema ||
    null
  );
}

function responseOrRequestSchemaHasEnum(endpoint) {
  const responseProps = responseSchema(endpoint)?.properties || {};
  const requestProps = requestBodySchema(endpoint)?.properties || {};

  return [...Object.values(responseProps), ...Object.values(requestProps)].some(
    (p) => Array.isArray(p?.enum) && p.enum.length > 0,
  );
}

function queryParamsHaveTypedSchema(endpoint) {
  const query = Array.isArray(endpoint?.params?.query)
    ? endpoint.params.query
    : [];
  return query.some(
    (p) => !!p?.schema?.type || !!p?.type || !!p?.schema?.format,
  );
}

function schemaHasDateOrDatetimeFields(endpoint) {
  const responseProps = responseSchema(endpoint)?.properties || {};
  const requestProps = requestBodySchema(endpoint)?.properties || {};

  return [...Object.values(responseProps), ...Object.values(requestProps)].some(
    (p) => p?.format === "date" || p?.format === "date-time",
  );
}

function requestBodySchemaControlsAdditionalProperties(endpoint) {
  const schema = requestBodySchema(endpoint);
  return schema?.additionalProperties === false;
}

function requestContainsUniqueBusinessField(_endpoint) {
  return false;
}

function endpointCanConflict(_endpoint) {
  return false;
}

function endpointHasRateLimitContract(endpoint) {
  const responses = endpoint?.responses || {};
  return !!responses["429"];
}

function endpointRequiresRoleScope(endpoint) {
  return (
    !!endpoint?.security &&
    Array.isArray(endpoint.security) &&
    endpoint.security.length > 0
  );
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
  success_response_documented: shouldGenerateContractSuccess,
  method_is_get_and_has_2xx_response: (endpoint) =>
    methodIsGet(endpoint) && shouldGenerateContractSuccess(endpoint),
  method_is_write_and_has_2xx_response: (endpoint) =>
    methodIsWrite(endpoint) && shouldGenerateContractSuccess(endpoint),

  response_has_content_type: responseHasContentType,
  response_content_type_documented: responseHasContentType,

  response_has_headers: responseHasHeaders,
  response_headers_documented: responseHasHeaders,

  endpoint_has_path_params: endpointHasPathParams,
  path_params_documented: endpointHasPathParams,

  endpoint_has_query_params: endpointHasQueryParams,
  query_params_documented: endpointHasQueryParams,

  request_body_has_optional_fields: requestBodyHasOptionalFields,
  success_response_is_204: successResponseIs204,

  endpoint_has_documented_4xx_or_5xx: endpointHasDocumentedError,
  error_responses_documented: endpointHasDocumentedError,

  endpoint_has_summary_or_operationid: endpointHasSummaryOrOperationId,
  operation_metadata_exists: endpointHasSummaryOrOperationId,

  response_schema_exists: shouldGenerateSchemaResponse,
  response_has_required_fields: shouldGenerateContractRequiredFields,

  request_body_schema_exists: shouldGenerateSchemaRequestBody,
  request_body_documented: shouldGenerateSchemaRequestBody,

  request_body_has_required_fields: shouldGenerateRequestBodyRequiredFields,

  response_schema_has_required_fields: shouldGenerateSchemaRequiredFields,
  response_schema_has_typed_fields: shouldGenerateSchemaTypedFields,
  response_schema_has_enum_fields: shouldGenerateSchemaEnum,
  response_schema_has_nested_objects: shouldGenerateSchemaNestedObjects,
  response_schema_has_array_fields: shouldGenerateSchemaArray,
  response_schema_has_format_fields: shouldGenerateSchemaFormat,
  response_schema_has_numeric_constraints:
    shouldGenerateSchemaNumericConstraints,
  response_schema_has_string_constraints: shouldGenerateSchemaStringConstraints,
  response_schema_has_pattern_fields: shouldGenerateSchemaPattern,

  schema_has_composition: shouldGenerateSchemaComposition,

  endpoint_has_required_query: shouldGenerateNegativeMissingRequiredQuery,
  endpoint_requires_auth: shouldGenerateAuthMissingCredentials,
  endpoint_requires_role_scope: endpointRequiresRoleScope,

  endpoint_has_resource_identifier: endpointHasResourceIdentifier,
  query_params_have_typed_schema: queryParamsHaveTypedSchema,
  response_or_request_schema_has_enum: responseOrRequestSchemaHasEnum,
  schema_has_string_format: shouldGenerateSchemaFormat,
  schema_has_string_constraints: shouldGenerateSchemaStringConstraints,
  schema_has_numeric_constraints: shouldGenerateSchemaNumericConstraints,
  schema_has_pattern: shouldGenerateSchemaPattern,
  schema_has_date_or_datetime_fields: schemaHasDateOrDatetimeFields,
  request_body_schema_controls_additional_properties:
    requestBodySchemaControlsAdditionalProperties,
  request_contains_unique_business_field: requestContainsUniqueBusinessField,
  endpoint_can_conflict: endpointCanConflict,
  endpoint_has_rate_limit_contract: endpointHasRateLimitContract,

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
