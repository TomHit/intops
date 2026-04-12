function parseIssueKeyFromUrl(jiraUrl = "") {
  const text = String(jiraUrl || "").trim();

  const keyMatch =
    text.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i) ||
    text.match(/selectedIssue=([A-Z][A-Z0-9]+-\d+)/i) ||
    text.match(/\b([A-Z][A-Z0-9]+-\d+)\b/i);

  return keyMatch?.[1]?.toUpperCase() || "";
}

function cleanRichText(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.map(cleanRichText).filter(Boolean).join("\n");
  }

  if (typeof value === "object") {
    const parts = [];

    if (typeof value.text === "string") {
      parts.push(value.text);
    }

    if (Array.isArray(value.content)) {
      parts.push(cleanRichText(value.content));
    }

    return parts.filter(Boolean).join("\n").trim();
  }

  return String(value).trim();
}

function pickCustomField(fields = {}, candidates = []) {
  for (const key of candidates) {
    if (fields[key]) return fields[key];
  }
  return "";
}

function getAcceptanceCriteriaFieldCandidates() {
  return [
    process.env.JIRA_AC_FIELD_1,
    process.env.JIRA_AC_FIELD_2,
    process.env.JIRA_AC_FIELD_3,
    "customfield_10042",
    "customfield_10043",
    "customfield_10044",
  ].filter(Boolean);
}

function normalizeJiraIssue(issue = {}) {
  const fields = issue?.fields || {};

  const summary = fields?.summary || "";
  const description = cleanRichText(fields.description);

  const comments = Array.isArray(fields?.comment?.comments)
    ? fields.comment.comments
        .map((c) => cleanRichText(c.body))
        .filter(Boolean)
        .join("\n\n")
    : "";

  const acceptanceCriteria = cleanRichText(
    pickCustomField(fields, getAcceptanceCriteriaFieldCandidates()),
  );

  return {
    issue: {
      key: issue?.key || "",
      title: summary,
      status: fields?.status?.name || "",
      issue_type: fields?.issuetype?.name || "",
      labels: Array.isArray(fields?.labels) ? fields.labels : [],
    },
    story: [summary, description].filter(Boolean).join("\n\n"),
    acceptanceCriteria,
    comments,
  };
}

export async function fetchAndNormalizeJiraStory({
  jiraUrl = "",
  baseUrl = "",
  email = "",
  apiToken = "",
}) {
  const issueKey = parseIssueKeyFromUrl(jiraUrl);

  if (!issueKey) {
    throw new Error("Could not extract Jira issue key from the provided link.");
  }

  if (!baseUrl || !email || !apiToken) {
    throw new Error("Jira credentials are missing.");
  }

  const apiUrl = `${baseUrl.replace(
    /\/$/,
    "",
  )}/rest/api/3/issue/${issueKey}?fields=summary,description,comment,status,issuetype,labels,customfield_10042,customfield_10043,customfield_10044`;

  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");

  const res = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
    },
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(
      data?.errorMessages?.join(", ") ||
        data?.message ||
        "Failed to fetch Jira issue.",
    );
  }

  return normalizeJiraIssue(data);
}
