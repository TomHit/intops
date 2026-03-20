import React from "react";
import { NAV_ITEMS } from "../../utils/navigation";

export default function Sidebar({
  activeNav,
  onChange,
  workspaceMode = "individual",
  organization,
}) {
  const isOrganization = workspaceMode === "organization";
  const isIndividual = workspaceMode === "individual";

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!isOrganization && item.orgOnly) {
      return false;
    }

    if (!isOrganization && item.key === "teams") {
      return false;
    }

    if (!isOrganization && item.key === "overview") {
      return false;
    }

    return true;
  });

  const workspaceLabel = isOrganization
    ? "Organization"
    : "Individual Workspace";

  const workspaceName = isOrganization
    ? organization?.name || "My Organization"
    : "Personal Workspace";

  const workspaceMeta = isOrganization
    ? "Teams, projects, and shared API ownership"
    : "Projects and test generation for a single user";

  const brandSubtitle = isOrganization
    ? "AI-powered team workspace"
    : "AI-powered personal workspace";

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">AI</div>
        <div>
          <div className="brand-title">API TestOps</div>
          <div className="brand-subtitle">{brandSubtitle}</div>
        </div>
      </div>

      <div className="sidebar-org-card">
        <div className="sidebar-section-label">{workspaceLabel}</div>
        <div className="sidebar-org-name">{workspaceName}</div>
        <div className="sidebar-org-meta">{workspaceMeta}</div>
      </div>

      {isIndividual ? (
        <div className="sidebar-org-card" style={{ marginTop: 14 }}>
          <div className="sidebar-section-label">Quick Start</div>
          <div className="sidebar-org-name">Personal Flow</div>
          <div className="sidebar-org-meta">
            Create a project, add your API spec, and generate test cases faster.
          </div>
        </div>
      ) : null}

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Workspace</div>

        {visibleNavItems.map((item) => {
          const isActive = activeNav === item.key;
          const className = [
            "sidebar-nav-item",
            isActive ? "active" : "",
            item.disabled ? "disabled" : "",
          ]
            .filter(Boolean)
            .join(" ");

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
