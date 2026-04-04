export function detectRisks(signals = {}) {
  const risks = [];

  const endpointCount = Array.isArray(signals.endpoints)
    ? signals.endpoints.length
    : 0;

  const hasOperationalApi = endpointCount > 0;

  const hasAISignals =
    Boolean(signals.hasChat) ||
    Boolean(signals.hasSearch) ||
    Boolean(signals.hasPredict) ||
    Boolean(signals.hasPromptLikeInput) ||
    Boolean(signals.hasConversationFlow) ||
    Boolean(signals.hasRetrievalFlow) ||
    Boolean(signals.hasLLMClues) ||
    Boolean(signals.hasAIDescription);

  const hasRetrievalSignals =
    Boolean(signals.hasSearch) || Boolean(signals.hasRetrievalFlow);

  const hasModelSignals =
    Boolean(signals.hasPredict) || Boolean(signals.hasLLMClues);

  // -----------------------------
  // AI-specific risks
  // -----------------------------
  if (hasAISignals && signals.hasTextInput) {
    risks.push("prompt_injection");
  }

  if ((signals.hasChat || hasModelSignals) && hasAISignals) {
    risks.push("hallucination");
  }

  if (hasRetrievalSignals && hasAISignals) {
    risks.push("retrieval_mismatch");
  }

  if (hasAISignals && signals.hasFileInput && hasRetrievalSignals) {
    risks.push("document_poisoning");
  }

  // -----------------------------
  // Generic API / security risks
  // -----------------------------
  if (!signals.hasAuth && hasOperationalApi) {
    risks.push("unauthorized_access");
  }

  if (signals.hasFileInput) {
    risks.push("file_upload_security");
  }

  if (signals.hasTextInput || signals.hasFileInput) {
    risks.push("input_validation");
  }

  if (hasOperationalApi) {
    risks.push("rate_limit_abuse");
  }

  return [...new Set(risks)];
}
