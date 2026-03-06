/**
 * Rule: endpoint has required query params
 */
export function shouldGenerateNegativeMissingRequiredQuery(endpoint) {
  return (
    Array.isArray(endpoint?.params?.query) &&
    endpoint.params.query.some((p) => p.required)
  );
}

/**
 * Rule: endpoint is protected by security/auth
 */
export function shouldGenerateAuthMissingCredentials(endpoint) {
  if (Array.isArray(endpoint?.security)) {
    return endpoint.security.length > 0;
  }

  return !!endpoint?.security;
}
