import { extractSignals } from "./signalExtractor.js";
import { buildProjectCard } from "./projectCardBuilder.js";

export function analyzeOpenAPI(openapi) {
  const signals = extractSignals(openapi);
  const projectCard = buildProjectCard(signals);

  return {
    signals,
    projectCard,
  };
}
