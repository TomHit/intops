export function detectProjectType(signals) {
  if (signals.hasChat && signals.hasSearch) {
    return "RAG chatbot";
  }

  if (signals.hasChat) {
    return "Conversational AI";
  }

  if (signals.hasPredict) {
    return "ML API";
  }

  return "Generic API";
}
