import React from "react";

function StatCard({ label, value, accent }) {
  return (
    <div
      style={{
        ...styles.card,
        borderColor: accent || "#e6eaf2",
      }}
    >
      <div style={styles.label}>{label}</div>
      <div style={styles.value}>{value}</div>
    </div>
  );
}

export default function ResultsSummary({
  rows = [],
  report = null,
  testplan = null,
}) {
  const suiteCount = Array.isArray(testplan?.suites)
    ? testplan.suites.length
    : 0;

  const loadedEndpointCount = new Set(
    (rows || []).map(
      (r) => `${r.api_details?.method || ""} ${r.api_details?.path || ""}`,
    ),
  ).size;

  const generatedCasesCount =
    typeof report?.total_cases === "number" && report.total_cases > 0
      ? report.total_cases
      : rows.length;

  const endpointCount =
    typeof report?.endpoint_count === "number" && report.endpoint_count > 0
      ? report.endpoint_count
      : loadedEndpointCount;

  const reviewCount =
    typeof report?.needs_review === "number"
      ? report.needs_review
      : (rows || []).filter((r) => r.needs_review).length;

  return (
    <div style={styles.wrap}>
      <StatCard
        label="Generated cases"
        value={generatedCasesCount}
        accent="#c7d2fe"
      />
      <StatCard label="Suites" value={suiteCount} accent="#bfdbfe" />
      <StatCard
        label="Endpoints covered"
        value={endpointCount}
        accent="#bbf7d0"
      />
      <StatCard label="Needs review" value={reviewCount} accent="#fde68a" />
    </div>
  );
}

const styles = {
  wrap: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
  },
  card: {
    border: "1px solid #e6eaf2",
    borderRadius: 18,
    padding: 18,
    background: "#fff",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
  },
  label: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
  },
  value: {
    fontSize: 30,
    fontWeight: 800,
    color: "#0f172a",
  },
};
