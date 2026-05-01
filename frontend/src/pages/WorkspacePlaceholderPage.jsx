import React, { useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import DashboardPage from "./DashboardPage";
import GeneratorPage from "./GeneratorPage";
import TestCasesPage from "./TestCasesPage";

const DEFAULT_GENERATOR_SETTINGS = {
  env: "staging",
  auth_profile: "",
  include: [
    "contract",
    "schema",
    "negative",
    "auth",
    "functional",
    "integration",
    "database",
    "reliability",
  ],
  ai: false,
  generation_mode: "balanced",
  spec_source: "",
  guidance: "",
};

function normalizeGeneratorSettings(value = {}) {
  return {
    ...DEFAULT_GENERATOR_SETTINGS,
    ...(value || {}),
    include: Array.from(
      new Set(
        Array.isArray(value?.include) && value.include.length > 0
          ? value.include
          : DEFAULT_GENERATOR_SETTINGS.include,
      ),
    ),
  };
}

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

  const [activeNav, setActiveNav] = useState("projects");
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [generatorSettings, setGeneratorSettings] = useState(
    DEFAULT_GENERATOR_SETTINGS,
  );
  const [runGeneratorSettings, setRunGeneratorSettings] = useState(
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
    setGeneratedRun(null);
    setRunGeneratorSettings(normalizeGeneratorSettings(generatorSettings));
    setActiveNav("generate");
  }

  function handleSidebarChange(nextNav) {
    setActiveNav(nextNav);
  }

  function renderContent() {
    switch (activeNav) {
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
            generatorSettings={runGeneratorSettings}
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
          <TestCasesPage
            projectId={selectedProjectId}
            generatedRun={generatedRun}
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
    <div
      className="app-shell premium-shell"
      style={{
        display: "flex",
        minHeight: "100vh",
        width: "100%",
      }}
    >
      <Sidebar
        activeNav={activeNav}
        onChange={handleSidebarChange}
        workspaceMode={mode}
        organization={organization}
      />

      <main
        className="app-main premium-main"
        style={{
          flex: 1,
          minWidth: 0,
          paddingTop: 12,
          overflowX: "hidden",
        }}
      >
        <div
          className="workspace-content"
          style={{
            paddingTop: 0,
            paddingLeft: 24,
            paddingRight: 24,
            width: "100%",
            minWidth: 0,
            overflowX: "hidden",
            boxSizing: "border-box",
          }}
        >
          {renderContent()}
        </div>
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
