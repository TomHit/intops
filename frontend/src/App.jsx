import React, { useMemo, useState } from "react";
import AppShell from "./components/layout/AppShell";
import DashboardPage from "./pages/DashboardPage";
import GeneratorPage from "./pages/GeneratorPage";
import TestCasesPage from "./pages/TestCasesPage";

function WelcomePage({ onSelectMode }) {
  return (
    <div className="page-grid">
      <section className="page-card">
        <div style={{ marginBottom: 20 }}>
          <div className="header-eyebrow" style={{ marginBottom: 10 }}>
            API TestOps Onboarding
          </div>
          <h2 style={{ margin: 0, fontSize: 32 }}>
            Who are you setting up for?
          </h2>
          <p className="muted" style={{ marginTop: 12 }}>
            Choose how you want to use the platform. Organizations get team and
            project mapping. Individual users can start directly with projects.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 20,
          }}
        >
          <div className="project-card">
            <div className="project-card-title">Organization</div>
            <div className="project-card-subtitle">
              Create an organization, add teams, and assign projects by team.
            </div>

            <div className="project-card-ai-note">
              Best for QA teams, engineering groups, and companies managing many
              APIs together.
            </div>

            <div className="project-card-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={() => onSelectMode("organization")}
              >
                Continue as Organization
              </button>
            </div>
          </div>

          <div className="project-card">
            <div className="project-card-title">Individual</div>
            <div className="project-card-subtitle">
              Skip organization and team setup and start directly with projects.
            </div>

            <div className="project-card-ai-note">
              Best for solo developers, freelancers, and personal API test case
              generation.
            </div>

            <div className="project-card-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={() => onSelectMode("individual")}
              >
                Continue as Individual
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="page-card">
        <h3>How the setup works</h3>
        <ul className="simple-list">
          <li>
            Organization → create organization → add team → create project
          </li>
          <li>Individual → skip team setup → create project directly</li>
          <li>Both flows later reach the same Generate Tests workspace</li>
        </ul>
      </section>
    </div>
  );
}

function CreateOrganizationPage({ onCreateOrganization, onBack }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  function handleSubmit(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Organization name is required.");
      return;
    }

    onCreateOrganization({
      id: `org_${Date.now()}`,
      name: form.name.trim(),
      description:
        form.description.trim() ||
        "New organization created in API TestOps workspace.",
    });
  }

  return (
    <div className="page-grid">
      <section className="page-card">
        <div className="section-head">
          <div>
            <h3 style={{ margin: 0 }}>Create Organization</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Set up your workspace before adding teams and projects.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "grid",
              gap: 16,
            }}
          >
            <div>
              <label className="projects-label">Organization Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter organization name"
              />
            </div>

            <div>
              <label className="projects-label">Description</label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Describe your organization"
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "flex-end",
              marginTop: 20,
              flexWrap: "wrap",
            }}
          >
            <button type="button" className="secondary-btn" onClick={onBack}>
              Back
            </button>
            <button type="submit" className="primary-btn">
              Create Organization
            </button>
          </div>
        </form>
      </section>

      <section className="page-card">
        <h3>What happens next</h3>
        <ul className="simple-list">
          <li>You can add teams for access control</li>
          <li>Projects can later be assigned to teams</li>
          <li>Spec source can be linked per project</li>
        </ul>
      </section>
    </div>
  );
}

function OverviewPage({ workspaceMode, organization }) {
  const title =
    workspaceMode === "organization"
      ? organization?.name || "Organization"
      : "Personal Workspace";

  return (
    <div className="page-grid">
      <section className="page-card">
        <h3>
          {workspaceMode === "organization"
            ? "Organization Summary"
            : "Personal Summary"}
        </h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Workspace: {title}
        </p>

        <div className="stats-grid">
          <div className="stat-box">
            <span>
              {workspaceMode === "organization" ? "Teams" : "Projects"}
            </span>
            <strong>{workspaceMode === "organization" ? 3 : 1}</strong>
          </div>
          <div className="stat-box">
            <span>Projects</span>
            <strong>4</strong>
          </div>
          <div className="stat-box">
            <span>APIs</span>
            <strong>107</strong>
          </div>
          <div className="stat-box">
            <span>Generated Tests</span>
            <strong>1,240</strong>
          </div>
        </div>
      </section>

      <section className="page-card">
        <h3>Recent Activity</h3>
        <ul className="simple-list">
          <li>Trading API test generation completed.</li>
          <li>Auth API flagged for missing negative coverage.</li>
          <li>Orders API uploaded under QA Team.</li>
        </ul>
      </section>
    </div>
  );
}

function TeamsPage() {
  const [teams, setTeams] = useState([
    {
      id: "team_qa",
      name: "QA Team",
      members: [
        {
          id: "m1",
          name: "Hitesh",
          email: "hitesh@example.com",
          role: "Admin",
        },
        { id: "m2", name: "Ravi", email: "ravi@example.com", role: "Member" },
        {
          id: "m3",
          name: "Anjali",
          email: "anjali@example.com",
          role: "Member",
        },
        { id: "m4", name: "Neha", email: "neha@example.com", role: "Member" },
        { id: "m5", name: "Amit", email: "amit@example.com", role: "Member" },
      ],
      projects: 3,
      description:
        "Owns test design, validation coverage, and regression review.",
    },
    {
      id: "team_backend",
      name: "Backend Team",
      members: [
        { id: "m6", name: "Dev 1", email: "dev1@example.com", role: "Member" },
        { id: "m7", name: "Dev 2", email: "dev2@example.com", role: "Member" },
        { id: "m8", name: "Dev 3", email: "dev3@example.com", role: "Member" },
        { id: "m9", name: "Dev 4", email: "dev4@example.com", role: "Member" },
      ],
      projects: 2,
      description:
        "Maintains API contracts, environments, and backend changes.",
    },
    {
      id: "team_security",
      name: "Security Team",
      members: [
        { id: "m10", name: "Sec 1", email: "sec1@example.com", role: "Member" },
        { id: "m11", name: "Sec 2", email: "sec2@example.com", role: "Member" },
      ],
      projects: 1,
      description: "Focuses on auth, negative testing, and security review.",
    },
  ]);

  const [selectedTeamId, setSelectedTeamId] = useState("team_qa");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  const [newTeam, setNewTeam] = useState({
    name: "",
    description: "",
    projects: 0,
  });

  const [inviteForm, setInviteForm] = useState({
    teamId: "team_qa",
    name: "",
    email: "",
    role: "Member",
  });

  const selectedTeam =
    teams.find((team) => team.id === selectedTeamId) || teams[0] || null;

  function handleCreateTeam(e) {
    e.preventDefault();

    if (!newTeam.name.trim()) {
      alert("Team name is required.");
      return;
    }

    const created = {
      id: `team_${Date.now()}`,
      name: newTeam.name.trim(),
      members: [],
      projects: Number(newTeam.projects) || 0,
      description:
        newTeam.description.trim() ||
        "Newly created team in your organization.",
    };

    setTeams((prev) => [created, ...prev]);
    setSelectedTeamId(created.id);
    setShowCreateForm(false);
    setNewTeam({
      name: "",
      description: "",
      projects: 0,
    });
  }

  function openInvite(teamId) {
    setInviteForm((prev) => ({
      ...prev,
      teamId,
    }));
    setShowInviteForm(true);
  }

  function handleInviteMember(e) {
    e.preventDefault();

    if (!inviteForm.name.trim() || !inviteForm.email.trim()) {
      alert("Name and email are required.");
      return;
    }

    const newMember = {
      id: `member_${Date.now()}`,
      name: inviteForm.name.trim(),
      email: inviteForm.email.trim(),
      role: inviteForm.role,
    };

    setTeams((prev) =>
      prev.map((team) =>
        team.id === inviteForm.teamId
          ? { ...team, members: [...team.members, newMember] }
          : team,
      ),
    );

    setSelectedTeamId(inviteForm.teamId);
    setShowInviteForm(false);
    setInviteForm((prev) => ({
      ...prev,
      name: "",
      email: "",
      role: "Member",
    }));
  }

  return (
    <div className="teams-workspace">
      <section className="page-card">
        <div className="section-head teams-topbar">
          <div>
            <h3 style={{ margin: 0 }}>Teams</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Manage access through teams instead of assigning every user one by
              one.
            </p>
          </div>

          <div className="teams-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setInviteForm((prev) => ({
                  ...prev,
                  teamId: selectedTeam?.id || "",
                }));
                setShowInviteForm(true);
              }}
            >
              Invite Member
            </button>

            <button
              type="button"
              className="primary-btn"
              onClick={() => setShowCreateForm((prev) => !prev)}
            >
              + Create Team
            </button>
          </div>
        </div>

        {showCreateForm && (
          <form className="teams-form-card" onSubmit={handleCreateTeam}>
            <div className="teams-form-title">Create New Team</div>

            <div className="teams-form-grid">
              <div>
                <label className="teams-label">Team Name</label>
                <input
                  type="text"
                  value={newTeam.name}
                  onChange={(e) =>
                    setNewTeam((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Enter team name"
                />
              </div>

              <div>
                <label className="teams-label">Assigned Projects</label>
                <input
                  type="number"
                  min="0"
                  value={newTeam.projects}
                  onChange={(e) =>
                    setNewTeam((prev) => ({
                      ...prev,
                      projects: e.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </div>

              <div className="teams-form-full">
                <label className="teams-label">Description</label>
                <textarea
                  value={newTeam.description}
                  onChange={(e) =>
                    setNewTeam((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Describe the team responsibility"
                />
              </div>
            </div>

            <div className="teams-form-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="primary-btn">
                Create Team
              </button>
            </div>
          </form>
        )}

        {showInviteForm && (
          <form className="teams-form-card" onSubmit={handleInviteMember}>
            <div className="teams-form-title">Invite Team Member</div>

            <div className="teams-form-grid">
              <div>
                <label className="teams-label">Team</label>
                <select
                  value={inviteForm.teamId}
                  onChange={(e) =>
                    setInviteForm((prev) => ({
                      ...prev,
                      teamId: e.target.value,
                    }))
                  }
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="teams-label">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm((prev) => ({
                      ...prev,
                      role: e.target.value,
                    }))
                  }
                >
                  <option value="Member">Member</option>
                  <option value="Admin">Admin</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>

              <div>
                <label className="teams-label">Member Name</label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) =>
                    setInviteForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="teams-label">Email</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  placeholder="Enter email address"
                />
              </div>
            </div>

            <div className="teams-form-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowInviteForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="primary-btn">
                Send Invite
              </button>
            </div>
          </form>
        )}
      </section>

      <div className="teams-grid">
        <section className="page-card teams-left">
          <div className="teams-panel-title">Team Directory</div>

          <div className="teams-card-list">
            {teams.map((team) => (
              <div className="team-card" key={team.id}>
                <div className="team-card-top">
                  <div>
                    <div className="team-card-title">{team.name}</div>
                    <div className="team-card-subtitle">{team.description}</div>
                  </div>

                  <span className="team-status-pill">Active</span>
                </div>

                <div className="team-card-stats">
                  <div className="team-stat-box">
                    <span>Members</span>
                    <strong>{team.members.length}</strong>
                  </div>

                  <div className="team-stat-box">
                    <span>Projects</span>
                    <strong>{team.projects}</strong>
                  </div>
                </div>

                <div className="team-card-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setSelectedTeamId(team.id)}
                  >
                    View Team
                  </button>

                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => openInvite(team.id)}
                  >
                    Invite
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="page-card teams-right">
          <div className="teams-panel-title">Team Details</div>

          {selectedTeam ? (
            <div className="teams-info-stack">
              <div className="teams-info-card">
                <div className="teams-info-title">{selectedTeam.name}</div>
                <p className="muted" style={{ marginTop: 0 }}>
                  {selectedTeam.description}
                </p>
                <div className="teams-detail-stats">
                  <div className="team-stat-box">
                    <span>Members</span>
                    <strong>{selectedTeam.members.length}</strong>
                  </div>
                  <div className="team-stat-box">
                    <span>Projects</span>
                    <strong>{selectedTeam.projects}</strong>
                  </div>
                </div>
              </div>

              <div className="teams-info-card">
                <div className="teams-info-title">Members</div>
                {selectedTeam.members.length > 0 ? (
                  <div className="teams-member-list">
                    {selectedTeam.members.map((member) => (
                      <div className="teams-member-item" key={member.id}>
                        <div>
                          <div className="teams-member-name">{member.name}</div>
                          <div className="teams-member-email">
                            {member.email}
                          </div>
                        </div>
                        <span className="teams-member-role">{member.role}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="info-box">No members added yet.</div>
                )}
              </div>

              <div className="teams-info-card teams-highlight-card">
                <div className="teams-info-title">How access works</div>
                <p style={{ margin: 0 }}>
                  Members are invited to a team, and that team gets access to
                  the projects assigned to it.
                </p>
              </div>
            </div>
          ) : (
            <div className="info-box">Select a team to view details.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function ExecutionPage() {
  return (
    <div className="page-card">
      <h3>Execution</h3>
      <p className="muted">Execution engine is under development.</p>
      <ul className="simple-list">
        <li>Run suites</li>
        <li>Environment-based execution</li>
        <li>Pass/fail reports</li>
      </ul>
    </div>
  );
}

function ReportsPage({ projectId }) {
  return (
    <div className="page-grid">
      <section className="page-card">
        <h3>Reports</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Current project: {projectId || "Select a project first"}
        </p>
        <ul className="simple-list">
          <li>Coverage summary</li>
          <li>Endpoint risk summary</li>
          <li>JSON / CSV export</li>
        </ul>
      </section>

      <section className="page-card">
        <h3>Status</h3>
        <p className="muted">
          Reports page structure is ready. Detailed exports can be connected
          later.
        </p>
      </section>
    </div>
  );
}

function SettingsPage({ workspaceMode, organization }) {
  return (
    <div className="page-card">
      <h3>Settings</h3>
      <p className="muted">Workspace Mode: {workspaceMode || "Not selected"}</p>
      <p className="muted">
        Organization:{" "}
        {workspaceMode === "organization"
          ? organization?.name || "Not created yet"
          : "Not applicable for individual workspace"}
      </p>
      <p className="muted">
        Organization, default environment, and AI generation settings will go
        here.
      </p>
    </div>
  );
}

export default function App() {
  const [activeNav, setActiveNav] = useState("welcome");
  const [selectedProject, setSelectedProject] = useState(null);
  const [generatedRun, setGeneratedRun] = useState(null);

  const [workspaceMode, setWorkspaceMode] = useState(null);
  const [organization, setOrganization] = useState(null);

  const [generatorSettings, setGeneratorSettings] = useState({
    include: ["contract", "schema"],
    env: "staging",
    auth_profile: "device",
    guidance: "",
    ai: false,
    spec_source: "",
    generation_mode: "balanced",
  });

  function handleSelectMode(mode) {
    setWorkspaceMode(mode);

    if (mode === "organization") {
      setActiveNav("createOrganization");
      return;
    }

    setOrganization(null);
    setActiveNav("projects");
  }

  function handleCreateOrganization(org) {
    setOrganization(org);
    setActiveNav("teams");
  }

  const page = useMemo(() => {
    switch (activeNav) {
      case "welcome":
        return <WelcomePage onSelectMode={handleSelectMode} />;

      case "createOrganization":
        return (
          <CreateOrganizationPage
            onCreateOrganization={handleCreateOrganization}
            onBack={() => setActiveNav("welcome")}
          />
        );

      case "teams":
        return <TeamsPage />;

      case "projects":
        return (
          <DashboardPage
            onOpenProject={(id) => {
              setSelectedProject(id);
              setActiveNav("generate");
            }}
            generatorSettings={generatorSettings}
            onChangeGeneratorSettings={setGeneratorSettings}
          />
        );

      case "generate":
        return (
          <GeneratorPage
            projectId={selectedProject}
            onBack={() => setActiveNav("projects")}
            onViewTestCases={() => setActiveNav("testCases")}
            onSaveGeneratedRun={setGeneratedRun}
            generatedRun={generatedRun}
            options={generatorSettings}
          />
        );

      case "testCases":
        return (
          <TestCasesPage
            projectId={selectedProject}
            generatedRun={generatedRun}
          />
        );

      case "execution":
        return <ExecutionPage />;

      case "reports":
        return <ReportsPage projectId={selectedProject} />;

      case "settings":
        return (
          <SettingsPage
            workspaceMode={workspaceMode}
            organization={organization}
          />
        );

      case "overview":
      default:
        return (
          <OverviewPage
            workspaceMode={workspaceMode}
            organization={organization}
          />
        );
    }
  }, [
    activeNav,
    selectedProject,
    generatedRun,
    generatorSettings,
    workspaceMode,
    organization,
  ]);

  return (
    <AppShell
      activeNav={activeNav}
      onChangeNav={setActiveNav}
      workspaceMode={workspaceMode}
      organization={organization}
    >
      {page}
    </AppShell>
  );
}
