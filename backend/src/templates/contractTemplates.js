function safeId(s) {
  return String(s || "")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function makeContractSuccessTemplate(endpoint) {
  const method = String(endpoint.method).toUpperCase();
  const path = endpoint.path;

  return {
    id: `contract_success.${safeId(method)}.${safeId(path)}`,
    title: `Contract | ${method} ${path} returns valid success response`,
    type: "contract",
    priority: "P1",
    method,
    path,
    request: {
      query: {},
      headers: {},
    },
    steps: [`Send ${method} request to ${path}`],
    expected: ["Response status is successful", "Response body is valid JSON"],
    assertions: [
      { op: "status_in_range", min: 200, max: 299 },
      { op: "json_parse_ok" },
    ],
    needs_review: true,
    review_notes: ["Auto generated baseline contract success test"],
  };
}

export function makeContractRequiredFieldsTemplate(endpoint) {
  const method = String(endpoint.method).toUpperCase();
  const path = endpoint.path;

  return {
    id: `contract_required_fields.${safeId(method)}.${safeId(path)}`,
    title: `Contract | ${method} ${path} required response fields are present`,
    type: "contract",
    priority: "P1",
    method,
    path,
    request: {
      query: {},
      headers: {},
    },
    steps: [
      `Send ${method} request to ${path}`,
      "Inspect response body for required fields",
    ],
    expected: ["Required response fields are present"],
    assertions: [{ op: "required_fields_present" }],
    needs_review: true,
    review_notes: ["Populate required fields from OpenAPI response schema"],
  };
}
