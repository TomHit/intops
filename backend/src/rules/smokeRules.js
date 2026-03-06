export function shouldGenerateSmoke(endpoint) {
  if (endpoint?.responses && typeof endpoint.responses === "object") {
    return Object.keys(endpoint.responses).some((k) =>
      /^2\d\d$/.test(String(k)),
    );
  }

  const status = endpoint?.response?.status;
  return typeof status === "number" && status >= 200 && status < 300;
}
