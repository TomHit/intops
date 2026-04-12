function normalizeText(value = "") {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/[□]/g, "→")
    .replace(/\s+/g, " ")
    .trim();
}

function joinList(items = [], conjunction = "and") {
  const clean = (items || []).map((x) => normalizeText(x)).filter(Boolean);

  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} ${conjunction} ${clean[1]}`;

  return `${clean.slice(0, -1).join(", ")}, ${conjunction} ${
    clean[clean.length - 1]
  }`;
}

function humanizeFlow(items = []) {
  return (items || [])
    .map((x) => normalizeText(x))
    .filter(Boolean)
    .join(" → ");
}

function limit(items = [], count = 5) {
  return (items || []).filter(Boolean).slice(0, count);
}

export function renderStoryExecutiveSummary(summary = {}, storySignals = {}) {
  const parts = [];

  const systemType = normalizeText(summary?.system_identity?.system_type || "");
  const domain = normalizeText(summary?.system_identity?.domain || "");
  const actors = limit(summary?.actors || [], 4);
  const capabilities = limit(summary?.capabilities || [], 5);
  const primary = limit(summary?.workflows?.primary || [], 5);
  const secondary = limit(summary?.workflows?.secondary || [], 4);

  const explicitAction = normalizeText(
    storySignals?.intent?.action_phrase || "",
  );
  const explicitBenefit = normalizeText(
    storySignals?.intent?.benefit_phrase || "",
  );

  if (systemType || domain) {
    parts.push(
      `This user story appears to describe ${
        systemType || "a software workflow"
      }${domain ? ` in ${domain}` : ""}.`,
    );
  }

  if (explicitAction) {
    parts.push(
      `The explicit user intent is to ${explicitAction}${
        explicitBenefit ? ` so that ${explicitBenefit}` : ""
      }.`,
    );
  }

  if (actors.length > 0) {
    parts.push(`The main actors appear to be ${joinList(actors)}.`);
  }

  if (capabilities.length > 0) {
    parts.push(
      `Based on the story, the likely functional scope includes ${joinList(
        capabilities,
      )}.`,
    );
  }

  if (primary.length > 0) {
    parts.push(
      `The inferred workflow likely follows ${humanizeFlow(primary)}.`,
    );
  }

  if (secondary.length > 0) {
    parts.push(`Supporting behaviors may include ${joinList(secondary)}.`);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function renderStoryQaSummary(summary = {}, storySignals = {}) {
  const sections = [];

  const explicitActor = normalizeText(storySignals?.intent?.actor_phrase || "");
  const explicitAction = normalizeText(
    storySignals?.intent?.action_phrase || "",
  );
  const explicitBenefit = normalizeText(
    storySignals?.intent?.benefit_phrase || "",
  );

  const actors = limit(summary?.actors || [], 5);
  const primary = limit(summary?.workflows?.primary || [], 8);
  const secondary = limit(summary?.workflows?.secondary || [], 5);
  const flowRiskMap = limit(summary?.testing?.flow_risk_map || [], 6);
  const focusAreas = limit(summary?.testing?.focus_areas || [], 6);
  const openQuestions = limit(summary?.testing?.open_questions || [], 5);
  const constraints = limit(summary?.operations?.constraints || [], 5);

  sections.push("Story understanding:");

  if (explicitActor || explicitAction || explicitBenefit) {
    sections.push(
      `Explicit in story: ${[
        explicitActor ? `actor: ${explicitActor}` : "",
        explicitAction ? `intent: ${explicitAction}` : "",
        explicitBenefit ? `benefit: ${explicitBenefit}` : "",
      ]
        .filter(Boolean)
        .join(" | ")}`,
    );
  }

  if (actors.length > 0) {
    sections.push(`Detected actors: ${joinList(actors)}`);
  }

  if (primary.length > 0) {
    sections.push(`Inferred core flow: ${humanizeFlow(primary)}`);
  }

  if (secondary.length > 0) {
    sections.push(`Inferred supporting flow: ${joinList(secondary)}`);
  }

  if (constraints.length > 0) {
    sections.push(`Known constraints or controls: ${joinList(constraints)}`);
  }

  if (flowRiskMap.length > 0) {
    const reasoning = flowRiskMap.map(
      (x) =>
        `- ${normalizeText(x.flow)}: risk = ${normalizeText(
          x.risk,
        )}; test focus = ${normalizeText(x.test)}`,
    );
    sections.push(`QA reasoning:\n${reasoning.join("\n")}`);
  }

  if (focusAreas.length > 0) {
    sections.push(`Priority QA focus: ${joinList(focusAreas)}`);
  }

  if (openQuestions.length > 0) {
    sections.push(`What remains unclear: ${joinList(openQuestions)}`);
  }

  sections.push(
    "Note: parts of this understanding are inferred from the story because user stories often omit full workflow and edge-case detail.",
  );

  return sections.join("\n\n");
}
