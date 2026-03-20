import React from "react";

const TEST_TYPES = ["contract", "schema", "negative", "auth"];

function TogglePill({ checked, label, onChange }) {
  return (
    <label
      style={{
        ...styles.pill,
        ...(checked ? styles.pillChecked : {}),
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={styles.hiddenInput}
      />
      <span
        style={{
          ...styles.checkDot,
          ...(checked ? styles.checkDotChecked : {}),
        }}
      >
        {checked ? "✓" : ""}
      </span>
      <span style={styles.pillText}>{label}</span>
    </label>
  );
}

function RadioCard({ checked, title, help, onChange }) {
  return (
    <label
      style={{
        ...styles.radioCard,
        ...(checked ? styles.radioCardChecked : {}),
      }}
    >
      <input
        type="radio"
        name="generation_mode"
        checked={checked}
        onChange={onChange}
        style={styles.hiddenInput}
      />
      <span
        style={{
          ...styles.radioDot,
          ...(checked ? styles.radioDotChecked : {}),
        }}
      >
        <span style={styles.radioDotInner} />
      </span>

      <span style={styles.radioContent}>
        <span style={styles.radioTitle}>{title}</span>
        <span style={styles.radioHelp}>{help}</span>
      </span>
    </label>
  );
}

export default function GenerationOptions({ options, onChange }) {
  const safeOptions = {
    include: [],
    ai: false,
    env: "staging",
    auth_profile: "",
    generation_mode: "balanced",
    spec_source: "",
    guidance: "",
    ...(options || {}),
  };

  const safeOnChange = typeof onChange === "function" ? onChange : () => {};

  function toggleInclude(key) {
    const set = new Set(safeOptions.include || []);
    if (set.has(key)) set.delete(key);
    else set.add(key);

    safeOnChange({
      ...safeOptions,
      include: Array.from(set),
    });
  }

  function selectRecommended() {
    safeOnChange({
      ...safeOptions,
      include: ["contract", "schema"],
      generation_mode: "balanced",
    });
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.heroNote}>
        Configure the default generation profile for this project. These
        settings will be reused when you open Generate Tests.
      </div>

      <section style={styles.sectionCard}>
        <div style={styles.sectionHead}>
          <div>
            <div style={styles.sectionEyebrow}>Coverage</div>
            <div style={styles.sectionTitle}>Test Types</div>
          </div>
        </div>

        <div style={styles.pillGrid}>
          {TEST_TYPES.map((k) => (
            <TogglePill
              key={k}
              label={k}
              checked={(safeOptions.include || []).includes(k)}
              onChange={() => toggleInclude(k)}
            />
          ))}
        </div>

        <div style={styles.inlineRow}>
          <label style={styles.aiToggle}>
            <input
              type="checkbox"
              checked={!!safeOptions.ai}
              onChange={(e) =>
                safeOnChange({
                  ...safeOptions,
                  ai: e.target.checked,
                })
              }
            />
            <span>Use AI enrichment</span>
          </label>

          <button
            type="button"
            onClick={selectRecommended}
            style={styles.smallBtn}
          >
            Use Recommended
          </button>
        </div>

        <div style={styles.help}>
          Best starting point for manual QA: contract + schema with balanced
          generation.
        </div>
      </section>

      <section style={styles.sectionCard}>
        <div style={styles.sectionHead}>
          <div>
            <div style={styles.sectionEyebrow}>Runtime</div>
            <div style={styles.sectionTitle}>Execution Defaults</div>
          </div>
        </div>

        <div style={styles.fieldStack}>
          <div>
            <div style={styles.label}>Environment</div>
            <input
              value={safeOptions.env || ""}
              onChange={(e) =>
                safeOnChange({
                  ...safeOptions,
                  env: e.target.value,
                })
              }
              placeholder="staging"
              style={styles.input}
            />
          </div>

          <div>
            <div style={styles.label}>Auth Profile</div>
            <input
              value={safeOptions.auth_profile || ""}
              onChange={(e) =>
                safeOnChange({
                  ...safeOptions,
                  auth_profile: e.target.value,
                })
              }
              placeholder="device"
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.modeHeaderRow}>
          <div style={styles.label}>Generation Mode</div>
        </div>

        <div style={styles.modeRow}>
          <RadioCard
            checked={(safeOptions.generation_mode || "balanced") === "balanced"}
            title="Balanced"
            help="Covers ready and partially complete endpoints for practical QA output."
            onChange={() =>
              safeOnChange({
                ...safeOptions,
                generation_mode: "balanced",
              })
            }
          />

          <RadioCard
            checked={safeOptions.generation_mode === "strict"}
            title="Strict"
            help="Restricts generation to endpoints with stronger spec coverage."
            onChange={() =>
              safeOnChange({
                ...safeOptions,
                generation_mode: "strict",
              })
            }
          />
        </div>
      </section>

      <section style={styles.sectionCard}>
        <div style={styles.sectionHead}>
          <div>
            <div style={styles.sectionEyebrow}>Specification</div>
            <div style={styles.sectionTitle}>Spec Source</div>
          </div>
        </div>

        <div style={styles.label}>Swagger / OpenAPI URL</div>
        <input
          value={safeOptions.spec_source || ""}
          onChange={(e) =>
            safeOnChange({
              ...safeOptions,
              spec_source: e.target.value,
            })
          }
          placeholder="https://app.example.com/openapi.json"
          style={styles.input}
        />
      </section>

      <section style={styles.sectionCard}>
        <div style={styles.sectionHead}>
          <div>
            <div style={styles.sectionEyebrow}>Instructions</div>
            <div style={styles.sectionTitle}>Additional Guidance</div>
          </div>
        </div>

        <div style={styles.label}>Optional notes for generation</div>
        <textarea
          value={safeOptions.guidance || ""}
          onChange={(e) =>
            safeOnChange({
              ...safeOptions,
              guidance: e.target.value,
            })
          }
          placeholder="Focus on contract and schema validation. Keep steps clear for manual testers."
          style={styles.textarea}
        />
      </section>
    </div>
  );
}

const styles = {
  wrap: {
    display: "grid",
    gap: 16,
    width: "100%",
    minWidth: 0,
  },

  heroNote: {
    padding: "14px 16px",
    borderRadius: 16,
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(59,130,246,0.06))",
    border: "1px solid rgba(99,102,241,0.14)",
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.55,
  },

  sectionCard: {
    display: "grid",
    gap: 14,
    border: "1px solid #e8eef6",
    borderRadius: 20,
    background: "linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%)",
    padding: 18,
    minWidth: 0,
    width: "100%",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  },

  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  sectionEyebrow: {
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#6366f1",
    marginBottom: 6,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
  },

  label: {
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
    marginBottom: 6,
  },

  pillGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  pill: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid #dbe3f0",
    background: "#fff",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 700,
    color: "#334155",
    minWidth: 0,
    width: "100%",
  },

  pillChecked: {
    borderColor: "#c7d2fe",
    background: "linear-gradient(135deg, #eef2ff, #f5f3ff)",
    color: "#3730a3",
    boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.08)",
  },

  pillText: {
    flex: 1,
    minWidth: 0,
    whiteSpace: "normal",
    overflowWrap: "break-word",
    wordBreak: "break-word",
    lineHeight: 1.2,
  },

  hiddenInput: {
    position: "absolute",
    opacity: 0,
    pointerEvents: "none",
    width: 0,
    height: 0,
  },

  checkDot: {
    width: 22,
    height: 22,
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    color: "transparent",
    background: "#fff",
    flexShrink: 0,
  },

  checkDotChecked: {
    background: "#4f46e5",
    borderColor: "#4f46e5",
    color: "#fff",
  },

  inlineRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },

  aiToggle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    color: "#334155",
    fontWeight: 600,
    flexWrap: "wrap",
  },

  smallBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid #d6dce8",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    color: "#0f172a",
    width: "auto",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.04)",
  },

  help: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.6,
  },

  fieldStack: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid #dbe3f0",
    background: "#fff",
    fontSize: 15,
    boxSizing: "border-box",
    color: "#0f172a",
    outline: "none",
  },

  textarea: {
    width: "100%",
    minHeight: 96,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid #dbe3f0",
    background: "#fff",
    fontSize: 14,
    lineHeight: 1.5,
    resize: "vertical",
    boxSizing: "border-box",
    color: "#0f172a",
    outline: "none",
  },

  modeHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  modeRow: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
    width: "100%",
  },

  radioCard: {
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr)",
    alignItems: "start",
    columnGap: 12,
    padding: "14px",
    borderRadius: 14,
    border: "1px solid #dbe3f0",
    background: "#fff",
    cursor: "pointer",
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
  },

  radioCardChecked: {
    borderColor: "#c7d2fe",
    background: "linear-gradient(135deg, #eef2ff, #f8faff)",
    boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.08)",
  },

  radioDot: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "2px solid #94a3b8",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
    background: "#fff",
  },

  radioDotChecked: {
    borderColor: "#2563eb",
  },

  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#2563eb",
  },

  radioContent: {
    display: "grid",
    gap: 4,
    minWidth: 0,
    width: "100%",
  },

  radioTitle: {
    display: "block",
    fontSize: 15,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.3,
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "break-word",
  },

  radioHelp: {
    display: "block",
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.5,
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "break-word",
  },
};
