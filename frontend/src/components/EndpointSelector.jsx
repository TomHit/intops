import React, { useMemo, useState } from "react";

function uniqueTags(endpoints) {
  const s = new Set();
  for (const e of endpoints || []) {
    (e.tags || []).forEach((t) => s.add(t));
  }
  return ["ALL", ...Array.from(s).sort()];
}

function methodTone(method) {
  const m = String(method || "").toUpperCase();

  if (m === "GET") return { color: "#16a34a" };
  if (m === "POST") return { color: "#ea580c" };
  if (m === "PUT") return { color: "#2563eb" };
  if (m === "PATCH") return { color: "#7c3aed" };
  if (m === "DELETE") return { color: "#dc2626" };

  return { color: "#475569" };
}

function groupEndpoints(endpoints) {
  const groups = new Map();

  for (const e of endpoints || []) {
    const tag = (e.tags && e.tags[0]) || "untagged";
    if (!groups.has(tag)) groups.set(tag, []);
    groups.get(tag).push(e);
  }

  return Array.from(groups.entries())
    .map(([tag, items]) => ({
      tag,
      items: items.sort((a, b) => {
        const am = String(a.method || "");
        const bm = String(b.method || "");
        const ap = String(a.path || "");
        const bp = String(b.path || "");
        return `${am} ${ap}`.localeCompare(`${bm} ${bp}`);
      }),
    }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

function SmallIconSearch() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M13.5 12.3l3.6 3.6-1.2 1.2-3.6-3.6a6 6 0 111.2-1.2zM8.5 13a4.5 4.5 0 100-9 4.5 4.5 0 000 9z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function EndpointSelector({ endpoints, selection, onChange }) {
  const tags = useMemo(() => uniqueTags(endpoints), [endpoints]);

  const filtered = useMemo(() => {
    const q = (selection?.filter?.q || "").toLowerCase().trim();
    const method = selection?.filter?.method || "ALL";
    const authOnly = !!selection?.filter?.authOnly;
    const tag = selection?.filter?.tag || "ALL";

    return (endpoints || []).filter((e) => {
      const haystack =
        `${e.method || ""} ${e.path || ""} ${e.summary || ""} ${(e.tags || []).join(" ")}`.toLowerCase();

      const matchQ = !q || haystack.includes(q);
      const matchMethod = method === "ALL" ? true : e.method === method;
      const matchAuth = authOnly ? !!e.requires_auth : true;
      const matchTag = tag === "ALL" ? true : (e.tags || []).includes(tag);

      return matchQ && matchMethod && matchAuth && matchTag;
    });
  }, [endpoints, selection]);

  const grouped = useMemo(() => groupEndpoints(filtered), [filtered]);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  function toggle(id) {
    const sel = new Set(selection.selected_endpoint_ids || []);
    if (sel.has(id)) sel.delete(id);
    else sel.add(id);
    onChange({ ...selection, selected_endpoint_ids: Array.from(sel) });
  }

  function setFilter(patch) {
    onChange({ ...selection, filter: { ...selection.filter, ...patch } });
  }

  function selectAllVisible() {
    const sel = new Set(selection.selected_endpoint_ids || []);
    filtered.forEach((e) => sel.add(e.id));
    onChange({ ...selection, selected_endpoint_ids: Array.from(sel) });
  }

  function clearAll() {
    onChange({ ...selection, selected_endpoint_ids: [] });
  }

  function toggleGroup(tag) {
    setCollapsedGroups((prev) => ({
      ...prev,
      [tag]: !prev[tag],
    }));
  }

  function toggleGroupSelection(items) {
    const sel = new Set(selection.selected_endpoint_ids || []);
    const ids = items.map((e) => e.id);
    const allSelected = ids.every((id) => sel.has(id));

    if (allSelected) {
      ids.forEach((id) => sel.delete(id));
    } else {
      ids.forEach((id) => sel.add(id));
    }

    onChange({ ...selection, selected_endpoint_ids: Array.from(sel) });
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.toolbarCard}>
        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}>
            <SmallIconSearch />
          </span>
          <input
            style={styles.searchInput}
            placeholder="Search endpoints..."
            value={selection.filter.q}
            onChange={(e) => setFilter({ q: e.target.value })}
          />
        </div>

        <div style={styles.compactToolbar}>
          <select
            style={styles.select}
            value={selection.filter.method}
            onChange={(e) => setFilter({ method: e.target.value })}
          >
            <option value="ALL">All methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>

          <select
            style={styles.select}
            value={selection.filter.tag}
            onChange={(e) => setFilter({ tag: e.target.value })}
          >
            <option value="ALL">All endpoints</option>
            {tags
              .filter((t) => t !== "ALL")
              .map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
          </select>
        </div>

        <div style={styles.toolbarBottom}>
          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={!!selection.filter.authOnly}
              onChange={(e) => setFilter({ authOnly: e.target.checked })}
            />
            <span>Auth only</span>
          </label>

          <div style={styles.inlineBtns}>
            <button type="button" style={styles.btn} onClick={selectAllVisible}>
              Select visible
            </button>
            <button type="button" style={styles.btn} onClick={clearAll}>
              Clear
            </button>
          </div>
        </div>
      </div>

      <div style={styles.treeShell}>
        <div style={styles.treeHeader}>
          <div style={styles.treeHeaderTitle}>All endpoints</div>
          <div style={styles.treeHeaderMeta}>
            {filtered.length} visible / {endpoints.length} total
          </div>
        </div>

        <div style={styles.treeScroll}>
          {grouped.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyTitle}>No endpoints found</div>
              <div style={styles.emptySubtle}>
                Try changing the search text or filters.
              </div>
            </div>
          )}

          {grouped.map((group) => {
            const isCollapsed = !!collapsedGroups[group.tag];
            const ids = group.items.map((e) => e.id);
            const selectedInGroup = ids.filter((id) =>
              (selection.selected_endpoint_ids || []).includes(id),
            ).length;
            const allSelected =
              group.items.length > 0 && selectedInGroup === group.items.length;

            return (
              <div key={group.tag} style={styles.groupBlock}>
                <div style={styles.groupHeader}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.tag)}
                    style={styles.groupToggle}
                  >
                    <span style={styles.chevron}>
                      {isCollapsed ? "›" : "⌄"}
                    </span>
                    <span style={styles.folderIcon}>📁</span>
                    <span style={styles.groupTitle}>{group.tag}</span>
                    <span style={styles.groupCount}>
                      ({group.items.length})
                    </span>
                  </button>

                  <button
                    type="button"
                    style={{
                      ...styles.groupSelectBtn,
                      ...(allSelected ? styles.groupSelectBtnActive : {}),
                    }}
                    onClick={() => toggleGroupSelection(group.items)}
                  >
                    {allSelected ? "Unselect" : "Select"}
                  </button>
                </div>

                {!isCollapsed && (
                  <div style={styles.endpointList}>
                    {group.items.map((e) => {
                      const checked = (
                        selection.selected_endpoint_ids || []
                      ).includes(e.id);
                      const tone = methodTone(e.method);

                      return (
                        <label
                          key={e.id}
                          style={{
                            ...styles.endpointRow,
                            ...(checked ? styles.endpointRowChecked : {}),
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(e.id)}
                            style={styles.checkbox}
                          />

                          <span
                            style={{
                              ...styles.methodText,
                              color: tone.color,
                            }}
                          >
                            {String(e.method || "").toUpperCase()}
                          </span>

                          <div style={styles.endpointContent}>
                            <div style={styles.endpointTitleRow}>
                              <span style={styles.endpointName}>
                                {e.summary || e.path}
                              </span>
                              {e.requires_auth && (
                                <span style={styles.authBadge}>auth</span>
                              )}
                            </div>

                            <div style={styles.endpointPath}>{e.path}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={styles.footer}>
        <span>
          Selected:{" "}
          <strong>{(selection.selected_endpoint_ids || []).length}</strong>
        </span>
        <span>
          Visible: <strong>{filtered.length}</strong>
        </span>
        <span>
          Total: <strong>{endpoints.length}</strong>
        </span>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    display: "grid",
    gap: 12,
    minWidth: 0,
    width: "100%",
    height: "100%",
  },

  toolbarCard: {
    display: "grid",
    gap: 10,
    padding: 12,
    border: "1px solid #e7edf5",
    borderRadius: 16,
    background: "#ffffff",
    flexShrink: 0,
  },

  searchWrap: {
    position: "relative",
    width: "100%",
  },

  searchIcon: {
    position: "absolute",
    left: 12,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#64748b",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },

  searchInput: {
    padding: "11px 12px 11px 36px",
    borderRadius: 14,
    border: "1px solid #dbe3f0",
    width: "100%",
    boxSizing: "border-box",
    background: "#fff",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
  },

  compactToolbar: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },

  select: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #dbe3f0",
    background: "#fff",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
  },

  toolbarBottom: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },

  checkboxRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 13,
    color: "#334155",
    fontWeight: 600,
  },

  inlineBtns: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  btn: {
    padding: "8px 10px",
    border: "1px solid #d6dce8",
    borderRadius: 10,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    color: "#0f172a",
    whiteSpace: "nowrap",
    fontSize: 12,
  },

  treeShell: {
    border: "1px solid #e7edf5",
    borderRadius: 16,
    background: "#fcfdff",
    minHeight: 320,
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    overflow: "hidden",
  },

  treeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderBottom: "1px solid #edf2f7",
    background: "#ffffff",
  },

  treeHeaderTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
  },

  treeHeaderMeta: {
    fontSize: 12,
    color: "#64748b",
    whiteSpace: "nowrap",
  },

  treeScroll: {
    overflow: "auto",
    padding: 8,
    minHeight: 0,
  },

  groupBlock: {
    display: "grid",
    gap: 4,
    marginBottom: 6,
  },

  groupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "2px 2px 2px 0",
  },

  groupToggle: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "6px 6px",
    color: "#334155",
    fontWeight: 700,
    fontSize: 14,
    textAlign: "left",
    minWidth: 0,
  },

  chevron: {
    width: 12,
    color: "#64748b",
    flexShrink: 0,
    fontSize: 18,
    lineHeight: 1,
  },

  folderIcon: {
    fontSize: 14,
    lineHeight: 1,
    flexShrink: 0,
  },

  groupTitle: {
    color: "#334155",
    fontWeight: 700,
  },

  groupCount: {
    color: "#64748b",
    fontWeight: 600,
  },

  groupSelectBtn: {
    padding: "5px 9px",
    border: "1px solid #d6dce8",
    borderRadius: 10,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    color: "#334155",
    whiteSpace: "nowrap",
    fontSize: 12,
  },

  groupSelectBtnActive: {
    background: "#eef2ff",
    borderColor: "#c7d2fe",
    color: "#3730a3",
  },

  endpointList: {
    display: "grid",
    gap: 2,
    paddingLeft: 18,
  },

  endpointRow: {
    display: "grid",
    gridTemplateColumns: "16px 46px minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    padding: "8px 8px",
    borderRadius: 12,
    cursor: "pointer",
    border: "1px solid transparent",
    minWidth: 0,
  },

  endpointRowChecked: {
    background: "#f5f8ff",
    borderColor: "#dbe7ff",
  },

  checkbox: {
    marginTop: 3,
    width: 14,
    height: 14,
  },

  methodText: {
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    letterSpacing: 0.2,
    paddingTop: 1,
  },

  endpointContent: {
    minWidth: 0,
    display: "grid",
    gap: 3,
  },

  endpointTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    flexWrap: "wrap",
  },

  endpointName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  authBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: "#9a3412",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 999,
    padding: "2px 6px",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  endpointPath: {
    fontSize: 12,
    color: "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  footer: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },

  emptyState: {
    padding: 20,
    borderRadius: 12,
    textAlign: "center",
    color: "#64748b",
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 6,
  },

  emptySubtle: {
    fontSize: 13,
    color: "#64748b",
  },
};
