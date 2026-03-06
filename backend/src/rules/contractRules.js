/**
 * Rule: endpoint has a success response
 */
export function shouldGenerateContractSuccess(endpoint) {
  if (endpoint?.responses && typeof endpoint.responses === "object") {
    return Object.keys(endpoint.responses).some((k) =>
      /^2\d\d$/.test(String(k)),
    );
  }

  const status = endpoint?.response?.status;
  return typeof status === "number" && status >= 200 && status < 300;
}

/**
 * Rule: endpoint has a response schema / required fields worth validating
 */
export function shouldGenerateContractRequiredFields(endpoint) {
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
