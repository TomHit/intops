import React, { useEffect, useMemo, useState } from "react";
import EndpointSelector from "../components/EndpointSelector";
import TestCaseTable from "../components/TestCaseTable";
import TestCaseDrawer from "../components/TestCaseDrawer";
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

export default function GeneratorPage({ projectId, onBack, options }) {
  const [endpointsLoading, setEndpointsLoading] = useState(true);
  const [endpointsErr, setEndpointsErr] = useState("");
  const [endpoints, setEndpoints] = useState([]);

  const [selection, setSelection] = useState({
    selected_endpoint_ids: [],
    filter: { q: "", method: "ALL", authOnly: false, tag: "ALL" },
  });

  const [run, setRun] = useState({
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
  });

  const [activeTab, setActiveTab] = useState("table");
  const [drawer, setDrawer] = useState({ open: false, row: null });
  const [runningStepIndex, setRunningStepIndex] = useState(0);

  const tableRows = useMemo(
    () => deriveTableRows(run.testplan),
    [run.testplan],
  );

  const selectedCount = (selection.selected_endpoint_ids || []).length;
  const runningStepLabel =
    run.status === "running"
      ? RUNNING_STEPS[runningStepIndex % RUNNING_STEPS.length]
      : null;

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
    if (!projectId) {
      setEndpoints([]);
      setEndpointsLoading(false);
      return;
    }

    setEndpointsLoading(true);
    setEndpointsErr("");

    try {
      let url = `/api/projects/${encodeURIComponent(projectId)}/endpoints`;
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
    loadEndpoints(options?.spec_source || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, options?.spec_source]);

  async function generate() {
    const selected = selection.selected_endpoint_ids;

    if (!projectId) {
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
      project_id: projectId,
      env: options.env,
      auth_profile: options.auth_profile,
      include: options.include,
      guidance: options.guidance,
      endpoints: endpointRefs,
      ai: !!options.ai,
      spec_source: options.spec_source || "",
      generation_mode: options.generation_mode || "balanced",
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

      setRun({
        run_id: data.run_id || "",
        status: "done",
        error: null,
        generation_mode: data.generation_mode || "balanced",
        spec_quality: data.spec_quality || null,
        blocked_endpoints: Array.isArray(data.blocked_endpoints)
          ? data.blocked_endpoints
          : [],
        partial_endpoints: Array.isArray(data.partial_endpoints)
          ? data.partial_endpoints
          : [],
        eligible_endpoints: Array.isArray(data.eligible_endpoints)
          ? data.eligible_endpoints
          : [],
        testplan: data.testplan || null,
        report: data.report || null,
      });

      setActiveTab("table");
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
        }
      `}</style>

      {!projectId && (
        <div style={styles.notice}>
          Select a project first from the Projects page to load endpoints and
          generate AI test cases.
        </div>
      )}

      <section className="generator-main-grid" style={styles.mainGrid}>
        <aside className="generator-left-pane" style={styles.leftPane}>
          <div style={styles.leftPaneHeader}>
            <div>
              <div style={styles.leftEyebrow}>Explorer</div>
              <div style={styles.leftTitle}>Endpoint Explorer</div>
              <div style={styles.leftSubtle}>
                Browse, filter, and select endpoints for generation.
              </div>
            </div>
          </div>

          <div style={styles.projectDefaultsBar}>
            <span style={styles.defaultChip}>
              <strong>Env</strong> {options.env || "-"}
            </span>
            <span style={styles.defaultChip}>
              <strong>Auth</strong> {options.auth_profile || "-"}
            </span>
            <span style={styles.defaultChip}>
              <strong>Mode</strong> {options.generation_mode || "balanced"}
            </span>
            <span style={styles.defaultChip}>
              <strong>AI</strong> {options.ai ? "On" : "Off"}
            </span>
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

            {!endpointsLoading && !endpointsErr && projectId && (
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
                  onClick={() => loadEndpoints(options.spec_source || "")}
                  disabled={endpointsLoading || !projectId}
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
                !projectId || run.status === "running" || selectedCount === 0
              }
              style={{
                ...styles.primaryBtn,
                opacity:
                  !projectId || run.status === "running" || selectedCount === 0
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
                Generated output appears here. Open any row for full detail.
              </div>
            </div>

            <div
              className="results-top-actions"
              style={styles.resultsTopActions}
            >
              <div style={styles.modeBadge}>
                {String(
                  run.generation_mode || options.generation_mode || "balanced",
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
            <div style={styles.tabRow}>
              <button
                type="button"
                onClick={() => setActiveTab("table")}
                style={{
                  ...styles.tabBtn,
                  ...(activeTab === "table" ? styles.tabBtnActive : {}),
                }}
              >
                Table View
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("json")}
                disabled={!run.testplan}
                style={{
                  ...styles.tabBtn,
                  ...(activeTab === "json" ? styles.tabBtnActive : {}),
                  opacity: !run.testplan ? 0.6 : 1,
                }}
              >
                JSON View
              </button>
            </div>

            {run.status === "done" && (
              <div style={{ marginBottom: 18 }}>
                <ResultsSummary
                  rows={tableRows}
                  report={run.report}
                  testplan={run.testplan}
                />
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

            <div style={styles.resultsBody}>
              {activeTab === "table" ? (
                <TestCaseTable
                  rows={tableRows}
                  loading={run.status === "running"}
                  onRowClick={(row) => setDrawer({ open: true, row })}
                />
              ) : (
                <pre style={styles.jsonBox}>
                  {run.testplan
                    ? JSON.stringify(run.testplan, null, 2)
                    : "No output yet."}
                </pre>
              )}
            </div>
          </div>
        </section>
      </section>

      <TestCaseDrawer
        open={drawer.open}
        row={drawer.row}
        onClose={() => setDrawer({ open: false, row: null })}
      />
    </div>
  );
}

const styles = {
  page: {
    display: "grid",
    gap: 12,
    padding: "0 0 32px",
    width: "100%",
    minWidth: 0,
    margin: 0,
    background: "#f8fafc",
  },

  notice: {
    padding: 16,
    borderRadius: 16,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "420px minmax(0, 1fr)",
    gap: 20,
    alignItems: "start",
    width: "100%",
    minWidth: 0,
  },

  leftPane: {
    minWidth: 0,
    width: "100%",
    border: "1px solid #e6eaf2",
    borderRadius: 24,
    background: "#fff",
    boxShadow: "0 10px 32px rgba(15, 23, 42, 0.05)",
    overflow: "hidden",
    position: "sticky",
    top: 0,
    display: "grid",
    gridTemplateRows: "auto auto minmax(0, 1fr) auto",
    maxHeight: "100vh",
  },

  leftPaneHeader: {
    padding: "18px 20px 14px",
    borderBottom: "1px solid #eef2f7",
    background: "#ffffff",
  },

  leftEyebrow: {
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#6366f1",
    marginBottom: 6,
  },

  leftTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
    marginBottom: 6,
  },

  leftSubtle: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.5,
  },

  projectDefaultsBar: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    padding: "14px 20px",
    borderBottom: "1px solid #eef2f7",
    background: "#fafcff",
  },

  defaultChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 10px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#475569",
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },

  explorerBody: {
    padding: 16,
    minWidth: 0,
    overflow: "auto",
  },

  explorerFooter: {
    padding: 16,
    borderTop: "1px solid #eef2f7",
    background: "#ffffff",
    display: "grid",
    gap: 14,
  },

  explorerFooterTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  explorerFooterActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  countBadge: {
    padding: "10px 14px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#4338ca",
    fontWeight: 700,
    fontSize: 13,
    whiteSpace: "nowrap",
  },

  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    padding: "14px 18px",
    borderRadius: 16,
    border: "none",
    background: "linear-gradient(90deg, #8b5cf6 0%, #4f7cff 100%)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(79, 70, 229, 0.18)",
    whiteSpace: "nowrap",
  },

  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid #d6dce8",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    color: "#0f172a",
    whiteSpace: "nowrap",
  },

  infoBox: {
    padding: 14,
    borderRadius: 12,
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
    border: "1px solid #e6eaf2",
    borderRadius: 24,
    background: "#fff",
    boxShadow: "0 10px 32px rgba(15, 23, 42, 0.05)",
    overflow: "hidden",
  },

  resultsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    padding: "20px 20px 16px",
    borderBottom: "1px solid #eef2f7",
    flexWrap: "wrap",
  },

  resultsTopActions: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },

  panelTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 6,
    lineHeight: 1.15,
  },

  panelSubtle: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.5,
    maxWidth: 620,
  },

  modeBadge: {
    padding: "10px 18px",
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #dbe3f0",
    color: "#334155",
    fontSize: 13,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  resultsInner: {
    padding: 20,
    minWidth: 0,
  },

  tabRow: {
    display: "flex",
    gap: 10,
    marginBottom: 18,
    flexWrap: "wrap",
  },

  tabBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid #d6dce8",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },

  tabBtnActive: {
    background: "#eef2ff",
    borderColor: "#c7d2fe",
    color: "#3730a3",
  },

  resultsProgress: {
    marginBottom: 16,
    padding: "10px 0 2px",
  },

  resultsProgressTop: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    color: "#475569",
    fontSize: 14,
    marginBottom: 10,
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

  resultsBody: {
    minWidth: 0,
    width: "100%",
  },

  jsonBox: {
    margin: 0,
    padding: 16,
    borderRadius: 14,
    background: "#0f172a",
    color: "#e2e8f0",
    overflow: "auto",
    maxHeight: 620,
    fontSize: 13,
  },
};
