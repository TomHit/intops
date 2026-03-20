import React, { useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import DashboardPage from "./DashboardPage";
import GeneratorPage from "./GeneratorPage";

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

  const mode = location.state?.mode || saved.mode;
  const email = location.state?.email || saved.email || "";

  const [activeNav, setActiveNav] = useState("projects");
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
      case "projects":
        return (
          <DashboardPage
            userMode={mode}
            userEmail={email}
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
          />
        );

      case "reports":
        return (
          <div className="page-card">
            <h3 style={{ marginTop: 0 }}>Reports</h3>
            <p className="muted" style={{ marginBottom: 0 }}>
              Reports screen will be connected next.
            </p>
          </div>
        );

      case "settings":
        return (
          <div className="page-card">
            <h3 style={{ marginTop: 0 }}>Settings</h3>
            <p className="muted" style={{ marginBottom: 0 }}>
              Settings screen will be connected next.
            </p>
          </div>
        );

      case "overview":
        return (
          <div className="page-card">
            <h3 style={{ marginTop: 0 }}>Overview</h3>
            <p className="muted" style={{ marginBottom: 0 }}>
              Organization overview screen will be connected next.
            </p>
          </div>
        );

      case "teams":
        return (
          <div className="page-card">
            <h3 style={{ marginTop: 0 }}>Teams</h3>
            <p className="muted" style={{ marginBottom: 0 }}>
              Teams screen will be connected next.
            </p>
          </div>
        );

      default:
        return (
          <DashboardPage
            userMode={mode}
            userEmail={email}
            generatorSettings={generatorSettings}
            onChangeGeneratorSettings={setGeneratorSettings}
            onOpenProject={handleOpenProject}
          />
        );
    }
  }

  return (
    <div className="app-shell no-ai-panel">
      <Sidebar
        activeNav={activeNav}
        onChange={handleSidebarChange}
        workspaceMode={mode}
        organization={organization}
      />

      <main className="app-main">{renderContent()}</main>
    </div>
  );
}
