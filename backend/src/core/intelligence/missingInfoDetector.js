export function detectMissing(signals) {
  const missing = [];

  if (!signals.hasAuth) {
    missing.push("authentication");
  }

  // Add more later
  missing.push("rate_limiting");
  missing.push("input_validation");

  return missing;
}
