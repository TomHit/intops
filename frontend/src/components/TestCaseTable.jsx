import React from "react";
import { TEST_CASE_COLUMNS } from "../utils/testCaseColumns";

function reviewBadge(needsReview) {
  if (needsReview) {
    return { text: "⚠️ Review", bg: "#fff7d6", border: "#ffe08a" };
  }
  return { text: "✅ No", bg: "#eaffea", border: "#b8f0b8" };
}

function shortText(value, max = 80) {
  const s = String(value ?? "");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export default function TestCaseTable({ rows, onRowClick }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.table}>
        <div
          style={{
            ...styles.head,
            gridTemplateColumns: `220px 2fr 1.2fr 100px 90px 90px 180px 180px 70px 110px 120px 130px 180px`,
          }}
        >
          {TEST_CASE_COLUMNS.map((col) => (
            <div key={col.key}>{col.label}</div>
          ))}
        </div>

        {(rows || []).map((r) => {
          const b = reviewBadge(r.needs_review);

          return (
            <div
              key={`${r.suite_id}-${r.id}`}
              style={{
                ...styles.row,
                gridTemplateColumns: `220px 2fr 1.2fr 100px 90px 90px 180px 180px 70px 110px 120px 130px 180px`,
              }}
              onClick={() => onRowClick?.(r)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onRowClick?.(r);
              }}
            >
              {TEST_CASE_COLUMNS.map((col) => {
                if (col.key === "needs_review") {
                  return (
                    <div key={col.key}>
                      <span
                        style={{
                          ...styles.badge,
                          background: b.bg,
                          borderColor: b.border,
                        }}
                      >
                        {b.text}
                      </span>
                    </div>
                  );
                }

                const value = col.getValue(r);
                return (
                  <div
                    key={col.key}
                    title={String(value ?? "")}
                    style={
                      col.key === "id" || col.key === "path"
                        ? styles.mono
                        : undefined
                    }
                  >
                    {shortText(value, 70)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {(!rows || rows.length === 0) && (
        <div style={styles.empty}>
          No test cases yet. Generate to see results.
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { width: "100%" },
  table: {
    border: "1px solid #eee",
    borderRadius: 12,
    overflow: "auto",
  },
  head: {
    display: "grid",
    gap: 8,
    padding: "10px 12px",
    background: "#f6f6f6",
    fontWeight: 800,
    fontSize: 12,
    minWidth: 2200,
  },
  row: {
    display: "grid",
    gap: 8,
    padding: "10px 12px",
    borderTop: "1px solid #eee",
    cursor: "pointer",
    alignItems: "center",
    fontSize: 13,
    minWidth: 2200,
  },
  mono: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
  },
  badge: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 999,
    border: "1px solid #ddd",
    fontSize: 12,
  },
  empty: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    background: "#f6f6f6",
  },
};
