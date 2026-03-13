import React, { useEffect, useState } from "react";
import ProjectCard from "../components/ProjectCard";
import GenerationOptions from "../components/GenerationOptions";

export default function DashboardPage({
  onOpenProject,
  generatorSettings,
  onChangeGeneratorSettings,
}) {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [err, setErr] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newProject, setNewProject] = useState({
    project_name: "",
    env_count: 1,
    docs_status: "missing",
  });

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

  function handleCreateProject(e) {
    e.preventDefault();

    if (!newProject.project_name.trim()) {
      alert("Project name is required.");
      return;
    }

    const created = {
      project_id: `proj_${Date.now()}`,
      project_name: newProject.project_name.trim(),
      env_count: Number(newProject.env_count) || 1,
      docs_status: newProject.docs_status || "missing",
      last_generated_at: null,
    };

    setProjects((prev) => [created, ...prev]);
    setShowCreateForm(false);
    setNewProject({
      project_name: "",
      env_count: 1,
      docs_status: "missing",
    });
  }

  return (
    <div className="projects-workspace">
      <section className="page-card">
        <div className="section-head projects-topbar">
          <div>
            <h3 style={{ margin: 0 }}>Projects</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Manage multiple API projects under your organization workspace.
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
                <label className="projects-label">Docs Status</label>
                <select
                  value={newProject.docs_status}
                  onChange={(e) =>
                    setNewProject((prev) => ({
                      ...prev,
                      docs_status: e.target.value,
                    }))
                  }
                >
                  <option value="ok">Docs Ready</option>
                  <option value="missing">Docs Missing</option>
                  <option value="error">Docs Error</option>
                </select>
              </div>
            </div>

            <div className="projects-form-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="primary-btn">
                Create Project
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="page-card">
        <div className="projects-panel-title">Project Directory</div>

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
          <div className="info-box">No projects found.</div>
        )}
      </section>

      <section className="page-card">
        <div className="projects-info-stack">
          <div className="projects-info-card projects-highlight-card">
            <div className="projects-info-title">
              Project Generation Defaults
            </div>
            <p style={{ margin: 0 }}>
              Set the default test types, spec source, and generation guidance
              for this project. These settings will be used later inside the
              Generate Tests tab.
            </p>
          </div>

          <div className="projects-info-card">
            <div className="projects-info-title">Generation Setup</div>
            <p className="muted" style={{ marginTop: 0 }}>
              Configure the default environment, auth profile, coverage scope,
              spec URL, and generation guidance for the selected project.
            </p>

            <GenerationOptions
              options={generatorSettings}
              onChange={onChangeGeneratorSettings}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
