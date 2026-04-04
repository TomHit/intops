export function inferWorkflow(signals = {}) {
  const flow = [];

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

  const hasConversationSignals =
    Boolean(signals.hasChat) || Boolean(signals.hasConversationFlow);

  const hasModelSignals =
    Boolean(signals.hasPredict) || Boolean(signals.hasLLMClues);

  // AI-style ingestion should only happen when upload/file input
  // is connected to an AI or retrieval-style workflow.
  if (signals.hasUpload && (hasRetrievalSignals || hasAISignals)) {
    flow.push("ingest");
  }

  if (hasRetrievalSignals) {
    flow.push("retrieve");
  }

  if (hasConversationSignals) {
    flow.push("llm");
  }

  if (hasModelSignals) {
    flow.push("predict");
  }

  // For non-AI operational APIs, classify as CRUD if endpoints exist
  // but no AI workflow was detected.
  const hasEndpoints =
    Array.isArray(signals.endpoints) && signals.endpoints.length > 0;

  if (hasEndpoints && flow.length === 0) {
    flow.push("crud");
  }

  return [...new Set(flow)];
}
