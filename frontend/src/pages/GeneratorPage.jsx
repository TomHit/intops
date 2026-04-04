import React, { useEffect, useMemo, useState } from "react";
import { List } from "react-window";
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
  include: ["contract", "schema", "negative", "auth"],
  ai: false,
  generation_mode: "balanced",
  spec_source: "",
  guidance: "",
};

const VIRTUAL_ROW_HEIGHT = 64;
const VIRTUAL_TABLE_HEIGHT = 560;
const DEFAULT_CASES_PAGE_SIZE = 100;
const VIRTUAL_TABLE_WIDTH = 980;
const TABLE_GRID =
  "280px minmax(520px, 1fr) 140px 120px minmax(260px, 1fr) 120px";

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
const VirtualCaseRow = React.memo(function VirtualCaseRow(props) {
  const {
    index,
    style,
    rows = [],
    selectedCaseId = "",
    isPreviewOpen = false,
    onSelect,
  } = props || {};

  const row = Array.isArray(rows) ? rows[index] : null;
  if (!row) return null;

  const isActive = selectedCaseId === row.id;
  const endpoint = getEndpointDisplay(row.api_details);

  return (
    <div
      style={{
        ...style,
        ...styles.virtualRow,
        ...(isActive ? styles.virtualRowActive : {}),
      }}
    >
      <div style={styles.virtualCellMono} title={row.id || "-"}>
        {row.id || "-"}
      </div>

      <div style={styles.virtualCellTitle} title={row.title || "-"}>
        {row.title || "-"}
      </div>

      <div style={styles.virtualCell} title={row.test_type || "-"}>
        {row.test_type || "-"}
      </div>

      <div style={styles.virtualCell} title={row.priority || "-"}>
        {row.priority || "-"}
      </div>

      <div style={styles.virtualCellApi} title={endpoint.summary || "-"}>
        {endpoint.summary || "-"}
      </div>

      <div style={styles.virtualCellAction}>
        <button
          type="button"
          onClick={() => onSelect?.(row.id)}
          style={
            isActive && isPreviewOpen ? styles.viewBtnActive : styles.viewBtn
          }
        >
          View
        </button>
      </div>
    </div>
  );
});
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
  userId = "",
}) {
  const resolvedProjectId = projectId || selectedProjectId || "";
  const resolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...(options || {}),
    ...(generatorSettings || {}),
  };
  const safeInclude = Array.from(
    new Set(
      Array.isArray(resolvedOptions.include) &&
        resolvedOptions.include.length > 0
        ? resolvedOptions.include
        : ["contract", "schema", "negative", "auth"],
    ),
  );

  const [endpointsLoading, setEndpointsLoading] = useState(true);
  const [endpointsErr, setEndpointsErr] = useState("");
  const [endpoints, setEndpoints] = useState([]);
  const [tableRows, setTableRows] = useState([]);

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
  const [jobProgress, setJobProgress] = useState(null);

  // paginated test-cases state
  const [casesPage, setCasesPage] = useState(1);
  const [casesPageSize, setCasesPageSize] = useState(DEFAULT_CASES_PAGE_SIZE);
  const [casesTotal, setCasesTotal] = useState(0);
  const [casesLoading, setCasesLoading] = useState(false);

  const totalCasePages = useMemo(() => {
    if (!casesTotal) return 1;
    return Math.max(1, Math.ceil(casesTotal / casesPageSize));
  }, [casesTotal, casesPageSize]);

  const selectedCase = useMemo(() => {
    if (!tableRows.length) return null;
    return tableRows.find((row) => row.id === selectedCaseId) || null;
  }, [tableRows, selectedCaseId]);

  const virtualRows = useMemo(() => tableRows, [tableRows]);

  const virtualItemData = useMemo(
    () => ({
      rows: Array.isArray(virtualRows) ? virtualRows : [],
      selectedCaseId: selectedCaseId || "",
      isPreviewOpen: !!isPreviewOpen,
      onSelect: (id) => {
        setSelectedCaseId(id);
        setIsPreviewOpen(true);
      },
    }),
    [virtualRows, selectedCaseId, isPreviewOpen],
  );

  const selectedCount = (selection.selected_endpoint_ids || []).length;
  const runningStepLabel =
    run.status === "running"
      ? RUNNING_STEPS[runningStepIndex % RUNNING_STEPS.length]
      : null;

  useEffect(() => {
    if (generatedRun?.testplan || generatedRun?.run_id) {
      setRun((prev) => ({
        ...prev,
        ...generatedRun,
      }));
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

  useEffect(() => {
    if (activeSection === "testCases") {
      setCasesPage(1);
      setSelectedCaseId("");
      setIsPreviewOpen(false);
      setTableRows([]);
    }
  }, [activeSection, run?.run_id]);

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

  async function fetchRunCasesPage(runId, page = 1, pageSize = 100) {
    const res = await fetch(
      `/api/runs/${encodeURIComponent(runId)}/cases?page=${page}&page_size=${pageSize}`,
      {
        headers: { Accept: "application/json" },
      },
    );

    const text = await res.text();
    const data = safeJsonParse(text);

    if (!res.ok) {
      throw new Error(
        data?.message || `Failed to load run cases (${res.status})`,
      );
    }

    return {
      cases: Array.isArray(data?.cases) ? data.cases : [],
      total_cases: Number(data?.total_cases || 0),
      page: Number(data?.page || page),
      page_size: Number(data?.page_size || pageSize),
    };
  }

  useEffect(() => {
    async function loadPagedCases() {
      if (activeSection !== "testCases") return;
      if (!run?.run_id) return;

      setCasesLoading(true);

      try {
        const data = await fetchRunCasesPage(
          run.run_id,
          casesPage,
          casesPageSize,
        );

        const cases = (data.cases || []).map((c) => ({
          ...c,
          test_data_summary: summarizeTestData(c.test_data),
        }));
        setCasesTotal(data.total_cases || 0);

        const uniqueEndpointCount = new Set(
          cases.map(
            (c) =>
              `${c.api_details?.method || ""} ${c.api_details?.path || ""}`,
          ),
        ).size;

        setTableRows(cases);

        setRun((prev) => {
          const nextRun = {
            ...prev,
            report: {
              ...(prev.report || {}),
              total_cases: data.total_cases || prev.report?.total_cases || 0,
              needs_review:
                prev.report?.needs_review ??
                cases.filter((c) => !!c.needs_review).length,
              endpoint_count:
                prev.report?.endpoint_count ??
                prev.eligible_endpoints?.length ??
                uniqueEndpointCount,
            },
          };

          if (onSaveGeneratedRun) {
            onSaveGeneratedRun(nextRun);
          }

          return nextRun;
        });
      } catch (e) {
        console.error("LOAD PAGED CASES ERROR:", e);
        setTableRows([]);
        setRun((prev) => ({
          ...prev,
          error: {
            message: e.message || "Failed to load generated test cases.",
          },
        }));
      } finally {
        setCasesLoading(false);
      }
    }

    loadPagedCases();
  }, [
    activeSection,
    run?.run_id,
    casesPage,
    casesPageSize,
    resolvedProjectId,
    resolvedOptions.env,
    onSaveGeneratedRun,
  ]);

  function streamJob(jobId, { onProgress, onDone, onError }) {
    const es = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/events`);

    es.addEventListener("snapshot", (evt) => {
      const payload = safeJsonParse(evt.data);
      const job = payload?.job || null;
      if (!job) return;

      onProgress?.(job);

      if (job.status === "completed") {
        es.close();
        onDone?.(job);
      } else if (job.status === "failed") {
        es.close();
        onError?.(
          new Error(job?.error?.message || "Generation job failed."),
          job,
        );
      }
    });

    es.addEventListener("progress", (evt) => {
      const payload = safeJsonParse(evt.data);
      const job = payload?.job || null;
      if (!job) return;

      onProgress?.(job);

      if (job.status === "completed") {
        es.close();
        onDone?.(job);
      } else if (job.status === "failed") {
        es.close();
        onError?.(
          new Error(job?.error?.message || "Generation job failed."),
          job,
        );
      }
    });

    es.onerror = () => {
      es.close();
      onError?.(new Error("Live progress connection lost."));
    };

    return () => es.close();
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

    if (!userId) {
      alert("User session is missing. Please log in again.");
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
      created_by: userId,
      env: resolvedOptions.env,
      auth_profile: resolvedOptions.auth_profile,
      include: safeInclude,
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

      await new Promise((resolve, reject) => {
        const closeStream = streamJob(jobId, {
          onProgress: (job) => {
            setJobProgress(job?.progress || null);

            setRun((r) => ({
              ...r,
              status: job?.status === "completed" ? "done" : "running",
              error: job?.error || null,
            }));
          },

          onDone: async () => {
            try {
              closeStream?.();

              const result = await fetchJobResult(jobId);

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
              setJobProgress(null);
              setCasesPage(1);
              setSelectedCaseId("");
              setIsPreviewOpen(false);

              if (onSaveGeneratedRun) {
                onSaveGeneratedRun(nextRun);
              }

              resolve();
            } catch (err) {
              reject(err);
            }
          },

          onError: (err, job) => {
            closeStream?.();

            reject(
              Object.assign(err, {
                details: job?.error || null,
              }),
            );
          },
        });
      });
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
    if (!tableRows.length) return;
    downloadText(
      `test_cases_page_${casesPage}.json`,
      JSON.stringify(tableRows, null, 2),
      "application/json",
    );
  }

  function exportCsv() {
    if (!tableRows.length) return;
    const csv = buildCsvFromTable(tableRows);
    downloadText(`test_cases_page_${casesPage}.csv`, csv, "text/csv");
  }

  const isTestCasesSection = activeSection === "testCases";
  if (isTestCasesSection) {
    return renderTestCasesSection();
  }

  function renderTestCasesSection() {
    return (
      <div style={styles.testCasesPage}>
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
                disabled={!tableRows.length || casesLoading}
                style={styles.secondaryBtn}
              >
                Export JSON
              </button>

              <button
                type="button"
                onClick={exportCsv}
                disabled={!tableRows.length || casesLoading}
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
            ) : casesLoading ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyStateTitle}>Loading test cases...</div>
                <div style={styles.emptyStateText}>
                  Fetching page {casesPage} of generated cases.
                </div>
              </div>
            ) : !tableRows.length ? (
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
                <div style={styles.resultsSummaryWrap}>
                  <ResultsSummary
                    rows={tableRows}
                    report={{
                      ...run.report,
                      total_cases: casesTotal || run.report?.total_cases || 0,
                    }}
                    testplan={null}
                  />
                </div>

                <div style={styles.paginationBar}>
                  <div style={styles.paginationMeta}>
                    Page {casesPage} of {totalCasePages} • Total cases:{" "}
                    {casesTotal}
                  </div>

                  <div style={styles.paginationControls}>
                    <select
                      value={casesPageSize}
                      onChange={(e) => {
                        setCasesPageSize(Number(e.target.value) || 100);
                        setCasesPage(1);
                      }}
                      style={styles.pageSizeSelect}
                    >
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                      <option value={200}>200 / page</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setCasesPage((p) => Math.max(1, p - 1))}
                      disabled={casesPage <= 1 || casesLoading}
                      style={styles.secondaryBtn}
                    >
                      Previous
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setCasesPage((p) => Math.min(totalCasePages, p + 1))
                      }
                      disabled={casesPage >= totalCasePages || casesLoading}
                      style={styles.secondaryBtn}
                    >
                      Next
                    </button>
                  </div>
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
                        Showing {tableRows.length} row
                        {tableRows.length === 1 ? "" : "s"} on this page
                      </div>
                    </div>

                    <div style={styles.virtualOuterScroll}>
                      <div style={styles.virtualTableWrap}>
                        <div style={styles.virtualHeader}>
                          <div style={styles.virtualHeaderCell}>ID</div>
                          <div style={styles.virtualHeaderCell}>Title</div>
                          <div style={styles.virtualHeaderCell}>Type</div>
                          <div style={styles.virtualHeaderCell}>Priority</div>
                          <div style={styles.virtualHeaderCell}>API</div>
                          <div style={styles.virtualHeaderCell}>Action</div>
                        </div>

                        <List
                          height={VIRTUAL_TABLE_HEIGHT}
                          width={"100%"}
                          rowCount={virtualRows.length}
                          rowHeight={VIRTUAL_ROW_HEIGHT}
                          rowComponent={VirtualCaseRow}
                          rowProps={virtualItemData}
                          overscanCount={8}
                        />
                      </div>
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
                          selectedCase.test_data?.request_body !== null &&
                          (typeof selectedCase.test_data.request_body !==
                            "object" ||
                            Object.keys(
                              selectedCase.test_data.request_body || {},
                            ).length > 0) ? (
                            <pre style={styles.previewCodeBlock}>
                              {prettyJson(selectedCase.test_data.request_body)}
                            </pre>
                          ) : (
                            <div style={styles.detailMuted}>-</div>
                          )}
                        </div>

                        <div style={styles.previewSection}>
                          <div style={styles.previewLabel}>Objective</div>
                          <div style={styles.previewText}>
                            {selectedCase.objective || "-"}
                          </div>
                        </div>

                        {selectedCase.review_notes ? (
                          <div style={styles.previewSection}>
                            <div style={styles.previewLabel}>Review Notes</div>
                            <div style={styles.previewText}>
                              {selectedCase.review_notes}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </aside>
                  </>
                ) : null}
              </>
            )}
          </div>
        </section>
      </div>
    );
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

  @media (max-width: 1360px) {
  .generator-main-grid {
    grid-template-columns: 390px minmax(0, 1fr) !important;
  }
}

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
      overflow: visible !important;
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
                disabled={!tableRows.length || casesLoading}
                style={styles.secondaryBtn}
              >
                Export JSON
              </button>

              <button
                type="button"
                onClick={exportCsv}
                disabled={!tableRows.length || casesLoading}
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
            ) : casesLoading ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyStateTitle}>Loading test cases...</div>
                <div style={styles.emptyStateText}>
                  Fetching page {casesPage} of generated cases.
                </div>
              </div>
            ) : !tableRows.length ? (
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
                    report={{
                      ...run.report,
                      total_cases: casesTotal || run.report?.total_cases || 0,
                    }}
                    testplan={null}
                  />
                </div>

                <div style={styles.paginationBar}>
                  <div style={styles.paginationMeta}>
                    Page {casesPage} of {totalCasePages} • Total cases:{" "}
                    {casesTotal}
                  </div>

                  <div style={styles.paginationControls}>
                    <select
                      value={casesPageSize}
                      onChange={(e) => {
                        setCasesPageSize(Number(e.target.value) || 100);
                        setCasesPage(1);
                      }}
                      style={styles.pageSizeSelect}
                    >
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                      <option value={200}>200 / page</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setCasesPage((p) => Math.max(1, p - 1))}
                      disabled={casesPage <= 1 || casesLoading}
                      style={styles.secondaryBtn}
                    >
                      Previous
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setCasesPage((p) => Math.min(totalCasePages, p + 1))
                      }
                      disabled={casesPage >= totalCasePages || casesLoading}
                      style={styles.secondaryBtn}
                    >
                      Next
                    </button>
                  </div>
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
                        Showing {tableRows.length} row
                        {tableRows.length === 1 ? "" : "s"} on this page
                      </div>
                    </div>

                    <div style={styles.virtualOuterScroll}>
                      <div style={styles.virtualTableWrap}>
                        <div style={styles.virtualHeader}>
                          <div style={styles.virtualHeaderCell}>ID</div>
                          <div style={styles.virtualHeaderCell}>Title</div>
                          <div style={styles.virtualHeaderCell}>Type</div>
                          <div style={styles.virtualHeaderCell}>Priority</div>
                          <div style={styles.virtualHeaderCell}>API</div>
                          <div style={styles.virtualHeaderCell}>Action</div>
                        </div>

                        <List
                          height={VIRTUAL_TABLE_HEIGHT}
                          width={VIRTUAL_TABLE_WIDTH}
                          rowCount={virtualRows.length}
                          rowHeight={VIRTUAL_ROW_HEIGHT}
                          rowComponent={VirtualCaseRow}
                          rowProps={virtualItemData}
                          overscanCount={8}
                        />
                      </div>
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
                          selectedCase.test_data?.request_body !== null &&
                          (typeof selectedCase.test_data.request_body !==
                            "object" ||
                            Object.keys(
                              selectedCase.test_data.request_body || {},
                            ).length > 0) ? (
                            <pre style={styles.previewCodeBlock}>
                              {prettyJson(selectedCase.test_data.request_body)}
                            </pre>
                          ) : (
                            <div style={styles.detailMuted}>-</div>
                          )}
                        </div>

                        <div style={styles.previewSection}>
                          <div style={styles.previewLabel}>Objective</div>
                          <div style={styles.previewText}>
                            {selectedCase.objective || "-"}
                          </div>
                        </div>

                        {selectedCase.review_notes ? (
                          <div style={styles.previewSection}>
                            <div style={styles.previewLabel}>Review Notes</div>
                            <div style={styles.previewText}>
                              {selectedCase.review_notes}
                            </div>
                          </div>
                        ) : null}
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
                  extraActions={
                    <button
                      type="button"
                      onClick={generate}
                      disabled={
                        !resolvedProjectId ||
                        run.status === "running" ||
                        selectedCount === 0
                      }
                      style={{
                        ...styles.primaryBtnSmall,
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
                  }
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
            </div>
          </aside>
          <section style={styles.rightPane}>
            {run.status === "running" ? (
              <div style={styles.runningCard}>
                <div style={styles.runningTitle}>Generation in progress</div>
                <div style={styles.runningText}>
                  {runningStepLabel || "Working on your test cases..."}
                </div>

                <div style={styles.runningDots}>
                  <span className="gen-dot" />
                  <span className="gen-dot" />
                  <span className="gen-dot" />
                  <span className="gen-dot" />
                  <span className="gen-dot" />
                </div>

                {jobProgress ? (
                  <div style={styles.progressInfoBox}>
                    <div style={styles.progressRow}>
                      <strong>Status:</strong>{" "}
                      {jobProgress.message || "Generation running"}
                    </div>
                    <div style={styles.progressRow}>
                      <strong>Endpoints:</strong>{" "}
                      {jobProgress.progress_current || 0} /{" "}
                      {jobProgress.progress_total || 0}
                    </div>
                    <div style={styles.progressRow}>
                      <strong>Batches:</strong>{" "}
                      {jobProgress.processed_batches || 0} /{" "}
                      {jobProgress.total_batches || 0}
                    </div>
                    <div style={styles.progressRow}>
                      <strong>Inserted cases:</strong>{" "}
                      {jobProgress.inserted_cases || 0}
                    </div>
                    <div style={styles.progressRow}>
                      <strong>Needs review:</strong>{" "}
                      {jobProgress.needs_review || 0}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : run.status === "error" ? (
              <div style={{ ...styles.infoBox, ...styles.errorInfo }}>
                Error: {run.error?.message || "Generation failed."}
              </div>
            ) : run.status === "done" ? (
              <div style={styles.successCard}>
                <div style={styles.successTitle}>Generation complete</div>
                <div style={styles.successText}>
                  Your run has finished. Open the Test Cases tab for paginated
                  review.
                </div>

                <div className="success-actions" style={styles.successActions}>
                  <button
                    type="button"
                    onClick={() => onViewTestCases?.()}
                    style={styles.primaryBtn}
                  >
                    Open Test Cases
                  </button>
                </div>
              </div>
            ) : (
              <div style={styles.infoBox}>
                Select endpoints and click Generate Tests to start.
              </div>
            )}
          </section>
        </section>
      )}
    </div>
  );
}
const styles = {
  page: {
    display: "grid",
    gap: 18,
    width: "100%",
  },

  notice: {
    padding: "14px 16px",
    borderRadius: 14,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    fontSize: 14,
  },
  testCasesPage: {
    width: "100%",
    minWidth: 0,
    padding: 24,
    boxSizing: "border-box",
  },

  resultsSummaryWrap: {
    marginBottom: 18,
  },

  virtualOuterScroll: {
    width: "100%",
    overflowX: "auto",
    overflowY: "hidden",
    background: "#ffffff",
  },

  topGenerateWrap: {
    padding: "10px 12px 0",
    display: "flex",
    justifyContent: "flex-start",
  },

  primaryBtnSmall: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "9px 12px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #2563eb, #4f46e5)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(37, 99, 235, 0.18)",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "400px minmax(0, 1fr)",
    gap: 8,
    alignItems: "stretch",
    marginTop: -8,
    marginLeft: -15,
    width: "calc(100% + 16px)",
  },
  resultsCard: {
    display: "grid",
    gap: 18,
    padding: 20,
    borderRadius: 24,
    border: "1px solid rgba(148, 163, 184, 0.14)",
    background:
      "linear-gradient(180deg, rgba(6, 18, 48, 0.72) 0%, rgba(4, 15, 40, 0.84) 100%)",
    boxShadow: "0 16px 40px rgba(2, 8, 23, 0.26)",
  },

  leftPane: {
    position: "sticky",
    top: 8,
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    gap: 0,
    borderRadius: 22,
    border: "1px solid #e8eef6",
    background: "#ffffff",
    overflow: "hidden",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
    maxHeight: "calc(100vh - 8px)",
    minHeight: 820,
    alignSelf: "start",
  },

  leftPaneHeader: {
    padding: "16px 18px 12px",
    borderBottom: "1px solid #eef2f7",
    background: "#f8fafc",
  },

  leftTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },

  leftSubtle: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },

  virtualTableWrap: {
    minWidth: 1440,
    width: "100%",
  },

  virtualHeader: {
    display: "grid",
    gridTemplateColumns: TABLE_GRID,
    alignItems: "center",
    columnGap: 0,
    padding: "0 24px",
    minHeight: 72,
    background: "#eef3fb",
    borderBottom: "1px solid #d9e2f0",
  },

  virtualHeaderCell: {
    padding: "0 20px",
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#355885",
    whiteSpace: "nowrap",
  },

  virtualRow: {
    display: "grid",
    gridTemplateColumns: TABLE_GRID,
    alignItems: "center",
    minHeight: 64,
    padding: "0 24px",
    borderBottom: "1px solid #e7edf7",
    background: "#ffffff",
  },

  virtualRowActive: {
    background: "#f8fbff",
  },

  virtualCell: {
    padding: "0 20px",
    fontSize: 16,
    fontWeight: 600,
    color: "#1f3a63",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  virtualCellMono: {
    padding: "0 20px",
    fontSize: 15,
    fontWeight: 700,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    color: "#1f3a63",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  virtualCellTitle: {
    padding: "0 20px",
    fontSize: 17,
    fontWeight: 800,
    color: "#102a56",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  virtualCellApi: {
    padding: "0 20px",
    fontSize: 15,
    fontWeight: 600,
    color: "#486587",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  virtualCellAction: {
    padding: "0 20px",
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "center",
  },

  explorerBody: {
    padding: 12,
    overflowY: "auto",
    overflowX: "hidden",
    minHeight: 0,
    background: "#ffffff",
  },

  explorerFooter: {
    padding: 12,
    borderTop: "1px solid #eef2f7",
    display: "grid",
    gap: 10,
    background: "#fff",
    flexShrink: 0,
  },

  explorerFooterTop: {
    display: "grid",

    gap: 10,
  },

  explorerFooterActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  countBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#3730a3",
    fontWeight: 700,
    fontSize: 12,
  },

  rightPane: {
    display: "grid",
    gap: 16,
    minWidth: 0,
    paddingLeft: 0,
    alignContent: "start",
  },

  resultsHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    width: "100%",
  },

  resultsTopActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    flexShrink: 0,
  },

  modeBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    padding: "0 16px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#3658db",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.03em",
    whiteSpace: "nowrap",
  },
  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #2563eb, #4f46e5)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(37, 99, 235, 0.24)",
  },
  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #dbe3f0",
    background: "#fff",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  },
  infoBox: {
    padding: 16,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#334155",
    fontSize: 14,
  },
  errorInfo: {
    borderColor: "#fecaca",
    background: "#fef2f2",
    color: "#991b1b",
  },
  runningCard: {
    padding: 14,
    borderRadius: 20,
    border: "1px solid #dbeafe",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
    display: "grid",
    gap: 8,
  },
  runningTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "#0f172a",
  },
  runningText: {
    color: "#475569",
    fontSize: 13,
  },
  runningDots: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  progressInfoBox: {
    display: "grid",
    gap: 6,
    padding: 14,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  progressRow: {
    fontSize: 13,
    color: "#334155",
  },
  successCard: {
    padding: 14,
    borderRadius: 20,
    border: "1px solid #bbf7d0",
    background: "linear-gradient(180deg, #ffffff 0%, #f7fff9 100%)",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
    display: "grid",
    gap: 8,
    alignContent: "start",
  },
  successTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "#166534",
  },
  successText: {
    fontSize: 13,
    color: "#475569",
  },
  successActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  testCasesWrap: {
    display: "grid",
    gap: 18,
    width: "100%",
    maxWidth: "100%",
  },
  resultsInner: {
    display: "grid",
    gap: 18,
    width: "100%",
    maxWidth: "none",
  },
  emptyState: {
    padding: 28,
    borderRadius: 20,
    border: "1px dashed #cbd5e1",
    background: "#fff",
    textAlign: "center",
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },
  emptyStateText: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748b",
  },
  paginationBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: "14px 16px",
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
  },
  paginationMeta: {
    fontSize: 13,
    color: "#334155",
    fontWeight: 700,
  },
  paginationControls: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  pageSizeSelect: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #dbe3f0",
    background: "#fff",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 600,
  },
  tableOnlyWrap: {
    position: "relative",
    transition: "filter 0.2s ease, opacity 0.2s ease",
  },
  tableOnlyWrapBlurred: {
    filter: "blur(2px)",
    opacity: 0.72,
    pointerEvents: "none",
  },
  tablePane: {
    background: "#ffffff",
    border: "1px solid #d9e2f0",
    borderRadius: 28,
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
  },
  tablePaneHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    padding: "28px 32px",
    borderBottom: "1px solid #d9e2f0",
    background: "#ffffff",
  },
  tablePaneTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "#0f274f",
  },
  tablePaneMeta: {
    fontSize: 16,
    color: "#4c6b95",
    fontWeight: 700,
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
  },
  th: {
    position: "sticky",
    top: 0,
    zIndex: 1,
    padding: "12px 14px",
    textAlign: "left",
    fontSize: 12,
    fontWeight: 800,
    color: "#475569",
    background: "#f8fafc",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px 14px",
    fontSize: 13,
    color: "#334155",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
  },
  tdMono: {
    padding: "12px 14px",
    fontSize: 12,
    color: "#0f172a",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  tdTitle: {
    padding: "12px 14px",
    fontSize: 13,
    color: "#0f172a",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
    fontWeight: 700,
  },
  tdApi: {
    padding: "12px 14px",
    fontSize: 12,
    color: "#334155",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  trActive: {
    background: "#f8fbff",
  },
  viewBtn: {
    height: 42,
    padding: "0 18px",
    borderRadius: 14,
    border: "1px solid #cfd9ea",
    background: "#ffffff",
    color: "#1f2b3d",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  viewBtnActive: {
    height: 42,
    padding: "0 18px",
    borderRadius: 14,
    border: "1px solid #b7cdf3",
    background: "#edf4ff",
    color: "#123a72",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
  },
  previewOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.28)",
    zIndex: 50,
    animation: "overlayFadeIn 0.18s ease-out forwards",
  },
  previewDrawer: {
    position: "fixed",
    top: 0,
    right: 0,
    width: 520,
    maxWidth: "100vw",
    height: "100vh",
    background: "#fff",
    zIndex: 60,
    boxShadow: "-10px 0 30px rgba(15, 23, 42, 0.16)",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    animation: "previewSlideIn 0.22s ease-out forwards",
  },
  previewHead: {
    padding: "18px 20px",
    borderBottom: "1px solid #eef2f7",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },
  previewSubtle: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  previewCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
  },
  previewBody: {
    overflowY: "auto",
    padding: 20,
    display: "grid",
    gap: 16,
  },
  previewSection: {
    display: "grid",
    gap: 8,
  },
  previewCaseTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1.2,
  },
  previewMeta: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 700,
  },
  previewGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  previewMiniCard: {
    padding: 14,
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    minWidth: 0,
  },
  previewMiniLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 6,
  },
  previewMiniValue: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: 700,
  },
  previewMiniValueMono: {
    fontSize: 12,
    color: "#0f172a",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    wordBreak: "break-word",
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
  },
  previewText: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 1.6,
  },
  previewCodeBlock: {
    margin: 0,
    padding: 14,
    borderRadius: 14,
    background: "#0f172a",
    color: "#e2e8f0",
    fontSize: 12,
    lineHeight: 1.6,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  previewCodeBlockLight: {
    margin: 0,
    padding: 14,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
    fontSize: 12,
    lineHeight: 1.6,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  endpointWarning: {
    fontSize: 12,
    color: "#9a3412",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    padding: "10px 12px",
    borderRadius: 12,
  },
  detailList: {
    margin: 0,
    paddingLeft: 18,
    color: "#334155",
    fontSize: 14,
    lineHeight: 1.7,
  },
  detailMuted: {
    color: "#94a3b8",
    fontSize: 14,
  },
};
