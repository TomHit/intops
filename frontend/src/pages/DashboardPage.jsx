import React, { useEffect, useState } from "react";
import ProjectCard from "../components/ProjectCard";
import GenerationOptions from "../components/GenerationOptions";

export default function DashboardPage({
  onOpenProject,
  generatorSettings,
  onChangeGeneratorSettings,
  userMode = "individual",
  userEmail = "",
  orgId = "",
}) {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [err, setErr] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newProject, setNewProject] = useState({
    project_name: "",
    env_count: 1,
    description: "",
    spec_source_type: "url",
    spec_source: "",
    spec_format: "auto",
  });

  const isOrganization = userMode === "organization";
  const isIndividual = userMode === "individual";

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const res = await fetch("/api/projects", {
        headers: { Accept: "application/json" },
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : [];

      if (!res.ok) {
        throw new Error(data?.message || `Failed: ${res.status}`);
      }

      setProjects(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreateProject(e) {
    e.preventDefault();

    const projectName = newProject.project_name.trim();
    const specSource = newProject.spec_source.trim();

    if (!projectName) {
      alert("Project name is required.");
      return;
    }

    setCreating(true);
    setErr("");

    try {
      const payload = {
        project_name: projectName,
        org_id: orgId,
        env_count: Number(newProject.env_count) || 1,
        description: newProject.description.trim(),
        spec_source_type: newProject.spec_source_type || "url",
        spec_source: specSource,
        spec_format: newProject.spec_format || "auto",
      };

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!res.ok) {
        throw new Error(data?.message || `Create failed: ${res.status}`);
      }

      setProjects((prev) => [data, ...prev]);
      setShowCreateForm(false);

      setNewProject({
        project_name: "",
        env_count: 1,
        description: "",
        spec_source_type: "url",
        spec_source: "",
        spec_format: "auto",
      });
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="projects-workspace">
      <section className="page-card">
        <div className="section-head projects-topbar">
          <div>
            <h3 style={{ margin: 0 }}>
              {isOrganization ? "Projects" : "My Projects"}
            </h3>

            <p className="muted" style={{ marginTop: 6 }}>
              {isOrganization
                ? "Manage multiple API projects under your organization workspace."
                : `Create and manage your personal API projects${
                    userEmail ? ` as ${userEmail}` : ""
                  }.`}
            </p>
          </div>

          <div className="projects-actions">
            <button type="button" className="secondary-btn" onClick={load}>
              Refresh
            </button>

            <button
              type="button"
              className="primary-btn"
              onClick={() => setShowCreateForm((prev) => !prev)}
            >
              + New Project
            </button>
          </div>
        </div>

        {isIndividual ? (
          <div
            className="projects-info-card projects-highlight-card"
            style={{ marginTop: 18 }}
          >
            <div className="projects-info-title">Personal Workspace</div>
            <p style={{ margin: 0 }}>
              You are using the individual flow, so there is no team or
              organization setup required. Create a project, add your API spec,
              and move directly into test generation.
            </p>
          </div>
        ) : null}

        {showCreateForm && (
          <form className="projects-form-card" onSubmit={handleCreateProject}>
            <div className="projects-form-title">Create New Project</div>

            <div className="projects-form-grid">
              <div>
                <label className="projects-label">Project Name</label>
                <input
                  type="text"
                  value={newProject.project_name}
                  onChange={(e) =>
                    setNewProject((prev) => ({
                      ...prev,
                      project_name: e.target.value,
                    }))
                  }
                  placeholder="Enter project name"
                />
              </div>

              <div>
                <label className="projects-label">Environment Count</label>
                <input
                  type="number"
                  min="1"
                  value={newProject.env_count}
                  onChange={(e) =>
                    setNewProject((prev) => ({
                      ...prev,
                      env_count: e.target.value,
                    }))
                  }
                  placeholder="1"
                />
              </div>

              <div className="projects-form-full">
                <label className="projects-label">Project Description</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) =>
                    setNewProject((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Describe this API project"
                />
              </div>

              <div>
                <label className="projects-label">Spec Source Type</label>
                <select
                  value={newProject.spec_source_type}
                  onChange={(e) =>
                    setNewProject((prev) => ({
                      ...prev,
                      spec_source_type: e.target.value,
                    }))
                  }
                >
                  <option value="url">Spec URL</option>
                  <option value="raw">Paste JSON/YAML</option>
                </select>
              </div>

              <div>
                <label className="projects-label">Spec Format</label>
                <select
                  value={newProject.spec_format}
                  onChange={(e) =>
                    setNewProject((prev) => ({
                      ...prev,
                      spec_format: e.target.value,
                    }))
                  }
                >
                  <option value="auto">Auto Detect</option>
                  <option value="openapi-json">OpenAPI JSON</option>
                  <option value="openapi-yaml">OpenAPI YAML</option>
                </select>
              </div>

              <div className="projects-form-full">
                <label className="projects-label">
                  {newProject.spec_source_type === "url"
                    ? "Spec URL"
                    : "Paste Spec"}
                </label>

                {newProject.spec_source_type === "url" ? (
                  <input
                    type="text"
                    value={newProject.spec_source}
                    onChange={(e) =>
                      setNewProject((prev) => ({
                        ...prev,
                        spec_source: e.target.value,
                      }))
                    }
                    placeholder="https://example.com/openapi.json"
                  />
                ) : (
                  <textarea
                    value={newProject.spec_source}
                    onChange={(e) =>
                      setNewProject((prev) => ({
                        ...prev,
                        spec_source: e.target.value,
                      }))
                    }
                    placeholder="Paste OpenAPI JSON or YAML here"
                  />
                )}
              </div>
            </div>

            <div className="projects-form-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowCreateForm(false)}
                disabled={creating}
              >
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={creating}>
                {creating ? "Creating..." : "Create Project"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="page-card">
        <div className="projects-panel-title">
          {isOrganization ? "Project Directory" : "Project Library"}
        </div>

        {loading && <div className="info-box">Loading projects…</div>}

        {!!err && <div className="error-box">Error: {err}</div>}

        {!loading && !err && projects.length > 0 && (
          <div className="project-grid">
            {projects.map((p) => (
              <ProjectCard
                key={p.project_id}
                project={p}
                onOpen={() => onOpenProject?.(p.project_id)}
              />
            ))}
          </div>
        )}

        {!loading && !err && projects.length === 0 && (
          <div className="info-box">
            {isOrganization
              ? "No projects found."
              : "No projects found yet. Create your first project to start generating test cases."}
          </div>
        )}
      </section>

      <section className="page-card">
        <div className="projects-info-stack">
          <div className="projects-info-card projects-highlight-card">
            <div className="projects-info-title">
              {isOrganization
                ? "Project Generation Defaults"
                : "Personal Generation Defaults"}
            </div>
            <p style={{ margin: 0 }}>
              {isOrganization
                ? "Set the default test types, spec source, and generation guidance for this project. These settings will be used later inside the Generate Tests tab."
                : "Set your default test types, spec source, and generation guidance for personal projects. These settings will be used later inside the Generate Tests tab."}
            </p>
          </div>

          <div className="projects-info-card">
            <div className="projects-info-title">Generation Setup</div>
            <p className="muted" style={{ marginTop: 0 }}>
              {isOrganization
                ? "Configure the default environment, auth profile, coverage scope, spec URL, and generation guidance for the selected project."
                : "Configure your default environment, auth profile, coverage scope, spec URL, and generation guidance for the selected project."}
            </p>

            <GenerationOptions
              options={
                generatorSettings || {
                  env: "staging",
                  auth_profile: "none",
                  include: [],
                  ai: false,
                  endpoints_n: 10,
                  guidance_len: 0,
                  spec_url: "",
                }
              }
              onChange={onChangeGeneratorSettings || (() => {})}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
