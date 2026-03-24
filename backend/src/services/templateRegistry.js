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

/**
 * Main runtime registry:
 * templateEngine should only build contract + schema cases.
 * Negative + auth are owned by scenarioEngine now.
 */
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
};

/**
 * Legacy registry retained only for migration/debug purposes.
 * Do not use this from templateEngine main flow.
 */
export const LEGACY_TEMPLATE_REGISTRY = {
  "negative.missing_required_query": "scenarioEngine",
  "negative.missing_required_path": "scenarioEngine",
  "negative.unsupported_method": "scenarioEngine",
  "negative.invalid_content_type": "scenarioEngine",
  "negative.malformed_json": "scenarioEngine",
  "negative.empty_body": "scenarioEngine",
  "negative.resource_not_found": "scenarioEngine",
  "negative.invalid_query_type": "scenarioEngine",
  "negative.invalid_enum": "scenarioEngine",
  "negative.invalid_format": "scenarioEngine",
  "negative.string_too_long": "scenarioEngine",
  "negative.numeric_above_maximum": "scenarioEngine",
  "negative.additional_property": "scenarioEngine",
  "negative.conflict": "scenarioEngine",
  "negative.rate_limit": "scenarioEngine",
  "negative.invalid_pagination": "scenarioEngine",
  "negative.null_required_field": "scenarioEngine",

  "auth.missing_credentials": "scenarioEngine",
  "auth.invalid_credentials": "scenarioEngine",
  "auth.expired_credentials": "scenarioEngine",
  "auth.forbidden_role": "scenarioEngine",
};

export function getTemplateBuilder(templateKey) {
  const key = String(templateKey || "").trim();
  return TEMPLATE_REGISTRY[key] || null;
}

export function hasTemplateBuilder(templateKey) {
  return !!getTemplateBuilder(templateKey);
}

export function isScenarioOwnedTemplate(templateKey) {
  const key = String(templateKey || "").trim();
  return LEGACY_TEMPLATE_REGISTRY[key] === "scenarioEngine";
}
