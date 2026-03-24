import React from "react";

function pretty(value) {
  return JSON.stringify(value ?? null, null, 2);
}

function reviewLabel(needsReview) {
  return needsReview ? "Yes" : "No";
}

function typeTone(type) {
  const value = String(type || "").toLowerCase();

  if (value === "contract") return { bg: "#eef2ff", color: "#4338ca" };
  if (value === "schema") return { bg: "#ecfeff", color: "#155e75" };
  if (value === "negative") return { bg: "#fff7ed", color: "#c2410c" };
  if (value === "auth") return { bg: "#fdf2f8", color: "#be185d" };

  return { bg: "#f1f5f9", color: "#334155" };
}

function methodTone(method) {
  const m = String(method || "").toUpperCase();

  if (m === "GET") return { bg: "#ecfdf5", color: "#166534" };
  if (m === "POST") return { bg: "#eef2ff", color: "#4338ca" };
  if (m === "PUT") return { bg: "#eff6ff", color: "#1d4ed8" };
  if (m === "PATCH") return { bg: "#fff7ed", color: "#c2410c" };
  if (m === "DELETE") return { bg: "#fef2f2", color: "#b91c1c" };

  return { bg: "#f1f5f9", color: "#334155" };
}

function endpointDisplay(row) {
  const method = row?.api_details?.method || "";
  const path = row?.api_details?.path || "";

  return {
    primary: `${method} ${path}`.trim() || "-",
    baseUrl: row?.api_details?.base_url || "-",
    fullResolved:
      row?.api_details?.full_url_resolved ||
      row?.api_details?.full_url_template ||
      path ||
      "-",
    path,
  };
}

function ReviewPill({ needsReview }) {
  return (
    <span
      style={{
        ...styles.pill,
        ...(needsReview ? styles.reviewPillWarn : styles.reviewPillOk),
      }}
    >
      {reviewLabel(needsReview)}
    </span>
  );
}

function InfoCard({ label, children, mono = false }) {
  return (
    <div style={styles.metaCard}>
      <div style={styles.metaLabel}>{label}</div>
      <div style={mono ? styles.mono : styles.metaValue}>{children}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </section>
  );
}

export default function TestCaseDrawer({ open, row, onClose }) {
  if (!open) return null;

  const testTypeTone = typeTone(row?.test_type);
  const httpTone = methodTone(row?.api_details?.method);
  const endpointInfo = endpointDisplay(row);
  const drawerTitle = row?.title;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.topRow}>
              <span
                style={{
                  ...styles.badge,
                  background: testTypeTone.bg,
                  color: testTypeTone.color,
                }}
              >
                {row?.test_type || "-"}
              </span>

              <span
                style={{
                  ...styles.badge,
                  background: httpTone.bg,
                  color: httpTone.color,
                }}
              >
                {row?.api_details?.method || "-"}
              </span>

              <ReviewPill needsReview={row?.needs_review} />
            </div>

            <div style={styles.title}>{drawerTitle || "Test Case"}</div>

            <div style={styles.sub}>{row?.id || "-"}</div>
          </div>

          <button style={styles.closeBtn} onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div style={styles.metaGrid}>
          <InfoCard label="Module">{row?.module || "-"}</InfoCard>
          <InfoCard label="Priority">{row?.priority || "-"}</InfoCard>
          <InfoCard label="Needs Review">
            {reviewLabel(row?.needs_review)}
          </InfoCard>
          <InfoCard label="Method">{row?.api_details?.method || "-"}</InfoCard>
        </div>
        <div style={styles.metaCardWide}>
          <div style={styles.metaLabel}>Why this test exists</div>
          <div style={styles.metaWideValue}>
            {row?.validation_focus?.[0] ||
              "Covers API behavior validation based on detected scenario"}
          </div>
        </div>

        <div style={styles.fullWidthCards}>
          <div style={styles.metaCardWide}>
            <div style={styles.metaLabel}>Endpoint</div>
            <div style={styles.endpointPrimary}>{endpointInfo.primary}</div>
          </div>

          <div style={styles.metaCardWide}>
            <div style={styles.metaLabel}>Full URL</div>
            <div style={styles.endpointBlock}>{endpointInfo.fullResolved}</div>
          </div>

          <div style={styles.metaCardWide}>
            <div style={styles.metaLabel}>Template Endpoint</div>
            <div style={styles.endpointBlock}>{endpointInfo.fullTemplate}</div>
          </div>

          <div style={styles.metaGrid}>
            <InfoCard label="Base URL" mono>
              {endpointInfo.baseUrl}
            </InfoCard>
            <InfoCard label="Path" mono>
              {endpointInfo.path}
            </InfoCard>
          </div>
        </div>

        <div style={styles.fullWidthCards}>
          <div style={styles.metaCardWide}>
            <div style={styles.metaLabel}>Objective</div>
            <div style={styles.metaWideValue}>{row?.objective || "-"}</div>
          </div>

          <div style={styles.metaCardWide}>
            <div style={styles.metaLabel}>Review Notes</div>
            <div style={styles.metaWideValue}>{row?.review_notes || "-"}</div>
          </div>
        </div>

        <Section title="Preconditions">
          {Array.isArray(row?.preconditions) && row.preconditions.length > 0 ? (
            <ul style={styles.list}>
              {row.preconditions.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          ) : (
            <div style={styles.empty}>No preconditions</div>
          )}
        </Section>

        <Section title="Test Data">
          <pre style={styles.code}>{pretty(row?.test_data || {})}</pre>
        </Section>

        <Section title="Steps">
          {Array.isArray(row?.steps) && row.steps.length > 0 ? (
            <ol style={styles.list}>
              {row.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          ) : (
            <div style={styles.empty}>No steps</div>
          )}
        </Section>

        <Section title="Expected Results">
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
        </Section>

        <Section title="Validation Focus">
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
        </Section>

        <Section title="References">
          {Array.isArray(row?.references) && row.references.length > 0 ? (
            <ul style={styles.list}>
              {row.references.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : (
            <div style={styles.empty}>No references</div>
          )}
        </Section>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.38)",
    display: "flex",
    justifyContent: "flex-end",
    zIndex: 60,
    backdropFilter: "blur(2px)",
  },

  drawer: {
    width: 720,
    maxWidth: "96vw",
    height: "100%",
    background: "#ffffff",
    padding: 20,
    borderLeft: "1px solid #e6eaf2",
    overflow: "auto",
    boxShadow: "-16px 0 40px rgba(15, 23, 42, 0.12)",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    paddingBottom: 16,
    marginBottom: 16,
    borderBottom: "1px solid #eef2f7",
  },

  headerLeft: {
    minWidth: 0,
  },

  topRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 10,
  },

  title: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1.2,
    marginBottom: 4,
    wordBreak: "break-word",
  },
  endpointPrimary: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    background: "#f1f5f9",
    border: "1px solid #dbe4f0",
    borderRadius: 12,
    padding: "10px 12px",
    lineHeight: 1.6,
    wordBreak: "break-all",
  },

  sub: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.45,
    wordBreak: "break-word",
  },

  closeBtn: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid #d6dce8",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    color: "#0f172a",
    flexShrink: 0,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  pill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  reviewPillWarn: {
    background: "#fff7d6",
    color: "#92400e",
    border: "1px solid #fde68a",
  },

  reviewPillOk: {
    background: "#ecfdf5",
    color: "#166534",
    border: "1px solid #bbf7d0",
  },

  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginTop: 4,
  },

  metaCard: {
    border: "1px solid #e6eaf2",
    borderRadius: 14,
    padding: 12,
    background: "#f8fafc",
    minWidth: 0,
  },

  metaCardWide: {
    border: "1px solid #e6eaf2",
    borderRadius: 14,
    padding: 12,
    background: "#f8fafc",
    minWidth: 0,
  },

  fullWidthCards: {
    display: "grid",
    gap: 12,
    marginTop: 12,
  },

  metaLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  metaValue: {
    fontSize: 14,
    color: "#0f172a",
    lineHeight: 1.45,
    wordBreak: "break-word",
  },

  metaWideValue: {
    fontSize: 14,
    color: "#0f172a",
    lineHeight: 1.55,
    wordBreak: "break-word",
  },

  endpointBlock: {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 12,
    color: "#0f172a",
    background: "#ffffff",
    border: "1px solid #dbe4f0",
    borderRadius: 12,
    padding: "10px 12px",
    lineHeight: 1.6,
    wordBreak: "break-all",
    overflowWrap: "anywhere",
  },

  section: {
    marginTop: 16,
    border: "1px solid #e6eaf2",
    borderRadius: 16,
    background: "#ffffff",
    padding: 14,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 10,
  },

  mono: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    color: "#334155",
    wordBreak: "break-all",
    lineHeight: 1.5,
  },

  list: {
    marginTop: 4,
    paddingLeft: 20,
    color: "#334155",
    lineHeight: 1.6,
  },

  empty: {
    fontSize: 13,
    color: "#64748b",
  },

  code: {
    background: "#0f172a",
    color: "#e2e8f0",
    padding: 12,
    borderRadius: 14,
    overflow: "auto",
    fontSize: 12,
    lineHeight: 1.55,
    margin: 0,
    border: "1px solid #1e293b",
  },
};
