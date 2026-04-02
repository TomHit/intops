import React, { useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import DashboardPage from "./DashboardPage";
import GeneratorPage from "./GeneratorPage";

import ProjectOnboardingPage from "./ProjectOnboardingPage";

const DEFAULT_GENERATOR_SETTINGS = {
  env: "staging",
  auth_profile: "",
  include: ["contract", "schema"],
  ai: false,
  generation_mode: "balanced",
  spec_source: "",
  guidance: "",
};

export default function WorkspacePlaceholderPage() {
  const location = useLocation();

  const saved =
    JSON.parse(localStorage.getItem("apitestops_session") || "null") || {};

  const userId = location.state?.user_id || saved.user_id || "";
  const mode = location.state?.mode || saved.mode;
  const email = location.state?.email || saved.email || "";
  const orgId = location.state?.org_id || saved.org_id || "";
  localStorage.setItem(
    "apitestops_session",
    JSON.stringify({
      mode,
      email,
      org_id: orgId,
      user_id: userId,
    }),
  );

  const [activeNav, setActiveNav] = useState("onboarding");
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [generatorSettings, setGeneratorSettings] = useState(
    DEFAULT_GENERATOR_SETTINGS,
  );
  const [generatedRun, setGeneratedRun] = useState(null);

  const organization = useMemo(() => {
    if (mode !== "organization") return null;

    return {
      name: "My Organization",
    };
  }, [mode]);

  if (!mode) {
    return <Navigate to="/" replace />;
  }

  function handleOpenProject(projectId) {
    setSelectedProjectId(projectId);
    setActiveNav("generate");
  }

  function handleSidebarChange(nextNav) {
    setActiveNav(nextNav);
  }

  function renderContent() {
    switch (activeNav) {
      case "onboarding":
        return (
          <ProjectOnboardingPage
            onContinueToGeneration={() => {
              console.log("onContinueToGeneration fired");
              setActiveNav("projects");
            }}
          />
        );
      case "projects":
        return (
          <DashboardPage
            userMode={mode}
            userEmail={email}
            orgId={orgId}
            generatorSettings={generatorSettings}
            onChangeGeneratorSettings={setGeneratorSettings}
            onOpenProject={handleOpenProject}
          />
        );

      case "generate":
        return (
          <GeneratorPage
            selectedProjectId={selectedProjectId}
            generatorSettings={generatorSettings}
            activeSection="generate"
            generatedRun={generatedRun}
            onSaveGeneratedRun={setGeneratedRun}
            onViewTestCases={() => setActiveNav("testCases")}
            onBack={() => setActiveNav("projects")}
            userId={userId}
          />
        );

      case "testCases":
        return (
          <GeneratorPage
            selectedProjectId={selectedProjectId}
            generatorSettings={generatorSettings}
            activeSection="testCases"
            generatedRun={generatedRun}
            onSaveGeneratedRun={setGeneratedRun}
            onBack={() => setActiveNav("generate")}
            userId={userId}
          />
        );

      case "reports":
        return <EmptyState title="Reports" />;

      case "settings":
        return <EmptyState title="Settings" />;

      case "overview":
        return <EmptyState title="Overview" />;

      case "teams":
        return <EmptyState title="Teams" />;

      default:
        return (
          <DashboardPage
            userMode={mode}
            userEmail={email}
            orgId={orgId}
            generatorSettings={generatorSettings}
            onChangeGeneratorSettings={setGeneratorSettings}
            onOpenProject={handleOpenProject}
          />
        );
    }
  }

  function getPageTitle() {
    switch (activeNav) {
      case "projects":
        return "Projects";
      case "generate":
        return "Generate Test Cases";
      case "testCases":
        return "Test Cases";
      case "onboarding":
        return "Project Onboarding";
      case "reports":
        return "Reports";
      case "settings":
        return "Settings";
      case "overview":
        return "Overview";
      case "teams":
        return "Teams";
      default:
        return "Workspace";
    }
  }

  return (
    <div className="app-shell premium-shell">
      <Sidebar
        activeNav={activeNav}
        onChange={handleSidebarChange}
        workspaceMode={mode}
        organization={organization}
      />

      <main className="app-main premium-main">
        {/* HEADER */}
        <div className="workspace-header">
          <div>
            <h1 className="workspace-title">{getPageTitle()}</h1>
            <p className="workspace-subtitle">
              {mode === "organization"
                ? `${organization?.name} workspace`
                : "Personal workspace"}
            </p>
          </div>

          <div className="workspace-user">
            <div className="workspace-user-avatar">
              {email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="workspace-user-meta">
              <div className="workspace-user-email">{email}</div>
              <div className="workspace-user-mode">{mode}</div>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ marginBottom: 8, color: "#94a3b8", fontSize: 12 }}>
          Active section: {activeNav}
        </div>
        <div className="workspace-content">{renderContent()}</div>
      </main>
    </div>
  );
}

/* ---------- Premium Empty State ---------- */
function EmptyState({ title }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>This section will be available soon.</p>
    </div>
  );
}
