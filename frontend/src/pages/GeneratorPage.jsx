import React, { useEffect, useMemo, useState } from "react";
import EndpointSelector from "../components/EndpointSelector";
import GenerationOptions from "../components/GenerationOptions";
import TestCaseTable from "../components/TestCaseTable";
import TestCaseDrawer from "../components/TestCaseDrawer";
import ExportButtons from "../components/ExportButtons";
import { TEST_CASE_CSV_COLUMNS } from "../utils/testCaseColumns";

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

function getSpecSummary(specQuality) {
  return specQuality?.summary || null;
}

function getPrimaryIssueText(endpointResult) {
  if (!endpointResult?.issues || endpointResult.issues.length === 0) return "-";
  return (
    endpointResult.issues[0]?.message || endpointResult.issues[0]?.code || "-"
  );
}

function getSuggestedFix(endpointResult) {
  if (!endpointResult?.issues || endpointResult.issues.length === 0)
    return null;

  for (const issue of endpointResult.issues) {
    if (issue?.suggested_fix) return issue.suggested_fix;
  }

  return null;
}
export default function GeneratorPage({ projectId, onBack }) {
  const [endpointsLoading, setEndpointsLoading] = useState(true);
  const [endpointsErr, setEndpointsErr] = useState("");
  const [endpoints, setEndpoints] = useState([]);

  const [selection, setSelection] = useState({
    selected_endpoint_ids: [],
    filter: { q: "", method: "ALL", authOnly: false, tag: "ALL" },
  });

  const [options, setOptions] = useState({
    include: ["contract", "schema"],
    env: "staging",
    auth_profile: "device",
    guidance: "",
    ai: false,
    spec_source: "",
    generation_mode: "balanced",
  });

  const [run, setRun] = useState({
    run_id: "",
    status: "idle",
    error: null,
    generation_mode: "balanced",
    spec_quality: null,
    blocked_endpoints: [],
    eligible_endpoints: [],
    testplan: null,
    report: null,
  });

  const [activeTab, setActiveTab] = useState("table");
  const [drawer, setDrawer] = useState({ open: false, row: null });

  const tableRows = useMemo(
    () => deriveTableRows(run.testplan),
    [run.testplan],
  );

  async function loadEndpoints(specSource = "") {
    if (!projectId) return;

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
    loadEndpoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function generate() {
    const selected = selection.selected_endpoint_ids;
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
      eligible_endpoints: [],
      testplan: null,
      report: null,
    }));

    const endpointRefs = endpoints
      .filter((e) => selected.includes(e.id))
      .map((e) => ({ method: e.method, path: e.path, id: e.id }));

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
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Generate Test Cases</div>
          <div style={styles.sub}>Project: {projectId || "—"}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={styles.btn} onClick={() => onBack?.()}>
            ← Back
          </button>
          <button
            style={styles.btn}
            onClick={loadEndpoints}
            disabled={endpointsLoading}
          >
            Reload Endpoints
          </button>
          <button
            type="button"
            style={styles.btn}
            onClick={() => loadEndpoints(options.spec_source || "")}
          >
            Load from Spec URL
          </button>
          <button
            style={styles.btnPrimary}
            onClick={generate}
            disabled={run.status === "running"}
          >
            {run.status === "running" ? "Generating…" : "Generate Test Cases"}
          </button>
        </div>
      </div>

      <div style={styles.mainGrid}>
        <div style={styles.leftPanel}>
          <div style={styles.panelTitle}>Endpoints</div>
          {endpointsLoading && (
            <div style={styles.note}>Loading endpoints…</div>
          )}
          {!!endpointsErr && (
            <div style={styles.err}>Error: {endpointsErr}</div>
          )}

          <EndpointSelector
            endpoints={endpoints}
            selection={selection}
            onChange={setSelection}
          />
        </div>

        <div style={styles.rightPanel}>
          <div style={styles.topRight}>
            <div style={styles.panelTitle}>Options</div>
            <GenerationOptions options={options} onChange={setOptions} />
            {run.spec_quality && (
              <div style={{ marginTop: 10, ...styles.note }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>
                  Spec Analysis
                </div>

                <div style={styles.kpiRow}>
                  <div style={styles.kpiBox}>
                    <div style={styles.kpiLabel}>Mode</div>
                    <div style={styles.kpiValue}>{run.generation_mode}</div>
                  </div>

                  <div style={styles.kpiBox}>
                    <div style={styles.kpiLabel}>Health</div>
                    <div style={styles.kpiValue}>
                      {run.spec_quality?.spec_health_score ?? "—"}
                    </div>
                  </div>

                  <div style={styles.kpiBox}>
                    <div style={styles.kpiLabel}>Ready</div>
                    <div style={styles.kpiValue}>
                      {getSpecSummary(run.spec_quality)?.ready ?? "—"}
                    </div>
                  </div>

                  <div style={styles.kpiBox}>
                    <div style={styles.kpiLabel}>Partial</div>
                    <div style={styles.kpiValue}>
                      {getSpecSummary(run.spec_quality)?.partial ?? "—"}
                    </div>
                  </div>

                  <div style={styles.kpiBox}>
                    <div style={styles.kpiLabel}>Blocked</div>
                    <div style={styles.kpiValue}>
                      {getSpecSummary(run.spec_quality)?.blocked ?? "—"}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <b>Total endpoints:</b>{" "}
                  {getSpecSummary(run.spec_quality)?.total_endpoints ?? "—"}
                  {" · "}
                  <b>Eligible:</b> {run.eligible_endpoints?.length ?? 0}
                  {" · "}
                  <b>Blocked for mode:</b> {run.blocked_endpoints?.length ?? 0}
                </div>
                {run.blocked_endpoints?.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 13, color: "#8a5a00" }}>
                    Some selected endpoints were excluded for the current
                    generation mode due to spec issues.
                  </div>
                )}

                {run.blocked_endpoints?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      Blocked / Excluded Endpoints
                    </div>

                    <div style={styles.issueList}>
                      {run.blocked_endpoints.map((ep, i) => (
                        <div
                          key={`${ep.endpoint_id || i}-${i}`}
                          style={styles.issueCard}
                        >
                          <div style={styles.issueTitle}>
                            {ep.method || ep.endpoint_id?.split(" ")[0] || "—"}{" "}
                            {ep.path ||
                              ep.endpoint_id?.split(" ").slice(1).join(" ") ||
                              ""}
                          </div>
                          <div style={styles.issueMeta}>
                            status: {ep.status || "blocked"} · issues:{" "}
                            {ep.issues_count ?? ep.issues?.length ?? 0}
                          </div>
                          <div style={styles.issueText}>
                            {getPrimaryIssueText(ep)}
                          </div>

                          {getSuggestedFix(ep) && (
                            <div style={styles.fixBox}>
                              <div style={styles.fixTitle}>Suggested Fix</div>

                              {getSuggestedFix(ep)?.type && (
                                <div style={styles.fixMeta}>
                                  Type: {getSuggestedFix(ep).type}
                                  {getSuggestedFix(ep)?.format
                                    ? ` · Format: ${getSuggestedFix(ep).format}`
                                    : ""}
                                </div>
                              )}

                              <pre style={styles.fixCode}>
                                {getSuggestedFix(ep)?.content || ""}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <ExportButtons
                disabled={!run.testplan}
                onExportJson={exportJson}
                onExportCsv={exportCsv}
              />
            </div>

            {run.report && (
              <div style={{ marginTop: 10, ...styles.note }}>
                <b>Report:</b> total={run.report.total_cases ?? "—"},
                needs_review={run.report.needs_review ?? "—"}
                {Array.isArray(run.report.warnings) &&
                  run.report.warnings.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <b>Warnings:</b>
                      <ul style={{ marginTop: 6 }}>
                        {run.report.warnings.slice(0, 5).map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}

            {run.status === "error" && (
              <div style={styles.err}>
                <div>Error: {run.error?.message || "Unknown error"}</div>
                {run.blocked_endpoints?.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    See Spec Analysis below for the exact endpoint issue.
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={styles.preview}>
            <div style={styles.previewHeader}>
              <div style={styles.panelTitle}>Preview</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={activeTab === "table" ? styles.tabActive : styles.tab}
                  onClick={() => setActiveTab("table")}
                >
                  Table View
                </button>
                <button
                  style={activeTab === "json" ? styles.tabActive : styles.tab}
                  onClick={() => setActiveTab("json")}
                  disabled={!run.testplan}
                >
                  JSON View
                </button>
              </div>
            </div>

            {activeTab === "table" ? (
              <TestCaseTable
                rows={tableRows}
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
      </div>

      <TestCaseDrawer
        open={drawer.open}
        row={drawer.row}
        onClose={() => setDrawer({ open: false, row: null })}
      />
    </div>
  );
}

const styles = {
  page: { padding: 18, fontFamily: "system-ui, Arial", color: "#111" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: { fontSize: 20, fontWeight: 800 },
  sub: { fontSize: 13, opacity: 0.7 },
  btn: {
    padding: "8px 10px",
    border: "1px solid #ccc",
    borderRadius: 10,
    background: "white",
    cursor: "pointer",
  },
  btnPrimary: {
    padding: "8px 10px",
    border: "1px solid #111",
    borderRadius: 10,
    background: "#111",
    color: "white",
    cursor: "pointer",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: 12,
    alignItems: "start",
  },
  leftPanel: {
    border: "1px solid #e5e5e5",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
  },
  rightPanel: {
    display: "grid",
    gridTemplateRows: "auto 1fr",
    gap: 12,
  },
  topRight: {
    border: "1px solid #e5e5e5",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
  },
  preview: {
    border: "1px solid #e5e5e5",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
    minHeight: 420,
  },
  panelTitle: { fontWeight: 800, marginBottom: 8 },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  tab: {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#fff",
    cursor: "pointer",
  },
  tabActive: {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
  },
  note: { padding: 10, borderRadius: 12, background: "#f6f6f6" },
  err: {
    padding: 10,
    borderRadius: 12,
    background: "#ffe6e6",
    border: "1px solid #ffb3b3",
    marginTop: 10,
  },
  jsonBox: {
    background: "#0b1020",
    color: "#e5e7eb",
    padding: 12,
    borderRadius: 12,
    overflow: "auto",
    maxHeight: 520,
    fontSize: 12,
  },
  kpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
    gap: 8,
    marginTop: 8,
  },
  kpiBox: {
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: 10,
    background: "#fff",
  },
  kpiLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: 800,
  },
  issueList: {
    display: "grid",
    gap: 8,
  },
  issueCard: {
    border: "1px solid #ffd6a5",
    background: "#fff8ef",
    borderRadius: 10,
    padding: 10,
  },
  issueTitle: {
    fontWeight: 700,
    marginBottom: 4,
  },
  issueMeta: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  issueText: {
    fontSize: 13,
  },
  fixBox: {
    marginTop: 10,
    border: "1px solid #d8dee9",
    background: "#f8fafc",
    borderRadius: 10,
    padding: 10,
  },
  fixTitle: {
    fontWeight: 700,
    marginBottom: 4,
  },
  fixMeta: {
    fontSize: 12,
    opacity: 0.75,
    marginBottom: 6,
  },
  fixCode: {
    margin: 0,
    background: "#0b1020",
    color: "#e5e7eb",
    padding: 10,
    borderRadius: 8,
    overflow: "auto",
    fontSize: 12,
    whiteSpace: "pre-wrap",
  },
};
