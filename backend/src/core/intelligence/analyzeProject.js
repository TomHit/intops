import { extractSignals } from "./signalExtractor.js";
import { detectProjectType } from "./projectClassifier.js";
import { buildProjectCard } from "./projectCardBuilder.js";
import { buildProjectSummary } from "./summaryBuilder.js";

export async function analyzeProject(input) {
  const { openapi, projectNotes, githubData } = input;

  const signals = extractSignals({
    openapi,
    projectNotes,
    githubData,
  });

  const projectType = detectProjectType(signals);

  const projectCard = buildProjectCard({
    signals,
    projectType,
  });

  const summary = buildProjectSummary({
    signals,
    projectCard,
  });

  return {
    status: "completed",
    summary,
    confidence: projectCard.confidence || 0,
    signals,
    projectCard,
  };
}
