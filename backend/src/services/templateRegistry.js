import {
  makeContractSuccessTemplate,
  makeContractStatusCodeTemplate,
  makeContractRequiredFieldsTemplate,
  makeContractContentTypeTemplate,
  makeContractResponseHeadersTemplate,
  makeContractQueryParamsTemplate,
  makeContractPathParamsTemplate,
  makeContractRequestBodyTemplate,
  makeContractErrorResponseTemplate,
} from "../templates/contractTemplates.js";

import {
  makeSchemaResponseTemplate,
  makeSchemaRequiredFieldsTemplate,
  makeSchemaFieldTypesTemplate,
  makeSchemaEnumTemplate,
  makeSchemaNestedObjectsTemplate,
  makeSchemaArrayTemplate,
  makeSchemaFormatTemplate,
  makeSchemaNumericConstraintsTemplate,
  makeSchemaStringConstraintsTemplate,
  makeSchemaPatternTemplate,
  makeSchemaCompositionTemplate,
  makeSchemaRequestBodyTemplate,
} from "../templates/schemaTemplates.js";

import {
  makeNegativeMissingRequiredQueryTemplate,
  makeNegativeMissingRequiredPathTemplate,
  makeNegativeUnsupportedMethodTemplate,
  makeNegativeInvalidContentTypeTemplate,
  makeNegativeMalformedJsonTemplate,
  makeNegativeEmptyBodyTemplate,
  makeNegativeResourceNotFoundTemplate,
} from "../templates/negativeTemplates.js";

import {
  makeAuthMissingCredentialsTemplate,
  makeAuthInvalidCredentialsTemplate,
  makeAuthExpiredCredentialsTemplate,
  makeAuthForbiddenRoleTemplate,
} from "../templates/authTemplates.js";
export const TEMPLATE_REGISTRY = {
  "contract.success": makeContractSuccessTemplate,

  "contract.required_fields": makeContractRequiredFieldsTemplate,
  "contract.status_code": makeContractStatusCodeTemplate,
  "contract.content_type": makeContractContentTypeTemplate,
  "contract.response_headers": makeContractResponseHeadersTemplate,
  "contract.query_params": makeContractQueryParamsTemplate,
  "contract.path_params": makeContractPathParamsTemplate,
  "contract.request_body": makeContractRequestBodyTemplate,
  "contract.error_response": makeContractErrorResponseTemplate,

  "schema.response": makeSchemaResponseTemplate,
  "schema.required_fields": makeSchemaRequiredFieldsTemplate,
  "schema.field_types": makeSchemaFieldTypesTemplate,
  "schema.enum": makeSchemaEnumTemplate,
  "schema.nested_objects": makeSchemaNestedObjectsTemplate,
  "schema.array": makeSchemaArrayTemplate,
  "schema.format": makeSchemaFormatTemplate,
  "schema.numeric_constraints": makeSchemaNumericConstraintsTemplate,
  "schema.string_constraints": makeSchemaStringConstraintsTemplate,
  "schema.pattern": makeSchemaPatternTemplate,
  "schema.composition": makeSchemaCompositionTemplate,
  "schema.request_body": makeSchemaRequestBodyTemplate,

  "negative.missing_required_query": makeNegativeMissingRequiredQueryTemplate,
  "negative.missing_required_path": makeNegativeMissingRequiredPathTemplate,
  "negative.unsupported_method": makeNegativeUnsupportedMethodTemplate,
  "negative.invalid_content_type": makeNegativeInvalidContentTypeTemplate,
  "negative.malformed_json": makeNegativeMalformedJsonTemplate,
  "negative.empty_body": makeNegativeEmptyBodyTemplate,
  "negative.resource_not_found": makeNegativeResourceNotFoundTemplate,

  "auth.missing_credentials": makeAuthMissingCredentialsTemplate,
  "auth.invalid_credentials": makeAuthInvalidCredentialsTemplate,
  "auth.expired_credentials": makeAuthExpiredCredentialsTemplate,
  "auth.forbidden_role": makeAuthForbiddenRoleTemplate,
};
