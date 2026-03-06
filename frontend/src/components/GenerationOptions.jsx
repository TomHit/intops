import React from "react";

const TEST_TYPES = ["contract", "schema", "negative", "auth"];

export default function GenerationOptions({ options, onChange }) {
  function toggleInclude(key) {
    const set = new Set(options.include || []);
    if (set.has(key)) set.delete(key);
    else set.add(key);

    onChange({ ...options, include: Array.from(set) });
  }

  function selectRecommended() {
    onChange({
      ...options,
      include: ["contract", "schema"],
    });
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div>
        <div style={styles.label}>Test Types</div>

        <div style={styles.row}>
          {TEST_TYPES.map((k) => (
            <label key={k} style={styles.chk}>
              <input
                type="checkbox"
                checked={(options.include || []).includes(k)}
                onChange={() => toggleInclude(k)}
              />
              {k}
            </label>
          ))}

          <label style={{ ...styles.chk, marginLeft: 16 }}>
            <input
              type="checkbox"
              checked={!!options.ai}
              onChange={(e) => onChange({ ...options, ai: e.target.checked })}
            />
            Use AI (enrich)
          </label>
        </div>

        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            style={styles.smallBtn}
            onClick={selectRecommended}
          >
            Use Recommended (contract + schema)
          </button>
        </div>

        <div style={styles.help}>
          Recommended for Manual QA: contract + schema
        </div>
      </div>

      <div style={styles.twoCol}>
        <div>
          <div style={styles.label}>Environment</div>
          <input
            style={styles.input}
            value={options.env}
            onChange={(e) => onChange({ ...options, env: e.target.value })}
            placeholder="staging"
          />
        </div>

        <div>
          <div style={styles.label}>Auth Profile</div>
          <input
            style={styles.input}
            value={options.auth_profile}
            onChange={(e) =>
              onChange({ ...options, auth_profile: e.target.value })
            }
            placeholder="device"
          />
        </div>
      </div>

      <div style={styles.row}>
        <div style={{ flex: 1 }}>
          <div style={styles.label}>Spec Source (Swagger / OpenAPI URL)</div>
          <input
            style={styles.input}
            type="text"
            value={options.spec_source || ""}
            onChange={(e) =>
              onChange({ ...options, spec_source: e.target.value })
            }
            placeholder="https://app.example.com/openapi.json"
          />
        </div>
      </div>

      <div>
        <div style={styles.label}>Additional Guidance (optional)</div>
        <textarea
          style={styles.textarea}
          value={options.guidance}
          onChange={(e) => onChange({ ...options, guidance: e.target.value })}
          placeholder="Focus on contract and schema validation. Make test cases clear for manual testers."
        />
      </div>
    </div>
  );
}

const styles = {
  label: { fontSize: 12, fontWeight: 800, marginBottom: 6, opacity: 0.85 },
  row: { display: "flex", gap: 14, flexWrap: "wrap" },
  chk: { display: "flex", gap: 6, alignItems: "center", fontSize: 13 },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  input: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #ddd",
    width: "100%",
  },
  textarea: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #ddd",
    width: "100%",
    minHeight: 70,
  },
  smallBtn: {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid #ccc",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
  },
  help: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.7,
  },
};
