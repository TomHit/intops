function shortJoin(arr) {
  return Array.isArray(arr) ? arr.join(" | ") : "";
}

function jsonText(value) {
  return JSON.stringify(value ?? {}, null, 0);
}

export const TEST_CASE_COLUMNS = [
  {
    key: "id",
    label: "ID",
    getValue: (r) => r.id || "",
  },
  {
    key: "title",
    label: "Title",
    getValue: (r) => r.title || "",
  },
  {
    key: "module",
    label: "Module",
    getValue: (r) => r.module || "",
  },
  {
    key: "test_type",
    label: "Type",
    getValue: (r) => r.test_type || "",
  },
  {
    key: "priority",
    label: "Priority",
    getValue: (r) => r.priority || "",
  },
  {
    key: "method",
    label: "Method",
    getValue: (r) => r.api_details?.method || "",
  },
  {
    key: "path",
    label: "Path",
    getValue: (r) => r.api_details?.path || "",
  },
  {
    key: "test_data_summary",
    label: "Test Data",
    getValue: (r) => r.test_data_summary || "",
  },
  {
    key: "steps_count",
    label: "Steps",
    getValue: (r) => (Array.isArray(r.steps) ? r.steps.length : 0),
  },
  {
    key: "expected_results_count",
    label: "Expected Results",
    getValue: (r) =>
      Array.isArray(r.expected_results) ? r.expected_results.length : 0,
  },
  {
    key: "validation_focus_count",
    label: "Validation Focus",
    getValue: (r) =>
      Array.isArray(r.validation_focus) ? r.validation_focus.length : 0,
  },
  {
    key: "needs_review",
    label: "Needs Review",
    getValue: (r) => (r.needs_review ? "Yes" : "No"),
  },
  {
    key: "review_notes",
    label: "Review Notes",
    getValue: (r) => r.review_notes || "",
  },
];

export const TEST_CASE_CSV_COLUMNS = [
  {
    key: "suite_id",
    label: "suite_id",
    getValue: (r) => r.suite_id || "",
  },
  {
    key: "id",
    label: "id",
    getValue: (r) => r.id || "",
  },
  {
    key: "title",
    label: "title",
    getValue: (r) => r.title || "",
  },
  {
    key: "module",
    label: "module",
    getValue: (r) => r.module || "",
  },
  {
    key: "test_type",
    label: "test_type",
    getValue: (r) => r.test_type || "",
  },
  {
    key: "priority",
    label: "priority",
    getValue: (r) => r.priority || "",
  },
  {
    key: "objective",
    label: "objective",
    getValue: (r) => r.objective || "",
  },
  {
    key: "preconditions",
    label: "preconditions",
    getValue: (r) => shortJoin(r.preconditions),
  },
  {
    key: "test_data",
    label: "test_data",
    getValue: (r) => jsonText(r.test_data),
  },
  {
    key: "steps",
    label: "steps",
    getValue: (r) => shortJoin(r.steps),
  },
  {
    key: "expected_results",
    label: "expected_results",
    getValue: (r) => shortJoin(r.expected_results),
  },
  {
    key: "api_method",
    label: "api_method",
    getValue: (r) => r.api_details?.method || "",
  },
  {
    key: "api_path",
    label: "api_path",
    getValue: (r) => r.api_details?.path || "",
  },
  {
    key: "validation_focus",
    label: "validation_focus",
    getValue: (r) => shortJoin(r.validation_focus),
  },
  {
    key: "references",
    label: "references",
    getValue: (r) => shortJoin(r.references),
  },
  {
    key: "needs_review",
    label: "needs_review",
    getValue: (r) => (r.needs_review ? "Yes" : "No"),
  },
  {
    key: "review_notes",
    label: "review_notes",
    getValue: (r) => r.review_notes || "",
  },
];
