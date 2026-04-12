import { extractStorySignals } from "./storySignalExtractor.js";
import { inferStoryUnderstanding } from "./storyInferenceEngine.js";
import { buildStoryFlowRiskMap } from "./storyFlowRiskEngine.js";
import {
  renderStoryExecutiveSummary,
  renderStoryQaSummary,
} from "./storySummaryRenderers.js";

export async function analyzeUserStory(input = {}) {
  const {
    story = "",
    acceptanceCriteria = "",
    comments = "",
    sourceMeta = {},
  } = input;

  const hasContent = [story, acceptanceCriteria, comments].some(
    (x) => String(x || "").trim().length > 0,
  );

  if (!hasContent) {
    return {
      status: "completed",
      source_type: "user_story",
      source_meta: {
        subtype: sourceMeta?.subtype || "generic",
        issue_key: sourceMeta?.issue_key || "",
        issue_title: sourceMeta?.issue_title || "",
      },
      story_signals: {
        source_type: "user_story",
        has_content: false,
        raw_text: "",
        actors: [],
        intent: {
          actor_phrase: "",
          action_phrase: "",
          benefit_phrase: "",
        },
        domain_hints: [],
        action_hints: [],
        constraints: [],
      },
      canonical_summary: null,
      executive_summary: "",
      qa_summary: "",
      inference_notes: [],
    };
  }

  const signals = extractStorySignals({
    story,
    acceptanceCriteria,
    comments,
  });

  const understanding = inferStoryUnderstanding(signals);

  const flow_risk_map = buildStoryFlowRiskMap(understanding);

  const canonical_summary = {
    ...understanding,
    testing: {
      ...(understanding.testing || {}),
      flow_risk_map,
    },
  };

  const inference_notes = [];

  if ((signals?.domain_hints || []).length > 0) {
    inference_notes.push(
      `Domain inferred from story terms: ${signals.domain_hints.join(", ")}.`,
    );
  }

  if ((canonical_summary?.workflows?.primary || []).length > 0) {
    inference_notes.push(
      "Primary workflow was inferred from story intent and domain context.",
    );
  }

  if ((canonical_summary?.testing?.focus_areas || []).length > 0) {
    inference_notes.push(
      "Testing focus areas were inferred from likely operational behavior in the story.",
    );
  }

  const executive_summary = renderStoryExecutiveSummary(
    canonical_summary,
    signals,
  );
  const qa_summary = renderStoryQaSummary(canonical_summary, signals);

  return {
    status: "completed",
    source_type: "user_story",
    source_meta: {
      subtype: sourceMeta?.subtype || "generic",
      issue_key: sourceMeta?.issue_key || "",
      issue_title: sourceMeta?.issue_title || "",
    },
    story_signals: {
      ...signals,
      source_meta: {
        subtype: sourceMeta?.subtype || "generic",
        issue_key: sourceMeta?.issue_key || "",
      },
    },
    explicit_story_elements: {
      actors: signals?.actors || [],
      intent: signals?.intent || {},
      domain_hints: signals?.domain_hints || [],
      action_hints: signals?.action_hints || [],
      constraints: signals?.constraints || [],
    },
    inferred_elements: {
      system_identity: canonical_summary?.system_identity || {},
      capabilities: canonical_summary?.capabilities || [],
      workflows: canonical_summary?.workflows || {},
      risks: canonical_summary?.testing?.focus_areas || [],
    },
    canonical_summary,
    executive_summary,
    qa_summary,
    inference_notes,
  };
}
