import { analyzeProject } from "./analyzeProject.js";
import { analyzeUserStory } from "./analyzeUserStory.js";
import { fetchAndNormalizeJiraStory } from "./jiraStoryFetcher.js";

function hasText(value = "") {
  return String(value || "").trim().length > 0;
}

export async function analyzeInput(input = {}) {
  let story = input?.story || input?.storyText || "";
  let acceptanceCriteria =
    input?.acceptanceCriteria || input?.acceptanceCriteriaText || "";
  let comments = input?.comments || input?.commentsText || "";

  let sourceMeta = {
    subtype: "generic",
    issue_key: "",
    issue_title: "",
  };

  if (hasText(input?.jiraUrl) || hasText(input?.jira_url)) {
    const jiraData = await fetchAndNormalizeJiraStory({
      jiraUrl: input?.jiraUrl || input?.jira_url || "",
      baseUrl: input?.jiraBaseUrl || process.env.JIRA_BASE_URL || "",
      email: input?.jiraEmail || process.env.JIRA_EMAIL || "",
      apiToken: input?.jiraApiToken || process.env.JIRA_API_TOKEN || "",
    });

    story = story || jiraData?.story || "";
    acceptanceCriteria =
      acceptanceCriteria || jiraData?.acceptanceCriteria || "";
    comments = comments || jiraData?.comments || "";

    sourceMeta = {
      subtype: "jira",
      issue_key: jiraData?.issue?.key || "",
      issue_title: jiraData?.issue?.title || "",
    };
  }

  const hasStoryContent = [story, acceptanceCriteria, comments].some((x) =>
    hasText(x),
  );

  if (hasStoryContent) {
    return analyzeUserStory({
      story,
      acceptanceCriteria,
      comments,
      sourceMeta,
    });
  }

  return analyzeProject({
    ...input,
    story,
    acceptanceCriteria,
    comments,
    sourceMeta,
  });
}
