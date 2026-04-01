import React, { useEffect, useMemo, useState } from "react";
import EndpointSelector from "../components/EndpointSelector";
import ResultsSummary from "../components/ResultsSummary";
import { TEST_CASE_CSV_COLUMNS } from "../utils/testCaseColumns";

const RUNNING_STEPS = [
  "Reading API specification",
  "Analyzing selected endpoints",
  "Building contract test cases",
  "Building schema validation",
  "Generating negative scenarios",
  "Preparing final preview",
];

const DEFAULT_OPTIONS = {
  env: "staging",
  auth_profile: "",
  include: ["contract", "schema"],
  ai: false,
  generation_mode: "balanced",
  spec_source: "",
  guidance: "",
};

function safeJsonParse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function summarizeTestData(testData) {
  if (!testData || typeof testData !== "object") return "-";
  const pathCount = Object.keys(testData.path_params || {}).length;
  const queryCount = Object.keys(testData.query_params || {}).length;
  const headerCount = Object.keys(testData.headers || {}).length;
  const cookieCount = Object.keys(testData.cookies || {}).length;
  const hasBody =
    testData.request_body !== undefined && testData.request_body !== null;

  return `path:${pathCount} query:${queryCount} headers:${headerCount} cookies:${cookieCount} body:${hasBody ? "yes" : "no"}`;
}

function deriveTableRows(testplan) {
  const rows = [];
  if (!testplan?.suites) return rows;

  testplan.suites.forEach((s, si) => {
    (s.cases || []).forEach((tc, ci) => {
      rows.push({
        suite_id: s.suite_id || "",
        id: tc.id || "",
        title: tc.title || "",
        module: tc.module || "",
        test_type: tc.test_type || "",
        priority: tc.priority || "",
        objective: tc.objective || "",
        preconditions: Array.isArray(tc.preconditions) ? tc.preconditions : [],
        test_data: tc.test_data || {},
        test_data_summary: summarizeTestData(tc.test_data),
        steps: Array.isArray(tc.steps) ? tc.steps : [],
        expected_results: Array.isArray(tc.expected_results)
          ? tc.expected_results
          : [],
        api_details: tc.api_details || {},
        validation_focus: Array.isArray(tc.validation_focus)
          ? tc.validation_focus
          : [],
        references: Array.isArray(tc.references) ? tc.references : [],
        needs_review: !!tc.needs_review,
        review_notes: tc.review_notes || "",
        ref: { suiteIndex: si, caseIndex: ci },
      });
    });
  });

  return rows;
}

function downloadText(filename, text, mime = "application/octet-stream") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCsvValue(v) {
  const s = String(v ?? "");
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildCsvFromTable(rows) {
  const header = TEST_CASE_CSV_COLUMNS.map((c) => c.label);
  const lines = [header.join(",")];

  for (const r of rows) {
    const values = TEST_CASE_CSV_COLUMNS.map((c) => toCsvValue(c.getValue(r)));
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

function DetailList({ items, ordered = false }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <div style={styles.detailMuted}>-</div>;
  }

  const Tag = ordered ? "ol" : "ul";

  return (
    <Tag style={styles.detailList}>
      {items.map((item, idx) => (
        <li key={idx}>{item}</li>
      ))}
    </Tag>
  );
}

function prettyJson(value) {
  if (value === undefined || value === null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getEndpointDisplay(apiDetails = {}) {
  const method = String(apiDetails?.method || "").toUpperCase();
  const baseUrl = apiDetails?.base_url || "";
  const path = apiDetails?.path || "";

  const hasBaseUrl = !!String(baseUrl).trim();

  let resolved = "";
  let warning = "";

  if (!hasBaseUrl) {
    resolved = "";
    warning =
      "Full endpoint URL not available because base URL is not configured for this environment.";
  } else {
    try {
      resolved = new URL(path, baseUrl).toString();
    } catch {
      resolved = "";
      warning = "Invalid base URL or path. Unable to construct full endpoint.";
    }
  }

  return {
    method,
    resolved,
    baseUrl,
    path,
    warning,
    hasBaseUrl,
    summary: `${method} ${path}`.trim(),
  };
}
export default function GeneratorPage({
  projectId,
  selectedProjectId,
  onBack,
  onViewTestCases,
  onSaveGeneratedRun,
  generatedRun,
  options,
  generatorSettings,
  activeSection = "generate",
}) {
  const resolvedProjectId = projectId || selectedProjectId || "";
  const resolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...(options || {}),
    ...(generatorSettings || {}),
  };

  const [endpointsLoading, setEndpointsLoading] = useState(true);
  const [endpointsErr, setEndpointsErr] = useState("");
  const [endpoints, setEndpoints] = useState([]);

  const [selection, setSelection] = useState({
    selected_endpoint_ids: [],
    filter: { q: "", method: "ALL", authOnly: false, tag: "ALL" },
  });

  const [run, setRun] = useState(
    generatedRun || {
      run_id: "",
      status: "idle",
      error: null,
      generation_mode: "balanced",
      spec_quality: null,
      blocked_endpoints: [],
      partial_endpoints: [],
      eligible_endpoints: [],
      testplan: null,
      report: null,
    },
  );

  const [runningStepIndex, setRunningStepIndex] = useState(0);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const tableRows = useMemo(
    () => deriveTableRows(run.testplan),
    [run.testplan],
  );

  const selectedCase = useMemo(() => {
    if (!tableRows.length) return null;
    return tableRows.find((row) => row.id === selectedCaseId) || null;
  }, [tableRows, selectedCaseId]);

  const selectedCount = (selection.selected_endpoint_ids || []).length;
  const runningStepLabel =
    run.status === "running"
      ? RUNNING_STEPS[runningStepIndex % RUNNING_STEPS.length]
      : null;

  useEffect(() => {
    if (generatedRun?.testplan) {
      setRun(generatedRun);
    }
  }, [generatedRun]);

  useEffect(() => {
    if (!tableRows.length) {
      setSelectedCaseId("");
      setIsPreviewOpen(false);
      return;
    }

    if (selectedCaseId && !tableRows.some((row) => row.id === selectedCaseId)) {
      setSelectedCaseId("");
      setIsPreviewOpen(false);
    }
  }, [tableRows, selectedCaseId]);

  useEffect(() => {
    if (run.status !== "running") {
      setRunningStepIndex(0);
      return;
    }

    const id = window.setInterval(() => {
      setRunningStepIndex((prev) => (prev + 1) % RUNNING_STEPS.length);
    }, 1100);

    return () => window.clearInterval(id);
  }, [run.status]);

  async function loadEndpoints(specSource = "") {
    if (!resolvedProjectId) {
      setEndpoints([]);
      setEndpointsLoading(false);
      return;
    }

    setEndpointsLoading(true);
    setEndpointsErr("");

    try {
      let url = `/api/projects/${encodeURIComponent(resolvedProjectId)}/endpoints`;
      if (specSource) {
        url += `?spec_source=${encodeURIComponent(specSource)}`;
      }

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      const text = await res.text();
      const data = safeJsonParse(text);

      if (!res.ok) {
        throw new Error(
          data?.message || `Failed to load endpoints (${res.status})`,
        );
      }

      setEndpoints(Array.isArray(data) ? data : []);
    } catch (e) {
      setEndpointsErr(e.message || String(e));
      setEndpoints([]);
    } finally {
      setEndpointsLoading(false);
    }
  }

  useEffect(() => {
    loadEndpoints(resolvedOptions?.spec_source || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedProjectId, resolvedOptions?.spec_source]);

  useEffect(() => {
    async function loadPersistedCases() {
      if (activeSection !== "testCases") return;
      if (!run?.run_id) return;
      if (run?.testplan?.suites?.length) return;

      try {
        const data = await fetchRunCases(run.run_id);
        const cases = Array.isArray(data?.cases) ? data.cases : [];

        const reconstructedTestplan = {
          project: {
            project_id: resolvedProjectId || "",
            project_name: resolvedProjectId || "Project",
            env: resolvedOptions.env || "staging",
          },
          generation: {
            generated_at: new Date().toISOString(),
            model: "deterministic",
            source: "persisted_run_files",
          },
          suites: [
            {
              suite_id: "streamed_cases",
              name: "Generated Test Cases",
              endpoints: [],
              cases,
            },
          ],
        };

        const nextRun = {
          ...run,
          testplan: reconstructedTestplan,
          report: {
            total_cases: cases.length,
            needs_review: cases.filter((c) => !!c.needs_review).length,
          },
        };

        setRun(nextRun);

        if (onSaveGeneratedRun) {
          onSaveGeneratedRun(nextRun);
        }
      } catch (e) {
        console.error("LOAD PERSISTED CASES ERROR:", e);
        setRun((prev) => ({
          ...prev,
          error: {
            message: e.message || "Failed to load generated test cases.",
          },
        }));
      }
    }

    loadPersistedCases();
  }, [
    activeSection,
    run?.run_id,
    run?.testplan,
    resolvedProjectId,
    resolvedOptions.env,
    onSaveGeneratedRun,
  ]);

  async function fetchRunCases(runId) {
    const res = await fetch(`/api/runs/${encodeURIComponent(runId)}/cases`, {
      headers: { Accept: "application/json" },
    });

    const text = await res.text();
    const data = safeJsonParse(text);

    if (!res.ok) {
      throw new Error(
        data?.message || `Failed to load run cases (${res.status})`,
      );
    }

    return data || null;
  }
  async function fetchJobStatus(jobId) {
    const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
      headers: { Accept: "application/json" },
    });

    const text = await res.text();
    const data = safeJsonParse(text);

    if (!res.ok) {
      throw new Error(
        data?.message || `Failed to fetch job status (${res.status})`,
      );
    }

    return data?.job || null;
  }

  async function fetchJobResult(jobId) {
    const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/result`, {
      headers: { Accept: "application/json" },
    });

    const text = await res.text();
    const data = safeJsonParse(text);

    if (!res.ok) {
      const err = new Error(
        data?.message || `Failed to fetch job result (${res.status})`,
      );
      err.details = data?.error || null;
      throw err;
    }

    return data?.result || null;
  }

  async function waitForJobCompletion(
    jobId,
    { intervalMs = 1500, timeoutMs = 300000 } = {},
  ) {
    const startedAt = Date.now();

    while (true) {
      const job = await fetchJobStatus(jobId);

      if (!job) {
        throw new Error("Job status payload is missing.");
      }

      if (job.status === "completed") {
        return await fetchJobResult(jobId);
      }

      if (job.status === "failed") {
        const err = new Error(job?.error?.message || "Generation job failed.");
        err.details = job?.error || null;
        throw err;
      }

      if (Date.now() - startedAt > timeoutMs) {
        const err = new Error(
          "Generation timed out while waiting for job completion.",
        );
        err.details = { job_id: jobId, status: job.status };
        throw err;
      }

      await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }
  }

  async function generate() {
    const selected = selection.selected_endpoint_ids;

    if (!resolvedProjectId) {
      alert("Select a project first.");
      return;
    }

    if (!selected.length) {
      alert("Select at least 1 endpoint.");
      return;
    }

    setRun((r) => ({
      ...r,
      status: "running",
      error: null,
      spec_quality: null,
      blocked_endpoints: [],
      partial_endpoints: [],
      eligible_endpoints: [],
      testplan: null,
      report: null,
    }));

    const endpointRefs = endpoints
      .filter((e) => selected.includes(e.id))
      .map((e) => ({
        method: e.method,
        path: e.path,
        id: e.id,
      }));

    const payload = {
      project_id: resolvedProjectId,
      created_by: "b927ff5d-5d28-4caa-b046-9778608c397e",
      env: resolvedOptions.env,
      auth_profile: resolvedOptions.auth_profile,
      include: resolvedOptions.include,
      guidance: resolvedOptions.guidance,
      endpoints: endpointRefs,
      ai: !!resolvedOptions.ai,
      spec_source: resolvedOptions.spec_source || "",
      generation_mode: resolvedOptions.generation_mode || "balanced",
    };

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      const data = safeJsonParse(text);

      if (!res.ok) {
        const err = new Error(
          data?.message || `Generate failed: ${res.status}`,
        );
        err.details = data?.details || null;
        throw err;
      }

      const jobId = data?.job_id;

      if (!jobId) {
        const err = new Error("Job ID was not returned by /api/generate.");
        err.details = data || null;
        throw err;
      }

      const result = await waitForJobCompletion(jobId);

      const nextRun = {
        run_id: result?.run_id || jobId,
        status: "done",
        error: null,
        generation_mode:
          result?.generation_mode ||
          result?.details?.generation_mode ||
          "balanced",
        spec_quality:
          result?.spec_quality || result?.details?.spec_quality || null,
        blocked_endpoints: Array.isArray(result?.blocked_endpoints)
          ? result.blocked_endpoints
          : Array.isArray(result?.details?.blocked_endpoints)
            ? result.details.blocked_endpoints
            : [],
        partial_endpoints: Array.isArray(result?.partial_endpoints)
          ? result.partial_endpoints
          : Array.isArray(result?.details?.partial_endpoints)
            ? result.details.partial_endpoints
            : [],
        eligible_endpoints: Array.isArray(result?.eligible_endpoints)
          ? result.eligible_endpoints
          : Array.isArray(result?.details?.eligible_endpoints)
            ? result.details.eligible_endpoints
            : [],
        batching: result?.batching || null,
        result_storage: result?.result_storage || null,

        // keep UI alive even though full testplan is no longer returned
        testplan: result?.testplan || null,
        report:
          result?.report ||
          (result?.run_id
            ? {
                total_cases: "Saved to files",
                needs_review: "-",
              }
            : null),
      };

      setRun(nextRun);

      if (onSaveGeneratedRun) {
        onSaveGeneratedRun(nextRun);
      }
    } catch (e) {
      setRun((r) => ({
        ...r,
        status: "error",
        error: {
          message: e.message || String(e),
          details: e.details || null,
        },
        generation_mode:
          e.details?.generation_mode || r.generation_mode || "balanced",
        spec_quality: e.details?.spec_quality || null,
        blocked_endpoints: Array.isArray(e.details?.blocked_endpoints)
          ? e.details.blocked_endpoints
          : [],
        partial_endpoints: Array.isArray(e.details?.partial_endpoints)
          ? e.details.partial_endpoints
          : [],
        eligible_endpoints: Array.isArray(e.details?.eligible_endpoints)
          ? e.details.eligible_endpoints
          : [],
        testplan: null,
        report: null,
      }));
    }
  }

  function exportJson() {
    if (!run.testplan) return;
    downloadText(
      "test_cases.json",
      JSON.stringify(run.testplan, null, 2),
      "application/json",
    );
  }

  function exportCsv() {
    if (!tableRows.length) return;
    const csv = buildCsvFromTable(tableRows);
    downloadText("test_cases.csv", csv, "text/csv");
  }

  const isTestCasesSection = activeSection === "testCases";

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes buttonSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes dotPulse {
          0%, 100% { opacity: 0.35; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes previewSlideIn {
          from {
            transform: translateX(100%);
            opacity: 0.92;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .gen-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #ffffff;
          border-radius: 999px;
          display: inline-block;
          animation: buttonSpin 0.8s linear infinite;
          flex-shrink: 0;
        }

        .gen-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #60a5fa;
          animation: dotPulse 1.1s ease-in-out infinite;
        }

        .gen-dot:nth-child(2) { animation-delay: 0.12s; }
        .gen-dot:nth-child(3) { animation-delay: 0.24s; }
        .gen-dot:nth-child(4) { animation-delay: 0.36s; }
        .gen-dot:nth-child(5) { animation-delay: 0.48s; }

        @media (max-width: 1220px) {
          .generator-main-grid {
            grid-template-columns: 1fr !important;
          }

          .generator-left-pane {
            position: relative !important;
            top: 0 !important;
            max-height: none !important;
          }

          .generator-left-body {
            max-height: none !important;
          }
        }

        @media (max-width: 860px) {
          .results-header {
            flex-direction: column !important;
            align-items: stretch !important;
          }

          .results-top-actions {
            width: 100%;
            justify-content: flex-start !important;
          }

          .explorer-footer-top {
            flex-direction: column !important;
            align-items: stretch !important;
          }

          .explorer-footer-actions {
            width: 100%;
            justify-content: stretch !important;
          }

          .explorer-footer-actions > button {
            flex: 1 1 auto;
          }

          .success-actions {
            flex-direction: column !important;
          }

          .success-actions > button {
            width: 100%;
          }

          .preview-drawer {
            width: 100vw !important;
          }
        }
      `}</style>

      {!resolvedProjectId && (
        <div style={styles.notice}>
          Select a project first from the Projects page to load endpoints and
          generate AI test cases.
        </div>
      )}

      {isTestCasesSection ? (
        <section style={styles.testCasesWrap}>
          <div style={styles.resultsHeader}>
            <div>
              <div style={styles.panelTitle}>Test Cases</div>
              <div style={styles.panelSubtle}>
                Review generated cases for the selected project and export them.
              </div>
            </div>

            <div style={styles.resultsTopActions}>
              <button
                type="button"
                onClick={exportJson}
                disabled={!run.testplan}
                style={styles.secondaryBtn}
              >
                Export JSON
              </button>

              <button
                type="button"
                onClick={exportCsv}
                disabled={!tableRows.length}
                style={styles.secondaryBtn}
              >
                Export CSV
              </button>
            </div>
          </div>

          <div style={styles.resultsInner}>
            {!resolvedProjectId ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyStateTitle}>No project selected</div>
                <div style={styles.emptyStateText}>
                  Open a project from the Projects tab first.
                </div>
              </div>
            ) : !run.testplan || !tableRows.length ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyStateTitle}>
                  No generated test cases yet
                </div>
                <div style={styles.emptyStateText}>
                  Go to Generate Tests, select endpoints, and run generation.
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 18 }}>
                  <ResultsSummary
                    rows={tableRows}
                    report={run.report}
                    testplan={run.testplan}
                  />
                </div>

                <div
                  style={{
                    ...styles.tableOnlyWrap,
                    ...(isPreviewOpen ? styles.tableOnlyWrapBlurred : {}),
                  }}
                >
                  <div style={styles.tablePane}>
                    <div style={styles.tablePaneHead}>
                      <div style={styles.tablePaneTitle}>
                        Generated Test Cases
                      </div>
                      <div style={styles.tablePaneMeta}>
                        {tableRows.length} row
                        {tableRows.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    <div style={styles.tableWrap}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={{ ...styles.th, width: 240 }}>ID</th>
                            <th style={styles.th}>Title</th>
                            <th style={{ ...styles.th, width: 110 }}>Type</th>
                            <th style={{ ...styles.th, width: 130 }}>
                              Priority
                            </th>
                            <th style={{ ...styles.th, width: 240 }}>API</th>
                            <th style={{ ...styles.th, width: 100 }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.map((row) => {
                            const isActive = selectedCase?.id === row.id;

                            return (
                              <tr
                                key={
                                  row.id ||
                                  `${row.suite_id}-${row.ref?.caseIndex}`
                                }
                                style={isActive ? styles.trActive : undefined}
                              >
                                <td style={styles.tdMono}>{row.id || "-"}</td>
                                <td
                                  style={styles.tdTitle}
                                  title={row.title || "-"}
                                >
                                  {row.title || "-"}
                                </td>
                                <td style={styles.td}>
                                  {row.test_type || "-"}
                                </td>
                                <td style={styles.td}>{row.priority || "-"}</td>
                                <td
                                  style={styles.tdApi}
                                  title={
                                    getEndpointDisplay(row.api_details).summary
                                  }
                                >
                                  {getEndpointDisplay(row.api_details).summary}
                                </td>
                                <td style={{ ...styles.td, width: 100 }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCaseId(row.id);
                                      setIsPreviewOpen(true);
                                    }}
                                    style={
                                      isActive && isPreviewOpen
                                        ? styles.viewBtnActive
                                        : styles.viewBtn
                                    }
                                  >
                                    View
                                  </button>
                                </td>{" "}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {isPreviewOpen && selectedCase ? (
                  <>
                    <div
                      style={styles.previewOverlay}
                      onClick={() => setIsPreviewOpen(false)}
                    />

                    <aside
                      className="preview-drawer"
                      style={styles.previewDrawer}
                    >
                      <div style={styles.previewHead}>
                        <div>
                          <div style={styles.previewTitle}>
                            Test Case Preview
                          </div>
                          <div style={styles.previewSubtle}>
                            Detailed view for selected test case
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsPreviewOpen(false)}
                          style={styles.previewCloseBtn}
                        >
                          ✕
                        </button>
                      </div>

                      <div style={styles.previewBody}>
                        <div style={styles.previewSection}>
                          <div style={styles.previewCaseTitle}>
                            {selectedCase.title || "Untitled Test Case"}
                          </div>
                          <div style={styles.previewMeta}>
                            {selectedCase.id || "-"} •{" "}
                            {selectedCase.test_type || "-"} •{" "}
                            {selectedCase.priority || "-"}
                          </div>
                        </div>

                        <div style={styles.previewGrid}>
                          <div style={styles.previewMiniCard}>
                            <div style={styles.previewMiniLabel}>Module</div>
                            <div style={styles.previewMiniValue}>
                              {selectedCase.module || "-"}
                            </div>
                          </div>

                          <div style={styles.previewMiniCard}>
                            <div style={styles.previewMiniLabel}>API</div>
                            <div style={styles.previewMiniValueMono}>
                              {
                                getEndpointDisplay(selectedCase.api_details)
                                  .summary
                              }
                            </div>
                          </div>
                        </div>

                        <div style={styles.previewSection}>
                          <div style={styles.previewLabel}>Full Endpoint</div>
                          {(() => {
                            const ep = getEndpointDisplay(
                              selectedCase.api_details,
                            );

                            return (
                              <>
                                <pre style={styles.previewCodeBlockLight}>
                                  {ep.resolved || "Not available"}
                                </pre>

                                {!ep.hasBaseUrl && (
                                  <div style={styles.endpointWarning}>
                                    ⚠ {ep.warning}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        <div style={styles.previewGrid}>
                          <div style={styles.previewMiniCard}>
                            <div style={styles.previewMiniLabel}>Base URL</div>
                            <div style={styles.previewMiniValueMono}>
                              {getEndpointDisplay(selectedCase.api_details)
                                .baseUrl || "-"}
                            </div>
                          </div>

                          <div style={styles.previewMiniCard}>
                            <div style={styles.previewMiniLabel}>Path</div>
                            <div style={styles.previewMiniValueMono}>
                              {getEndpointDisplay(selectedCase.api_details)
                                .path || "-"}
                            </div>
                          </div>
                        </div>

                        <div style={styles.previewSection}>
                          <div style={styles.previewLabel}>Preconditions</div>
                          <DetailList items={selectedCase.preconditions} />
                        </div>

                        <div style={styles.previewSection}>
                          <div style={styles.previewLabel}>Steps</div>
                          <DetailList items={selectedCase.steps} ordered />
                        </div>

                        <div style={styles.previewSection}>
                          <div style={styles.previewLabel}>
                            Expected Results
                          </div>
                          <DetailList items={selectedCase.expected_results} />
                        </div>

                        <div style={styles.previewSection}>
                          <div style={styles.previewLabel}>
                            Validation Focus
                          </div>
                          <DetailList items={selectedCase.validation_focus} />
                        </div>

                        <div style={styles.previewSection}>
                          <div style={styles.previewLabel}>References</div>
                          <DetailList items={selectedCase.references} />
                        </div>

                        <div style={styles.previewSection}>
                          <div style={styles.previewLabel}>
                            Test Data Summary
                          </div>
                          <div style={styles.previewText}>
                            {selectedCase.test_data_summary || "-"}
                          </div>
                        </div>

                        <div style={styles.previewSection}>
                          <div style={styles.previewLabel}>Path Params</div>
                          {selectedCase.test_data?.path_params &&
                          Object.keys(selectedCase.test_data.path_params)
                            .length > 0 ? (
                            <pre style={styles.previewCodeBlock}>
                              {prettyJson(selectedCase.test_data.path_params)}
                            </pre>
                          ) : (
                            <div style={styles.detailMuted}>-</div>
                          )}
                        </div>

                        <div style={styles.previewSection}>
                          <div style={styles.previewLabel}>Query Params</div>
                          {selectedCase.test_data?.query_params &&
                          Object.keys(selectedCase.test_data.query_params)
                            .length > 0 ? (
                            <pre style={styles.previewCodeBlock}>
                              {prettyJson(selectedCase.test_data.query_params)}
                            </pre>
                          ) : (
                            <div style={styles.detailMuted}>-</div>
                          )}
                        </div>

                        <div style={styles.previewSection}>
                          <div style={styles.previewLabel}>Headers</div>
                          {selectedCase.test_data?.headers &&
                          Object.keys(selectedCase.test_data.headers).length >
                            0 ? (
                            <pre style={styles.previewCodeBlock}>
                              {prettyJson(selectedCase.test_data.headers)}
                            </pre>
                          ) : (
                            <div style={styles.detailMuted}>-</div>
                          )}
                        </div>

                        <div style={styles.previewSection}>
                          <div style={styles.previewLabel}>Cookies</div>
                          {selectedCase.test_data?.cookies &&
                          Object.keys(selectedCase.test_data.cookies).length >
                            0 ? (
                            <pre style={styles.previewCodeBlock}>
                              {prettyJson(selectedCase.test_data.cookies)}
                            </pre>
                          ) : (
                            <div style={styles.detailMuted}>-</div>
                          )}
                        </div>

                        <div style={styles.previewSection}>
                          <div style={styles.previewLabel}>Request Body</div>
                          {selectedCase.test_data?.request_body !== undefined &&
                          selectedCase.test_data?.request_body !== null ? (
                            <pre style={styles.previewCodeBlock}>
                              {prettyJson(selectedCase.test_data.request_body)}
                            </pre>
                          ) : (
                            <div style={styles.detailMuted}>-</div>
                          )}
                        </div>

                        <div style={styles.previewSection}>
                          <div style={styles.previewLabel}>Review Notes</div>
                          <div style={styles.previewText}>
                            {selectedCase.review_notes || "-"}
                          </div>
                        </div>
                      </div>
                    </aside>
                  </>
                ) : null}
              </>
            )}
          </div>
        </section>
      ) : (
        <section className="generator-main-grid" style={styles.mainGrid}>
          <aside className="generator-left-pane" style={styles.leftPane}>
            <div style={styles.leftPaneHeader}>
              <div style={styles.leftTitle}>APIs</div>
              <div style={styles.leftSubtle}>Endpoint Explorer</div>
            </div>

            <div className="generator-left-body" style={styles.explorerBody}>
              {endpointsLoading && (
                <div style={styles.infoBox}>Loading endpoints...</div>
              )}

              {!!endpointsErr && (
                <div style={{ ...styles.infoBox, ...styles.errorInfo }}>
                  Error: {endpointsErr}
                </div>
              )}

              {!endpointsLoading && !endpointsErr && resolvedProjectId && (
                <EndpointSelector
                  endpoints={endpoints}
                  selection={selection}
                  onChange={setSelection}
                />
              )}
            </div>

            <div style={styles.explorerFooter}>
              <div
                className="explorer-footer-top"
                style={styles.explorerFooterTop}
              >
                <div style={styles.countBadge}>
                  {selectedCount} endpoint{selectedCount === 1 ? "" : "s"}{" "}
                  selected
                </div>

                <div
                  className="explorer-footer-actions"
                  style={styles.explorerFooterActions}
                >
                  <button
                    type="button"
                    onClick={() => onBack?.()}
                    style={styles.secondaryBtn}
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      loadEndpoints(resolvedOptions.spec_source || "")
                    }
                    disabled={endpointsLoading || !resolvedProjectId}
                    style={styles.secondaryBtn}
                  >
                    Reload
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={generate}
                disabled={
                  !resolvedProjectId ||
                  run.status === "running" ||
                  selectedCount === 0
                }
                style={{
                  ...styles.primaryBtn,
                  opacity:
                    !resolvedProjectId ||
                    run.status === "running" ||
                    selectedCount === 0
                      ? 0.7
                      : 1,
                }}
              >
                {run.status === "running" ? (
                  <>
                    <span className="gen-spinner" />
                    <span>Generating...</span>
                  </>
                ) : (
                  "Generate Tests"
                )}
              </button>
            </div>
          </aside>

          <section style={styles.rightPane}>
            <div className="results-header" style={styles.resultsHeader}>
              <div>
                <div style={styles.panelTitle}>Results</div>
                <div style={styles.panelSubtle}>
                  Generate tests here, then open the dedicated Test Cases tab
                  for full review.
                </div>
              </div>

              <div
                className="results-top-actions"
                style={styles.resultsTopActions}
              >
                <div style={styles.modeBadge}>
                  {String(
                    run.generation_mode ||
                      resolvedOptions.generation_mode ||
                      "balanced",
                  ).toUpperCase()}
                </div>

                <button
                  type="button"
                  onClick={exportJson}
                  disabled={!run.testplan}
                  style={styles.secondaryBtn}
                >
                  Export JSON
                </button>

                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={!tableRows.length}
                  style={styles.secondaryBtn}
                >
                  CSV
                </button>
              </div>
            </div>

            <div style={styles.resultsInner}>
              {run.status === "done" && !run.testplan && (
                <div style={styles.infoBox}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    Generation completed
                  </div>
                  <div style={{ marginBottom: 8 }}>Run ID: {run.run_id}</div>
                  <div style={{ marginBottom: 12 }}>
                    Cases were saved to batch files. Open the Test Cases tab to
                    continue.
                  </div>

                  <button
                    type="button"
                    onClick={() => onViewTestCases?.()}
                    style={styles.primaryBtn}
                  >
                    Open Test Cases
                  </button>
                </div>
              )}
              {run.status === "running" && (
                <div style={styles.resultsProgress}>
                  <div style={styles.resultsProgressTop}>
                    <span>
                      {runningStepLabel || "Building test cases now..."}
                    </span>
                    <div style={styles.dotGroup}>
                      <span className="gen-dot" />
                      <span className="gen-dot" />
                      <span className="gen-dot" />
                      <span className="gen-dot" />
                      <span className="gen-dot" />
                    </div>
                  </div>
                  <div style={styles.resultsProgressBarTrack}>
                    <div style={styles.resultsProgressBarFill} />
                  </div>
                </div>
              )}

              {run.status === "error" && (
                <div
                  style={{
                    ...styles.infoBox,
                    ...styles.errorInfo,
                    marginBottom: 16,
                  }}
                >
                  {run.error?.message ||
                    "Something went wrong during generation."}
                </div>
              )}

              {run.status === "error" &&
                (run.spec_quality ||
                  run.blocked_endpoints.length ||
                  run.partial_endpoints.length) && (
                  <div style={styles.diagnosticsBox}>
                    <div style={styles.diagnosticsTitle}>
                      Spec improvement suggestions
                    </div>

                    {run.spec_quality?.summary && (
                      <div
                        className="strict-summary-grid"
                        style={styles.summaryMiniGrid}
                      >
                        <div style={styles.summaryMiniCard}>
                          <div style={styles.summaryMiniLabel}>Spec health</div>
                          <div style={styles.summaryMiniValue}>
                            {run.spec_quality.spec_health_score ?? "-"}
                          </div>
                        </div>

                        <div style={styles.summaryMiniCard}>
                          <div style={styles.summaryMiniLabel}>Warnings</div>
                          <div style={styles.summaryMiniValue}>
                            {run.spec_quality.summary.warnings ?? 0}
                          </div>
                        </div>

                        <div style={styles.summaryMiniCard}>
                          <div style={styles.summaryMiniLabel}>Partial</div>
                          <div style={styles.summaryMiniValue}>
                            {run.spec_quality.summary.partial ?? 0}
                          </div>
                        </div>

                        <div style={styles.summaryMiniCard}>
                          <div style={styles.summaryMiniLabel}>Blocked</div>
                          <div style={styles.summaryMiniValue}>
                            {run.spec_quality.summary.blocked ?? 0}
                          </div>
                        </div>
                      </div>
                    )}

                    {run.blocked_endpoints.length > 0 && (
                      <div style={styles.diagnosticsSection}>
                        <div style={styles.diagnosticsLabel}>
                          Affected Endpoints
                        </div>

                        <div style={styles.issueList}>
                          {run.blocked_endpoints.map((item, idx) => (
                            <div key={idx} style={styles.issueCard}>
                              <div style={styles.issueTitle}>
                                {(item.method || "").toUpperCase()}{" "}
                                {item.path || ""}
                              </div>

                              <div style={styles.issueMeta}>
                                Status: {item.status || "-"} • Issues:{" "}
                                {item.issues_count ?? 0}
                              </div>

                              {Array.isArray(item.issues) &&
                                item.issues.map((issue, issueIdx) => (
                                  <div
                                    key={issueIdx}
                                    style={styles.issueSubBlock}
                                  >
                                    <div style={styles.issueText}>
                                      {issue.message}
                                    </div>

                                    {issue.suggested_fix?.content && (
                                      <div style={styles.fixBox}>
                                        <div style={styles.fixTitle}>
                                          Suggested patch (
                                          {issue.suggested_fix.format || "text"}
                                          )
                                        </div>
                                        <pre style={styles.fixCode}>
                                          {issue.suggested_fix.content}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {run.status === "done" && run.testplan && (
                <>
                  <div style={{ marginBottom: 18 }}>
                    <ResultsSummary
                      rows={tableRows}
                      report={run.report}
                      testplan={run.testplan}
                    />
                  </div>

                  <div style={styles.successBox}>
                    <div style={styles.successTitle}>
                      Test generation completed
                    </div>
                    <div style={styles.successText}>
                      {tableRows.length} test case
                      {tableRows.length === 1 ? "" : "s"} generated
                      successfully. Open the dedicated Test Cases tab for
                      readable review and case details.
                    </div>

                    <div
                      className="success-actions"
                      style={styles.successActions}
                    >
                      <button
                        type="button"
                        onClick={onViewTestCases}
                        style={styles.primaryBtnCompact}
                      >
                        View Test Cases
                      </button>
                    </div>
                  </div>
                </>
              )}

              {run.status === "idle" && (
                <div style={styles.emptyState}>
                  <div style={styles.emptyStateTitle}>No generation yet</div>
                  <div style={styles.emptyStateText}>
                    Select one or more endpoints from the explorer and click
                    Generate Tests.
                  </div>
                </div>
              )}
            </div>
          </section>
        </section>
      )}
    </div>
  );
}

const styles = {
  page: {
    display: "grid",
    gap: 2,
    padding: "0",
    width: "100%",
    minWidth: 0,
    margin: 0,
    background: "#f8fafc",
  },
  endpointWarning: {
    marginTop: 8,
    fontSize: 12,
    color: "#b42318",
    background: "#fff5f5",
    border: "1px solid #fecaca",
    padding: "8px 10px",
    borderRadius: 8,
    lineHeight: 1.4,
  },

  notice: {
    padding: 12,
    borderRadius: 12,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "420px minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    width: "100%",
    minWidth: 0,
  },

  testCasesWrap: {
    minWidth: 0,
    width: "100%",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    background: "#fff",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
    overflow: "hidden",
  },

  tableOnlyWrap: {
    position: "relative",
    transition: "all 0.2s ease",
  },

  tableOnlyWrapBlurred: {
    filter: "blur(3px)",
    opacity: 0.55,
    pointerEvents: "none",
    userSelect: "none",
  },

  tablePane: {
    minWidth: 0,
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    overflow: "hidden",
    background: "#fff",
  },

  tablePaneHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    borderBottom: "1px solid #eef2f7",
    background: "#fcfdff",
    flexWrap: "wrap",
  },

  tablePaneTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#111827",
  },

  tablePaneMeta: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
  },

  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },

  th: {
    textAlign: "left",
    fontSize: 12,
    fontWeight: 800,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    padding: "12px 14px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f8fafc",
    whiteSpace: "nowrap",
  },

  td: {
    fontSize: 14,
    color: "#334155",
    padding: "12px 14px",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "top",
  },

  tdMono: {
    fontSize: 12,
    color: "#334155",
    padding: "12px 14px",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "top",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    lineHeight: 1.5,
  },

  tdTitle: {
    fontSize: 14,
    color: "#0f172a",
    padding: "12px 14px",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "top",
    fontWeight: 700,
    maxWidth: 420,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.5,
  },

  previewMiniValueMono: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: 700,
    lineHeight: 1.6,
    wordBreak: "break-all",
    overflowWrap: "anywhere",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },

  previewCodeBlockLight: {
    margin: 0,
    padding: 12,
    borderRadius: 12,
    background: "#f8fafc",
    color: "#0f172a",
    fontSize: 12,
    lineHeight: 1.6,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    border: "1px solid #e5e7eb",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },

  tdApi: {
    fontSize: 13,
    color: "#334155",
    padding: "12px 14px",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "top",
    lineHeight: 1.5,
    wordBreak: "break-word",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },

  trActive: {
    background: "#f8fbff",
  },

  viewBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #dbe3f0",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  viewBtnActive: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #c7d2fe",
    background: "#eef2ff",
    color: "#3730a3",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  previewOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.20)",
    zIndex: 40,
    animation: "overlayFadeIn 0.18s ease-out",
  },

  previewDrawer: {
    position: "fixed",
    top: 0,
    right: 0,
    width: "min(560px, 92vw)",
    height: "100vh",
    background: "#ffffff",
    borderLeft: "1px solid #e5e7eb",
    boxShadow: "-20px 0 50px rgba(15, 23, 42, 0.16)",
    zIndex: 50,
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    animation: "previewSlideIn 0.24s ease-out",
    willChange: "transform, opacity",
  },

  previewHead: {
    padding: "14px 16px",
    borderBottom: "1px solid #eef2f7",
    background: "#fcfdff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  previewTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 4,
  },

  previewSubtle: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.4,
  },

  previewCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid #dbe3f0",
    background: "#fff",
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },

  previewBody: {
    display: "grid",
    gap: 16,
    padding: 16,
    overflow: "auto",
  },

  previewSection: {
    display: "grid",
    gap: 8,
  },

  previewCaseTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.35,
  },

  previewMeta: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.5,
  },

  previewLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  previewText: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
  },
  previewCodeBlock: {
    margin: 0,
    padding: 12,
    borderRadius: 12,
    background: "#0f172a",
    color: "#e5e7eb",
    fontSize: 12,
    lineHeight: 1.6,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    border: "1px solid #1e293b",
  },

  detailList: {
    margin: 0,
    paddingLeft: 18,
    color: "#334155",
    lineHeight: 1.7,
    fontSize: 14,
  },

  detailMuted: {
    fontSize: 14,
    color: "#94a3b8",
  },

  previewGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

  previewMiniCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 12,
    background: "#fcfdff",
  },

  previewMiniLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 6,
  },

  previewMiniValue: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: 700,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },

  leftPane: {
    minWidth: 0,
    width: "100%",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    background: "#fff",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
    overflow: "hidden",
    position: "sticky",
    top: 0,
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    maxHeight: "100vh",
  },

  leftPaneHeader: {
    padding: "8px 12px 6px",
    borderBottom: "1px solid #eef2f7",
    background: "#ffffff",
  },

  leftTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#111827",
    letterSpacing: "-0.01em",
    lineHeight: 1.1,
    marginBottom: 2,
  },

  leftSubtle: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 1.4,
  },

  explorerBody: {
    padding: 4,
    minWidth: 0,
    overflow: "auto",
  },

  explorerFooter: {
    padding: 8,
    borderTop: "1px solid #eef2f7",
    background: "#ffffff",
    display: "grid",
    gap: 8,
  },

  explorerFooterTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  explorerFooterActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  countBadge: {
    padding: "5px 10px",
    borderRadius: 999,
    background: "#f3f4f6",
    color: "#374151",
    fontWeight: 700,
    fontSize: 11,
    whiteSpace: "nowrap",
  },

  summaryMiniGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },

  summaryMiniCard: {
    border: "1px solid #fdba74",
    background: "#fff7ed",
    borderRadius: 12,
    padding: 12,
  },

  summaryMiniLabel: {
    fontSize: 12,
    color: "#9a3412",
    marginBottom: 6,
    fontWeight: 700,
  },

  summaryMiniValue: {
    fontSize: 22,
    fontWeight: 800,
    color: "#7c2d12",
    lineHeight: 1,
  },

  diagnosticsBox: {
    marginTop: 12,
    border: "1px solid #fed7aa",
    background: "#fffaf5",
    borderRadius: 16,
    padding: 16,
    display: "grid",
    gap: 16,
  },

  diagnosticsTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#9a3412",
  },

  diagnosticsSection: {
    display: "grid",
    gap: 10,
  },

  diagnosticsLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "#7c2d12",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  issueList: {
    display: "grid",
    gap: 10,
  },

  issueCard: {
    border: "1px solid #fdba74",
    background: "#fff7ed",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 8,
  },

  issueTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#111827",
  },

  issueMeta: {
    fontSize: 12,
    color: "#7c2d12",
  },

  issueText: {
    fontSize: 13,
    color: "#44403c",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },

  issueSubBlock: {
    display: "grid",
    gap: 8,
    paddingTop: 6,
  },

  fixBox: {
    border: "1px solid #fcd34d",
    background: "#fffbeb",
    borderRadius: 12,
    padding: 10,
  },

  fixTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: "#92400e",
    marginBottom: 6,
  },

  fixCode: {
    margin: 0,
    padding: 12,
    borderRadius: 10,
    background: "#111827",
    color: "#e5e7eb",
    fontSize: 12,
    overflow: "auto",
    whiteSpace: "pre-wrap",
  },

  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    background: "#8b5cf6",
    color: "#fff",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "none",
    whiteSpace: "nowrap",
  },

  primaryBtnCompact: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    background: "#8b5cf6",
    color: "#fff",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "none",
    whiteSpace: "nowrap",
  },

  secondaryBtn: {
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    color: "#111827",
    whiteSpace: "nowrap",
  },

  infoBox: {
    padding: 12,
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #e6eaf2",
    color: "#475569",
  },

  errorInfo: {
    background: "#fef2f2",
    borderColor: "#fecaca",
    color: "#991b1b",
  },

  rightPane: {
    minWidth: 0,
    width: "100%",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    background: "#fff",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
    overflow: "hidden",
  },

  resultsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: "14px 16px 12px",
    borderBottom: "1px solid #eef2f7",
    flexWrap: "wrap",
  },

  resultsTopActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },

  panelTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 4,
    lineHeight: 1.15,
  },

  panelSubtle: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 1.4,
    maxWidth: 620,
  },

  modeBadge: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #dbe3f0",
    color: "#334155",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  resultsInner: {
    padding: 16,
    minWidth: 0,
  },

  resultsProgress: {
    marginBottom: 14,
    padding: "6px 0 2px",
  },

  resultsProgressTop: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    color: "#475569",
    fontSize: 13,
    marginBottom: 8,
  },

  dotGroup: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },

  resultsProgressBarTrack: {
    height: 6,
    borderRadius: 999,
    background: "#e8edf7",
    overflow: "hidden",
  },

  resultsProgressBarFill: {
    width: "65%",
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #8b5cf6 0%, #60a5fa 100%)",
  },

  successBox: {
    marginTop: 8,
    padding: 18,
    borderRadius: 16,
    border: "1px solid #dbeafe",
    background: "#f8fbff",
    display: "grid",
    gap: 12,
  },

  successTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
  },

  successText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 1.5,
  },

  successActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },

  emptyState: {
    border: "1px dashed #dbe3ef",
    borderRadius: 16,
    padding: "28px 20px",
    textAlign: "center",
    background: "#fcfdff",
  },

  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 8,
  },

  emptyStateText: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 1.5,
  },
};
