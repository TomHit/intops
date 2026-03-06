import React from "react";

function pretty(value) {
  return JSON.stringify(value ?? null, null, 2);
}

function reviewLabel(needsReview) {
  return needsReview ? "Yes" : "No";
}

export default function TestCaseDrawer({ open, row, onClose }) {
  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>{row?.id || "Test Case"}</div>
            <div style={styles.sub}>{row?.title || ""}</div>
          </div>
          <button style={styles.btn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.metaGrid}>
          <div style={styles.metaCard}>
            <div style={styles.metaLabel}>Module</div>
            <div>{row?.module || "-"}</div>
          </div>

          <div style={styles.metaCard}>
            <div style={styles.metaLabel}>Type</div>
            <div>{row?.test_type || "-"}</div>
          </div>

          <div style={styles.metaCard}>
            <div style={styles.metaLabel}>Priority</div>
            <div>{row?.priority || "-"}</div>
          </div>

          <div style={styles.metaCard}>
            <div style={styles.metaLabel}>Method</div>
            <div>{row?.api_details?.method || "-"}</div>
          </div>

          <div style={styles.metaCard}>
            <div style={styles.metaLabel}>Path</div>
            <div style={styles.mono}>{row?.api_details?.path || "-"}</div>
          </div>

          <div style={styles.metaCard}>
            <div style={styles.metaLabel}>Needs Review</div>
            <div>{reviewLabel(row?.needs_review)}</div>
          </div>

          <div style={styles.metaCardFull}>
            <div style={styles.metaLabel}>Objective</div>
            <div>{row?.objective || "-"}</div>
          </div>

          <div style={styles.metaCardFull}>
            <div style={styles.metaLabel}>Review Notes</div>
            <div>{row?.review_notes || "-"}</div>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.h}>Preconditions</div>
          {Array.isArray(row?.preconditions) && row.preconditions.length > 0 ? (
            <ul style={styles.list}>
              {row.preconditions.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          ) : (
            <div style={styles.empty}>No preconditions</div>
          )}
        </div>

        <div style={styles.section}>
          <div style={styles.h}>Test Data</div>
          <pre style={styles.code}>{pretty(row?.test_data || {})}</pre>
        </div>

        <div style={styles.section}>
          <div style={styles.h}>Steps</div>
          {Array.isArray(row?.steps) && row.steps.length > 0 ? (
            <ol style={styles.list}>
              {row.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          ) : (
            <div style={styles.empty}>No steps</div>
          )}
        </div>

        <div style={styles.section}>
          <div style={styles.h}>Expected Results</div>
          {Array.isArray(row?.expected_results) &&
          row.expected_results.length > 0 ? (
            <ul style={styles.list}>
              {row.expected_results.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : (
            <div style={styles.empty}>No expected results</div>
          )}
        </div>

        <div style={styles.section}>
          <div style={styles.h}>Validation Focus</div>
          {Array.isArray(row?.validation_focus) &&
          row.validation_focus.length > 0 ? (
            <ul style={styles.list}>
              {row.validation_focus.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          ) : (
            <div style={styles.empty}>No validation focus</div>
          )}
        </div>

        <div style={styles.section}>
          <div style={styles.h}>References</div>
          {Array.isArray(row?.references) && row.references.length > 0 ? (
            <ul style={styles.list}>
              {row.references.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : (
            <div style={styles.empty}>No references</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    justifyContent: "flex-end",
    zIndex: 50,
  },
  drawer: {
    width: 680,
    maxWidth: "95vw",
    height: "100%",
    background: "#fff",
    padding: 16,
    borderLeft: "1px solid #eee",
    overflow: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },
  title: { fontSize: 16, fontWeight: 900 },
  sub: { fontSize: 13, opacity: 0.75, marginTop: 2 },
  btn: {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#fff",
    cursor: "pointer",
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    marginTop: 14,
  },
  metaCard: {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 10,
    background: "#fafafa",
  },
  metaCardFull: {
    gridColumn: "1 / -1",
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 10,
    background: "#fafafa",
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.7,
    marginBottom: 4,
  },
  section: { marginTop: 14 },
  h: { fontWeight: 900, marginBottom: 6 },
  mono: {
    fontFamily: "ui-monospace, Menlo, monospace",
    fontSize: 12,
    opacity: 0.85,
    wordBreak: "break-all",
  },
  list: { marginTop: 6, paddingLeft: 18 },
  empty: {
    fontSize: 13,
    opacity: 0.7,
  },
  code: {
    background: "#0b1020",
    color: "#e5e7eb",
    padding: 10,
    borderRadius: 12,
    overflow: "auto",
    fontSize: 12,
  },
};
