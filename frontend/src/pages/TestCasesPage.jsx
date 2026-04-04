import React, { useEffect, useMemo, useState } from "react";
import TestCaseDrawer from "../components/TestCaseDrawer";
import { TEST_CASE_CSV_COLUMNS } from "../utils/testCaseColumns";

const FETCH_PAGE_SIZE = 500;
const UI_PAGE_SIZE = 20;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function summarizeTestData(testData) {
  if (!testData || typeof testData !== "object") return "-";

  const pathCount = Object.keys(testData.path_params || {}).length;
  const queryCount = Object.keys(testData.query_params || {}).length;
  const headerCount = Object.keys(testData.headers || {}).length;
  const cookieCount = Object.keys(testData.cookies || {}).length;
  const hasBody =
    testData.request_body !== undefined && testData.request_body !== null;

  return `path:${pathCount} · query:${queryCount} · headers:${headerCount} · cookies:${cookieCount} · body:${hasBody ? "yes" : "no"}`;
}

function deriveTableRows(testplan) {
  const rows = [];
  if (!testplan?.suites) return rows;

  testplan.suites.forEach((suite, si) => {
    safeArray(suite.cases).forEach((tc, ci) => {
      rows.push({
        suite_id: suite.suite_id || "",
        suite_name: suite.name || suite.suite_id || "Untitled Suite",
        id: tc.id || "",
        title: tc.title || "",
        module: tc.module || "",
        test_type: tc.test_type || "",
        priority: tc.priority || "",
        objective: tc.objective || "",
        preconditions: safeArray(tc.preconditions),
        test_data: tc.test_data || {},
        test_data_summary: summarizeTestData(tc.test_data),
        steps: safeArray(tc.steps),
        expected_results: safeArray(tc.expected_results),
        api_details: tc.api_details || {},
        validation_focus: safeArray(tc.validation_focus),
        references: safeArray(tc.references),
        needs_review: !!tc.needs_review,
        review_notes: tc.review_notes || "",
        ref: { suiteIndex: si, caseIndex: ci },
      });
    });
  });

  return rows;
}

function normalizeFetchedCase(tc, suiteIndex = 0, caseIndex = 0) {
  return {
    suite_id: tc?.suite_id || "",
    suite_name: tc?.suite_name || tc?.suite_id || "Untitled Suite",
    id: tc?.id || "",
    title: tc?.title || "",
    module: tc?.module || "",
    test_type: tc?.test_type || "",
    priority: tc?.priority || "",
    objective: tc?.objective || "",
    preconditions: safeArray(tc?.preconditions),
    test_data: tc?.test_data || {},
    test_data_summary: summarizeTestData(tc?.test_data),
    steps: safeArray(tc?.steps),
    expected_results: safeArray(tc?.expected_results),
    api_details: tc?.api_details || {},
    validation_focus: safeArray(tc?.validation_focus),
    references: safeArray(tc?.references),
    needs_review: !!tc?.needs_review,
    review_notes: tc?.review_notes || "",
    ref: { suiteIndex, caseIndex },
  };
}

function buildTestplanFromRows(rows, generatedRun) {
  const suitesMap = new Map();

  rows.forEach((row) => {
    const suiteId = row.suite_id || "default_suite";
    const suiteName = row.suite_name || suiteId || "Untitled Suite";

    if (!suitesMap.has(suiteId)) {
      suitesMap.set(suiteId, {
        suite_id: suiteId,
        name: suiteName,
        endpoints: [],
        cases: [],
      });
    }

    suitesMap.get(suiteId).cases.push({
      id: row.id || "",
      title: row.title || "",
      module: row.module || "",
      test_type: row.test_type || "",
      priority: row.priority || "",
      objective: row.objective || "",
      preconditions: safeArray(row.preconditions),
      test_data: row.test_data || {},
      steps: safeArray(row.steps),
      expected_results: safeArray(row.expected_results),
      api_details: row.api_details || {},
      validation_focus: safeArray(row.validation_focus),
      references: safeArray(row.references),
      needs_review: !!row.needs_review,
      review_notes: row.review_notes || "",
    });
  });

  return {
    project: generatedRun?.testplan?.project || {
      project_id: generatedRun?.project_id || "",
      run_id: generatedRun?.run_id || "",
    },
    generation: generatedRun?.testplan?.generation || {
      run_id: generatedRun?.run_id || "",
      source: "db_cases",
    },
    suites: Array.from(suitesMap.values()),
  };
}

async function fetchAllRunCases(runId, signal) {
  let page = 1;
  let totalCases = 0;
  const collected = [];

  while (true) {
    const res = await fetch(
      `/api/runs/${encodeURIComponent(runId)}/cases?page=${page}&page_size=${FETCH_PAGE_SIZE}`,
      {
        method: "GET",
        credentials: "include",
        signal,
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to load run cases (${res.status})`);
    }

    const data = await res.json();
    const batch = safeArray(data?.cases);
    totalCases = Number(data?.total_cases || 0);

    collected.push(...batch);

    if (!batch.length || collected.length >= totalCases) {
      break;
    }

    page += 1;
  }

  return { totalCases, cases: collected };
}

function toCsvValue(v) {
  const s = String(v ?? "");
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildCsvFromTable(rows) {
  const header = TEST_CASE_CSV_COLUMNS.map((c) => c.label);
  const lines = [header.join(",")];

  for (const row of rows) {
    const values = TEST_CASE_CSV_COLUMNS.map((c) =>
      toCsvValue(c.getValue(row)),
    );
    lines.push(values.join(","));
  }

  return lines.join("\n");
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

function shortText(value, max = 80) {
  const text = String(value || "");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function typeTone(type) {
  const v = String(type || "").toLowerCase();

  if (v === "contract") return { bg: "rgba(99,102,241,.16)", color: "#c7d2fe" };
  if (v === "schema") return { bg: "rgba(6,182,212,.16)", color: "#a5f3fc" };
  if (v === "negative") return { bg: "rgba(249,115,22,.16)", color: "#fdba74" };
  if (v === "auth") return { bg: "rgba(236,72,153,.16)", color: "#f9a8d4" };

  return { bg: "rgba(148,163,184,.14)", color: "#cbd5e1" };
}

function priorityTone(priority) {
  const v = String(priority || "").toUpperCase();

  if (v === "P0") return { bg: "rgba(239,68,68,.16)", color: "#fca5a5" };
  if (v === "P1") return { bg: "rgba(245,158,11,.16)", color: "#fcd34d" };
  if (v === "P2") return { bg: "rgba(34,197,94,.16)", color: "#86efac" };

  return { bg: "rgba(148,163,184,.14)", color: "#cbd5e1" };
}

function methodTone(method) {
  const v = String(method || "").toUpperCase();

  if (v === "GET") return { bg: "rgba(34,197,94,.14)", color: "#86efac" };
  if (v === "POST") return { bg: "rgba(99,102,241,.16)", color: "#c7d2fe" };
  if (v === "PUT") return { bg: "rgba(59,130,246,.16)", color: "#93c5fd" };
  if (v === "PATCH") return { bg: "rgba(249,115,22,.16)", color: "#fdba74" };
  if (v === "DELETE") return { bg: "rgba(239,68,68,.16)", color: "#fca5a5" };

  return { bg: "rgba(148,163,184,.14)", color: "#cbd5e1" };
}

function StatCard({ label, value, help }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statHelp}>{help}</div>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <label style={styles.filterField}>
      <span style={styles.filterLabel}>{label}</span>
      {children}
    </label>
  );
}

export default function TestCasesPage({ projectId, generatedRun }) {
  const runId = generatedRun?.run_id || "";
  const fallbackTestplan = generatedRun?.testplan || null;
  const fallbackRows = useMemo(
    () => deriveTableRows(fallbackTestplan),
    [fallbackTestplan],
  );

  const [rows, setRows] = useState(fallbackRows);
  const [totalCases, setTotalCases] = useState(fallbackRows.length);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [selectedSuiteId, setSelectedSuiteId] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedPriority, setSelectedPriority] = useState("ALL");
  const [reviewFilter, setReviewFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState({ open: false, row: null });

  useEffect(() => {
    setSelectedSuiteId("ALL");
    setSelectedType("ALL");
    setSelectedPriority("ALL");
    setReviewFilter("ALL");
    setQuery("");
    setPage(1);
    setDrawer({ open: false, row: null });
  }, [runId]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadAllCases() {
      if (!runId) {
        setRows(fallbackRows);
        setTotalCases(fallbackRows.length);
        setLoadError("");
        return;
      }

      setLoading(true);
      setLoadError("");

      try {
        const result = await fetchAllRunCases(runId, controller.signal);
        if (!active) return;

        const normalizedRows = result.cases.map((tc, index) =>
          normalizeFetchedCase(tc, 0, index),
        );

        setRows(normalizedRows);
        setTotalCases(result.totalCases || normalizedRows.length);
      } catch (err) {
        if (!active || err?.name === "AbortError") return;

        setRows(fallbackRows);
        setTotalCases(fallbackRows.length);
        setLoadError(
          err?.message ||
            "Failed to load all cases from server. Showing fallback data.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAllCases();

    return () => {
      active = false;
      controller.abort();
    };
  }, [runId, fallbackRows]);

  const testplan = useMemo(() => {
    if (rows.length) return buildTestplanFromRows(rows, generatedRun);
    return fallbackTestplan;
  }, [rows, generatedRun, fallbackTestplan]);

  const suiteOptions = useMemo(() => {
    const map = new Map();

    for (const row of rows) {
      if (!map.has(row.suite_id)) {
        map.set(row.suite_id, {
          suite_id: row.suite_id,
          suite_name: row.suite_name,
          count: 0,
        });
      }
      map.get(row.suite_id).count += 1;
    }

    return Array.from(map.values());
  }, [rows]);

  const typeOptions = useMemo(() => {
    return Array.from(
      new Set(rows.map((r) => r.test_type).filter(Boolean)),
    ).sort();
  }, [rows]);

  const priorityOptions = useMemo(() => {
    return Array.from(
      new Set(rows.map((r) => r.priority).filter(Boolean)),
    ).sort();
  }, [rows]);

  const visibleRows = useMemo(() => {
    const MAX_ROWS = 500;

    const baseRows = rows.slice(0, MAX_ROWS);
    const q = query.trim().toLowerCase();

    return baseRows.filter((row) => {
      const suiteOk =
        selectedSuiteId === "ALL" || row.suite_id === selectedSuiteId;

      const typeOk = selectedType === "ALL" || row.test_type === selectedType;

      const priorityOk =
        selectedPriority === "ALL" || row.priority === selectedPriority;

      let reviewOk = true;
      if (reviewFilter === "YES") reviewOk = row.needs_review;
      else if (reviewFilter === "NO") reviewOk = !row.needs_review;

      const haystack = [
        row.id,
        row.title,
        row.module,
        row.suite_name,
        row.api_details?.method,
        row.api_details?.path,
        row.objective,
        row.review_notes,
      ]
        .join(" ")
        .toLowerCase();

      const queryOk = !q || haystack.includes(q);

      return suiteOk && typeOk && priorityOk && reviewOk && queryOk;
    });
  }, [
    rows,
    query,
    selectedSuiteId,
    selectedType,
    selectedPriority,
    reviewFilter,
  ]);

  useEffect(() => {
    setPage(1);
  }, [query, selectedSuiteId, selectedType, selectedPriority, reviewFilter]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / UI_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * UI_PAGE_SIZE;
    return visibleRows.slice(start, start + UI_PAGE_SIZE);
  }, [visibleRows, safePage]);

  function exportJson() {
    if (!testplan) return;
    downloadText(
      `test_cases_${runId || "export"}.json`,
      JSON.stringify(testplan, null, 2),
      "application/json",
    );
  }

  function exportCsv() {
    if (!visibleRows.length) return;
    const csv = buildCsvFromTable(visibleRows);
    downloadText(`test_cases_${runId || "export"}.csv`, csv, "text/csv");
  }

  if (!testplan && !loading) {
    return (
      <div style={styles.emptyWrap}>
        <div style={styles.emptyCard}>
          <div style={styles.emptyTitle}>No generated test cases yet</div>
          <div style={styles.emptyText}>
            Go to Generate Tests, run a generation, then open them here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Quality intelligence workspace</div>
          <h1 style={styles.title}>Generated Test Cases</h1>
          <p style={styles.subtitle}>
            Review, filter, inspect, and export generated cases with a cleaner
            pro layout.
          </p>
        </div>

        <div style={styles.heroMeta}>
          <div style={styles.heroMetaLine}>
            <span style={styles.heroMetaLabel}>Project</span>
            <span style={styles.heroMetaValue}>
              {projectId || "Select a project first"}
            </span>
          </div>
          <div style={styles.heroMetaLine}>
            <span style={styles.heroMetaLabel}>Run</span>
            <span style={styles.heroMetaValue}>{runId || "-"}</span>
          </div>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <StatCard
          label="Generated cases"
          value={totalCases}
          help={loading ? "Loading from server…" : "Total cases in this run"}
        />
        <StatCard
          label="Visible cases"
          value={visibleRows.length}
          help="After search and filters"
        />
        <StatCard
          label="Suites"
          value={suiteOptions.length}
          help="Logical groupings in this run"
        />
        <StatCard
          label="Covered endpoints"
          value={
            new Set(
              rows
                .map((r) =>
                  `${r.api_details?.method || ""} ${r.api_details?.path || ""}`.trim(),
                )
                .filter(Boolean),
            ).size
          }
          help="Unique method + path pairs"
        />
      </div>

      <div style={styles.toolbarCard}>
        <div style={styles.toolbarTop}>
          <div>
            <div style={styles.cardTitle}>Filters & Search</div>
            <div style={styles.cardSubtle}>
              Fast local filtering for large generated datasets.
            </div>
            {!!loadError && <div style={styles.errorText}>{loadError}</div>}
          </div>

          <div style={styles.actionRow}>
            <button style={styles.secondaryBtn} onClick={exportJson}>
              Export JSON
            </button>
            <button
              style={{
                ...styles.primaryBtn,
                opacity: visibleRows.length ? 1 : 0.6,
                cursor: visibleRows.length ? "pointer" : "not-allowed",
              }}
              onClick={exportCsv}
              disabled={!visibleRows.length}
            >
              Export CSV
            </button>
          </div>
        </div>

        <div style={styles.filtersGrid}>
          <FilterField label="Search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, id, method, path, notes..."
              style={styles.input}
            />
          </FilterField>

          <FilterField label="Suite">
            <select
              value={selectedSuiteId}
              onChange={(e) => setSelectedSuiteId(e.target.value)}
              style={styles.select}
            >
              <option value="ALL">All suites</option>
              {suiteOptions.map((suite) => (
                <option key={suite.suite_id} value={suite.suite_id}>
                  {suite.suite_name} ({suite.count})
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Type">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={styles.select}
            >
              <option value="ALL">All types</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Priority">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              style={styles.select}
            >
              <option value="ALL">All priorities</option>
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Review">
            <select
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value)}
              style={styles.select}
            >
              <option value="ALL">All</option>
              <option value="YES">Needs review</option>
              <option value="NO">Ready</option>
            </select>
          </FilterField>
        </div>
      </div>

      <div style={styles.tableCard}>
        <div style={styles.tableTop}>
          <div>
            <div style={styles.cardTitle}>Generated Test Cases</div>
            <div style={styles.cardSubtle}>
              Page {safePage} of {totalPages} · Showing {pagedRows.length} of{" "}
              {visibleRows.length}
            </div>
          </div>

          <div style={styles.pager}>
            <button
              style={styles.pageBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              Prev
            </button>
            <div style={styles.pageBadge}>{safePage}</div>
            <button
              style={styles.pageBtn}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              Next
            </button>
          </div>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.thId }}>ID</th>
                <th style={{ ...styles.th, ...styles.thTitle }}>Title</th>
                <th style={{ ...styles.th, ...styles.thEndpoint }}>Endpoint</th>
                <th style={{ ...styles.th, ...styles.thType }}>Type</th>
                <th style={{ ...styles.th, ...styles.thPriority }}>Priority</th>
                <th style={{ ...styles.th, ...styles.thReview }}>Review</th>
              </tr>
            </thead>

            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={styles.emptyTableCell}>
                    No rows match the current filters.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row, index) => {
                  const endpoint =
                    `${row.api_details?.method || ""} ${row.api_details?.path || ""}`.trim() ||
                    "-";
                  const method = row.api_details?.method || "";
                  const typeTag = typeTone(row.test_type);
                  const priorityTag = priorityTone(row.priority);
                  const methodTag = methodTone(method);

                  return (
                    <tr
                      key={`${row.id || row.title || "row"}-${index}`}
                      style={styles.tr}
                      onClick={() => setDrawer({ open: true, row })}
                    >
                      <td style={styles.td}>
                        <div style={styles.idText} title={row.id}>
                          {shortText(row.id, 34)}
                        </div>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.titleText} title={row.title}>
                          {shortText(row.title, 90)}
                        </div>
                        <div style={styles.subText} title={row.module}>
                          {shortText(row.module || row.suite_name || "-", 48)}
                        </div>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.endpointWrap}>
                          <span
                            style={{
                              ...styles.tag,
                              background: methodTag.bg,
                              color: methodTag.color,
                            }}
                          >
                            {method || "-"}
                          </span>
                          <span style={styles.endpointText} title={endpoint}>
                            {shortText(row.api_details?.path || "-", 48)}
                          </span>
                        </div>
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.tag,
                            background: typeTag.bg,
                            color: typeTag.color,
                          }}
                        >
                          {row.test_type || "-"}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.tag,
                            background: priorityTag.bg,
                            color: priorityTag.color,
                          }}
                        >
                          {row.priority || "-"}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.tag,
                            background: row.needs_review
                              ? "rgba(245,158,11,.16)"
                              : "rgba(34,197,94,.16)",
                            color: row.needs_review ? "#fcd34d" : "#86efac",
                          }}
                        >
                          {row.needs_review ? "Needs review" : "Ready"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
  page: {
    width: "100%",
    minWidth: 0,
    display: "grid",
    gap: 20,
    padding: 0,
    margin: 0,
    overflowX: "hidden",
  },

  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
    padding: "24px 26px",
    borderRadius: 24,
    border: "1px solid rgba(148,163,184,.18)",
    background:
      "linear-gradient(135deg, rgba(15,23,42,.96) 0%, rgba(17,24,39,.94) 52%, rgba(30,41,59,.92) 100%)",
    boxShadow: "0 18px 48px rgba(2,6,23,.28)",
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: ".16em",
    textTransform: "uppercase",
    color: "#93c5fd",
    marginBottom: 10,
  },

  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.05,
    fontWeight: 900,
    color: "#f8fafc",
  },

  subtitle: {
    margin: "10px 0 0",
    maxWidth: 720,
    fontSize: 15,
    lineHeight: 1.6,
    color: "#94a3b8",
  },

  heroMeta: {
    minWidth: 280,
    display: "grid",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,.14)",
    background: "rgba(255,255,255,.04)",
    backdropFilter: "blur(10px)",
  },

  heroMetaLine: {
    display: "grid",
    gap: 4,
  },

  heroMetaLabel: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    color: "#64748b",
  },

  heroMetaValue: {
    fontSize: 14,
    fontWeight: 700,
    color: "#e2e8f0",
    wordBreak: "break-word",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
    alignItems: "stretch",
  },

  statCard: {
    borderRadius: 22,
    padding: 20,
    border: "1px solid rgba(148,163,184,.14)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,.92), rgba(30,41,59,.90))",
    boxShadow: "0 14px 34px rgba(2,6,23,.18)",
  },

  statLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "#94a3b8",
    marginBottom: 12,
  },

  statValue: {
    fontSize: 42,
    lineHeight: 1,
    fontWeight: 900,
    color: "#f8fafc",
    marginBottom: 10,
  },

  statHelp: {
    fontSize: 13,
    lineHeight: 1.5,
    color: "#64748b",
  },

  toolbarCard: {
    borderRadius: 24,
    padding: 22,
    border: "1px solid rgba(148,163,184,.14)",
    background: "rgba(15,23,42,.84)",
    boxShadow: "0 14px 34px rgba(2,6,23,.14)",
  },

  toolbarTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 18,
  },

  actionRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  cardTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: "#f8fafc",
    marginBottom: 6,
  },

  cardSubtle: {
    fontSize: 14,
    lineHeight: 1.55,
    color: "#94a3b8",
  },

  errorText: {
    marginTop: 10,
    color: "#fca5a5",
    fontSize: 13,
    lineHeight: 1.5,
  },

  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },

  filterField: {
    display: "grid",
    gap: 8,
    minWidth: 0,
  },

  filterLabel: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    color: "#94a3b8",
  },

  input: {
    width: "100%",
    minWidth: 0,
    height: 46,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,.18)",
    background: "rgba(15,23,42,.72)",
    color: "#f8fafc",
    padding: "0 14px",
    outline: "none",
    boxSizing: "border-box",
  },

  select: {
    width: "100%",
    minWidth: 0,
    height: 46,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,.18)",
    background: "rgba(15,23,42,.72)",
    color: "#f8fafc",
    padding: "0 14px",
    outline: "none",
    boxSizing: "border-box",
  },

  primaryBtn: {
    height: 44,
    border: "none",
    borderRadius: 14,
    padding: "0 16px",
    fontWeight: 800,
    color: "#0f172a",
    background: "linear-gradient(135deg, #c4b5fd 0%, #93c5fd 100%)",
    boxShadow: "0 10px 20px rgba(99,102,241,.22)",
    cursor: "pointer",
  },

  secondaryBtn: {
    height: 44,
    borderRadius: 14,
    padding: "0 16px",
    fontWeight: 800,
    color: "#e2e8f0",
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(148,163,184,.18)",
    cursor: "pointer",
  },

  tableCard: {
    borderRadius: 24,
    padding: 18,
    border: "1px solid rgba(148,163,184,.14)",
    background: "rgba(15,23,42,.84)",
    boxShadow: "0 14px 34px rgba(2,6,23,.14)",
    minWidth: 0,
  },

  tableTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 18,
  },

  pager: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  pageBtn: {
    height: 38,
    borderRadius: 12,
    padding: "0 14px",
    border: "1px solid rgba(148,163,184,.18)",
    background: "rgba(255,255,255,.04)",
    color: "#e2e8f0",
    fontWeight: 800,
    cursor: "pointer",
  },

  pageBadge: {
    minWidth: 38,
    height: 38,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: "rgba(99,102,241,.14)",
    color: "#c7d2fe",
    fontWeight: 900,
  },

  tableWrap: {
    width: "100%",
    overflowX: "auto",
    overflowY: "hidden",
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,.12)",
    background: "rgba(2,6,23,.24)",
  },

  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
  },

  th: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    textAlign: "left",
    padding: "16px 18px",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    color: "#94a3b8",
    background: "rgba(15,23,42,.98)",
    borderBottom: "1px solid rgba(148,163,184,.12)",
    whiteSpace: "nowrap",
  },

  thId: { width: "16%" },
  thTitle: { width: "32%" },
  thEndpoint: { width: "24%" },
  thType: { width: "10%" },
  thPriority: { width: "8%" },
  thReview: { width: "10%" },

  tr: {
    cursor: "pointer",
  },

  td: {
    padding: "16px 18px",
    borderBottom: "1px solid rgba(148,163,184,.08)",
    verticalAlign: "top",
    color: "#e2e8f0",
    background: "transparent",
  },

  idText: {
    fontSize: 13,
    fontWeight: 800,
    color: "#cbd5e1",
    wordBreak: "break-word",
  },

  titleText: {
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.5,
    color: "#f8fafc",
    marginBottom: 6,
  },

  subText: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "#64748b",
  },

  endpointWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  endpointText: {
    fontSize: 13,
    lineHeight: 1.5,
    color: "#cbd5e1",
    wordBreak: "break-word",
  },

  tag: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: ".02em",
    whiteSpace: "nowrap",
  },

  emptyTableCell: {
    padding: 28,
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 14,
  },

  emptyWrap: {
    width: "100%",
    display: "grid",
    placeItems: "center",
    padding: "32px 0",
  },

  emptyCard: {
    width: "100%",
    maxWidth: 760,
    borderRadius: 24,
    padding: 28,
    border: "1px solid rgba(148,163,184,.14)",
    background: "rgba(15,23,42,.84)",
    textAlign: "center",
  },

  emptyTitle: {
    fontSize: 24,
    fontWeight: 900,
    color: "#f8fafc",
    marginBottom: 10,
  },

  emptyText: {
    fontSize: 15,
    lineHeight: 1.6,
    color: "#94a3b8",
  },
};
