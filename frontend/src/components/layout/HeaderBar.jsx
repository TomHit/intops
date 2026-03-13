import React from "react";

const PAGE_META = {
  overview: {
    title: "Organization Overview",
    subtitle:
      "Monitor teams, projects, API inventory, and AI testing coverage.",
  },
  teams: {
    title: "Teams",
    subtitle: "Invite members to teams and manage access through team mapping.",
  },
  projects: {
    title: "Projects",
    subtitle:
      "Create and manage multiple API projects under your organization.",
  },
  generate: {
    title: "Generate Tests",
    subtitle:
      "Use AI to analyze your spec and produce contract, negative, and auth tests.",
  },
  testCases: {
    title: "Test Cases",
    subtitle: "Review AI-generated cases, coverage, and reasoning.",
  },
  execution: {
    title: "Execution",
    subtitle: "Execution engine is under development.",
  },
  reports: {
    title: "Reports",
    subtitle: "Review summaries, exports, and coverage insights.",
  },
  settings: {
    title: "Settings",
    subtitle: "Configure workspace, defaults, and organization preferences.",
  },
};

export default function HeaderBar({ activeNav }) {
  const meta = PAGE_META[activeNav] || PAGE_META.overview;
  const isGeneratePage = activeNav === "generate";

  if (isGeneratePage) {
    return (
      <header className="app-header app-header-compact">
        <div className="header-spacer" />
        <div className="header-actions">
          <input
            className="header-search"
            type="text"
            placeholder="Search projects or APIs"
          />
          <button type="button" className="header-profile-btn">
            HT
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="app-header">
      <div>
        <div className="header-eyebrow">AI TestOps Workspace</div>
        <h1 className="header-title">{meta.title}</h1>
        <p className="header-subtitle">{meta.subtitle}</p>
      </div>

      <div className="header-actions">
        <input
          className="header-search"
          type="text"
          placeholder="Search projects or APIs"
        />
        <button type="button" className="header-profile-btn">
          HT
        </button>
      </div>
    </header>
  );
}
