import React from "react";
import { NAV_ITEMS } from "../../utils/navigation";

export default function Sidebar({
  activeNav,
  onChange,
  workspaceMode,
  organization,
}) {
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (workspaceMode !== "organization" && item.key === "teams") {
      return false;
    }

    if (workspaceMode !== "organization" && item.key === "overview") {
      return false;
    }

    return true;
  });

  const workspaceLabel =
    workspaceMode === "organization" ? "Organization" : "Individual Workspace";

  const workspaceName =
    workspaceMode === "organization"
      ? organization?.name || "My Organization"
      : "Personal Workspace";

  const workspaceMeta =
    workspaceMode === "organization"
      ? "Teams, projects, and shared API ownership"
      : "Projects and test generation for a single user";

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">AI</div>
        <div>
          <div className="brand-title">API TestOps</div>
          <div className="brand-subtitle">AI-powered workspace</div>
        </div>
      </div>

      <div className="sidebar-org-card">
        <div className="sidebar-section-label">{workspaceLabel}</div>
        <div className="sidebar-org-name">{workspaceName}</div>
        <div className="sidebar-org-meta">{workspaceMeta}</div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Workspace</div>

        {visibleNavItems.map((item) => {
          const isActive = activeNav === item.key;
          const className = [
            "sidebar-nav-item",
            isActive ? "active" : "",
            item.disabled ? "disabled" : "",
          ]
            .join(" ")
            .trim();

          return (
            <button
              key={item.key}
              type="button"
              className={className}
              onClick={() => !item.disabled && onChange(item.key)}
              disabled={item.disabled}
              title={item.disabled ? "Coming soon" : item.label}
            >
              <span>{item.label}</span>
              {item.badge ? (
                <span className="nav-badge">{item.badge}</span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
