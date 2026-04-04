export function buildProjectSummary({ signals, projectCard }) {
  const patterns =
    projectCard.ai_patterns?.length > 0
      ? projectCard.ai_patterns.join(", ")
      : "no clear AI patterns";

  const risks =
    projectCard.risk_tags?.length > 0
      ? projectCard.risk_tags.join(", ")
      : "no major risks detected yet";

  return `This project appears to be a ${projectCard.project_type}. It exposes ${signals.endpointCount || 0} endpoints and shows patterns such as ${patterns}. Key risks currently inferred are ${risks}.`;
}
