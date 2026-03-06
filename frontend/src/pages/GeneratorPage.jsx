import React, { useEffect, useMemo, useState } from "react";
import EndpointSelector from "../components/EndpointSelector";
import GenerationOptions from "../components/GenerationOptions";
import TestCaseTable from "../components/TestCaseTable";
import TestCaseDrawer from "../components/TestCaseDrawer";
import ExportButtons from "../components/ExportButtons";

function safeJsonParse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function deriveTableRows(testplan) {
  const rows = [];
  if (!testplan?.suites) return rows;

  testplan.suites.forEach((s, si) => {
    (s.cases || []).forEach((tc, ci) => {
      const status = tc?.needs_review ? "needs_review" : "valid";
      rows.push({
        suite_id: s.suite_id,
        case_id: tc.id,
        title: tc.title,
        type: tc.type,
        priority: tc.priority,
        method: tc.method,
        path: tc.path,
        status,
        steps: tc.steps || [],
        expected: tc.expected || [],
        assertions: tc.assertions || [],
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
  const header = [
    "suite_id",
    "case_id",
    "title",
    "type",
    "priority",
    "method",
    "path",
    "status",
    "steps",
    "expected",
  ];
  const lines = [header.join(",")];

  for (const r of rows) {
    lines.push(
      [
        toCsvValue(r.suite_id),
        toCsvValue(r.case_id),
        toCsvValue(r.title),
        toCsvValue(r.type),
        toCsvValue(r.priority),
        toCsvValue(r.method),
        toCsvValue(r.path),
        toCsvValue(r.status),
        toCsvValue((r.steps || []).join(" | ")),
        toCsvValue((r.expected || []).join(" | ")),
      ].join(","),
    );
  }
  return lines.join("\n");
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
    include: ["smoke", "contract", "negative"],
    env: "staging",
    auth_profile: "device",
    guidance: "",
    ai: false,
    spec_source: "",
  });

  const [run, setRun] = useState({
    run_id: "",
    status: "idle",
    error: null,
    testplan: null,
    report: null,
  });

  const [activeTab, setActiveTab] = useState("table"); // "table"|"json"
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

    setRun((r) => ({ ...r, status: "running", error: null }));

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
      if (!res.ok)
        throw new Error(data?.message || `Generate failed: ${res.status}`);

      setRun({
        run_id: data.run_id || "",
        status: "done",
        error: null,
        testplan: data.testplan || null,
        report: data.report || null,
      });
      setActiveTab("table");
    } catch (e) {
      setRun((r) => ({
        ...r,
        status: "error",
        error: { message: e.message || String(e) },
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
                Error: {run.error?.message || "Unknown error"}
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
};
