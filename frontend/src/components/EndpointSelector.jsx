import React, { useEffect, useMemo, useState } from "react";

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

export default function EndpointSelector({ endpoints, selection, onChange }) {
  const [visibleCount, setVisibleCount] = useState(120);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const tags = useMemo(() => uniqueTags(endpoints), [endpoints]);

  const allFiltered = useMemo(() => {
    const q = (selection?.filter?.q || "").toLowerCase().trim();
    const method = selection?.filter?.method || "ALL";
    const authOnly = !!selection?.filter?.authOnly;
    const tag = selection?.filter?.tag || "ALL";

    return (endpoints || []).filter((e) => {
      const haystack =
        `${e.method || ""} ${e.path || ""} ${e.summary || ""} ${(e.tags || []).join(" ")}`.toLowerCase();

      const matchQ = !q || haystack.includes(q);
      const matchMethod = method === "ALL" ? true : e.method === method;
      const matchAuth = authOnly
        ? Array.isArray(e.security) && e.security.length > 0
        : true;
      const matchTag = tag === "ALL" ? true : (e.tags || []).includes(tag);

      return matchQ && matchMethod && matchAuth && matchTag;
    });
  }, [endpoints, selection]);

  const filtered = useMemo(() => {
    return allFiltered.slice(0, visibleCount);
  }, [allFiltered, visibleCount]);

  const grouped = useMemo(() => groupEndpoints(filtered), [filtered]);

  useEffect(() => {
    setVisibleCount(120);
  }, [
    selection?.filter?.q,
    selection?.filter?.method,
    selection?.filter?.tag,
    selection?.filter?.authOnly,
  ]);

  useEffect(() => {
    setCollapsedGroups((prev) => {
      const merged = { ...prev };
      for (const group of grouped) {
        if (!(group.tag in merged)) {
          merged[group.tag] = false;
        }
      }
      return merged;
    });
  }, [grouped]);

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

  const selectedIds = selection.selected_endpoint_ids || [];

  return (
    <div style={styles.wrap}>
      <div style={styles.topBar}>
        <div style={styles.topMeta}>
          <div style={styles.treeHeaderTitle}>Endpoints</div>
          <div style={styles.treeHeaderMeta}>
            {filtered.length} visible / {allFiltered.length} matched /{" "}
            {endpoints.length} total
          </div>
        </div>

        <div style={styles.topActions}>
          <input
            style={styles.searchInput}
            placeholder="Filter endpoints"
            value={selection.filter.q || ""}
            onChange={(e) => setFilter({ q: e.target.value })}
          />

          <select
            style={styles.selectCompact}
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
            style={styles.selectCompact}
            value={selection.filter.tag}
            onChange={(e) => setFilter({ tag: e.target.value })}
          >
            <option value="ALL">All groups</option>
            {tags
              .filter((t) => t !== "ALL")
              .map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div style={styles.toolbarInline}>
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

      <div style={styles.treeShell}>
        <div style={styles.treeScroll}>
          {grouped.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyTitle}>No endpoints found</div>
              <div style={styles.emptySubtle}>
                Try changing the search or filters.
              </div>
            </div>
          )}

          {grouped.map((group) => {
            const isCollapsed = !!collapsedGroups[group.tag];
            const ids = group.items.map((e) => e.id);
            const selectedInGroup = ids.filter((id) =>
              selectedIds.includes(id),
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
                      const checked = selectedIds.includes(e.id);
                      const tone = methodTone(e.method);
                      const hasAuth =
                        Array.isArray(e.security) && e.security.length > 0;

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
                            <div style={styles.endpointTopLine}>
                              <span style={styles.endpointName}>
                                {e.summary || e.path}
                              </span>
                              {hasAuth && (
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

      {allFiltered.length > visibleCount && (
        <div style={styles.moreWrap}>
          <button
            type="button"
            style={styles.btn}
            onClick={() => setVisibleCount((n) => n + 150)}
          >
            Show more
          </button>
          <span style={styles.moreMeta}>
            Showing {filtered.length} of {allFiltered.length} matched endpoints
          </span>
        </div>
      )}

      <div style={styles.footer}>
        <span>
          Selected: <strong>{selectedIds.length}</strong>
        </span>
        <span>
          Visible: <strong>{filtered.length}</strong>
        </span>
        <span>
          Matched: <strong>{allFiltered.length}</strong>
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
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
    width: "100%",
    height: "100%",
    minHeight: 0,
  },

  topBar: {
    display: "grid",
    gap: 4,
    padding: "0 2px 0",
  },

  topMeta: {
    display: "grid",
    gap: 0,
  },

  topActions: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) 0.8fr 0.8fr",
    gap: 6,
    alignItems: "center",
  },

  treeHeaderTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.05,
  },

  treeHeaderMeta: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.05,
  },

  searchInput: {
    width: "100%",
    minHeight: 32,
    height: 32,
    padding: "5px 9px",
    border: "1px solid #dbe3f0",
    borderRadius: 8,
    background: "#fff",
    fontSize: 12,
    color: "#0f172a",
    outline: "none",
  },

  selectCompact: {
    width: "100%",
    minHeight: 32,
    height: 32,
    padding: "5px 9px",
    borderRadius: 8,
    border: "1px solid #dbe3f0",
    background: "#fff",
    fontSize: 12,
    color: "#0f172a",
    outline: "none",
  },

  toolbarInline: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
    padding: "0 2px 2px",
  },

  checkboxRow: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    fontSize: 11,
    color: "#475569",
    fontWeight: 600,
  },

  inlineBtns: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },

  btn: {
    padding: "4px 8px",
    border: "1px solid #d6dce8",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    color: "#0f172a",
    whiteSpace: "nowrap",
    fontSize: 11,
    lineHeight: 1.1,
  },

  treeShell: {
    border: "1px solid #e7edf5",
    borderRadius: 12,
    background: "#ffffff",
    minHeight: 0,
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },

  treeScroll: {
    overflowY: "auto",
  },

  groupBlock: {
    display: "grid",
    gap: 1,
    marginBottom: 1,
  },

  groupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    padding: "1px 0",
    minHeight: 26,
  },

  groupToggle: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "4px 4px",
    color: "#334155",
    fontWeight: 700,
    fontSize: 12,
    textAlign: "left",
    minWidth: 0,
    lineHeight: 1.05,
  },

  chevron: {
    width: 10,
    color: "#64748b",
    flexShrink: 0,
    fontSize: 15,
    lineHeight: 1,
  },

  folderIcon: {
    fontSize: 13,
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
    padding: "3px 7px",
    border: "1px solid #d6dce8",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    color: "#334155",
    whiteSpace: "nowrap",
    fontSize: 10,
    lineHeight: 1.1,
  },

  groupSelectBtnActive: {
    background: "#eef2ff",
    borderColor: "#c7d2fe",
    color: "#3730a3",
  },

  endpointList: {
    display: "grid",
    gap: 0,
    paddingLeft: 12,
  },

  endpointRow: {
    display: "grid",
    gridTemplateColumns: "18px 58px minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    padding: "6px 10px",
    borderRadius: 8,
    cursor: "pointer",
    border: "1px solid transparent",
    minWidth: 0,
  },

  endpointRowChecked: {
    background: "#f5f8ff",
    borderColor: "#dbe7ff",
  },

  checkbox: {
    marginTop: 2,
    width: 12,
    height: 12,
  },

  methodText: {
    fontSize: 10,
    fontWeight: 800,
    lineHeight: 1.05,
    whiteSpace: "nowrap",
    letterSpacing: 0.15,
    paddingTop: 1,
  },

  endpointContent: {
    minWidth: 0,
    display: "grid",
    gap: 0,
  },

  endpointTopLine: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    minWidth: 0,
    flexWrap: "wrap",
  },

  endpointName: {
    fontSize: 11,
    fontWeight: 700,
    color: "#0f172a",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.05,
  },

  authBadge: {
    fontSize: 9,
    fontWeight: 700,
    color: "#9a3412",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 999,
    padding: "1px 5px",
    whiteSpace: "nowrap",
    flexShrink: 0,
    lineHeight: 1.05,
  },

  endpointPath: {
    fontSize: 10,
    color: "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    lineHeight: 1.02,
  },

  moreWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    padding: "6px 2px 0",
    borderTop: "1px solid #eef2f7",
    marginTop: 2,
  },

  moreMeta: {
    fontSize: 11,
    color: "#64748b",
  },

  footer: {
    marginTop: 2,
    fontSize: 11,
    color: "#64748b",
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
    padding: "0 2px",
  },

  emptyState: {
    padding: 14,
    borderRadius: 10,
    textAlign: "center",
    color: "#64748b",
  },

  emptyTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 4,
  },

  emptySubtle: {
    fontSize: 12,
    color: "#64748b",
  },
};
