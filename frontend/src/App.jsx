import React, { useMemo, useState } from "react";
import AppShell from "./components/layout/AppShell";
import DashboardPage from "./pages/DashboardPage";
import GeneratorPage from "./pages/GeneratorPage";

function OverviewPage() {
  return (
    <div className="page-grid">
      <section className="page-card">
        <h3>Organization Summary</h3>
        <div className="stats-grid">
          <div className="stat-box">
            <span>Teams</span>
            <strong>3</strong>
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

function TestCasesPage({ projectId }) {
  const suites = [
    {
      id: "suite_1",
      name: "Opportunities API",
      count: 6,
    },
    {
      id: "suite_2",
      name: "Pulse API",
      count: 4,
    },
  ];

  const cases = [
    {
      id: "TC_GET_OPPORTUNITIES_001",
      title: "Validate opportunities response schema",
      type: "contract",
      priority: "High",
      endpoint: "GET /_api/trend/opportunities",
      objective: "Verify response structure and required fields are present.",
      reasoning:
        "Generated because this endpoint returns structured rows and should be validated for schema consistency.",
    },
    {
      id: "TC_GET_OPPORTUNITIES_NEG_001",
      title: "Reject invalid timeframe parameter",
      type: "negative",
      priority: "Medium",
      endpoint: "GET /_api/trend/opportunities",
      objective: "Verify invalid query parameter is rejected gracefully.",
      reasoning:
        "Generated because query inputs are user-controlled and should be validated.",
    },
    {
      id: "TC_GET_PULSE_001",
      title: "Validate pulse response success contract",
      type: "contract",
      priority: "High",
      endpoint: "GET /_api/trend/pulse",
      objective: "Verify API returns 200 and expected top-level contract.",
      reasoning:
        "Generated because this endpoint is suitable for fast contract verification.",
    },
  ];

  const selectedSuite = suites[0];
  const selectedCase = cases[0];

  return (
    <div className="testcases-workspace">
      <section className="page-card">
        <div className="section-head testcases-topbar">
          <div>
            <h3 style={{ margin: 0 }}>Test Cases Explorer</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Project: {projectId || "Select a project first"}
            </p>
          </div>

          <div className="testcases-actions">
            <button type="button" className="secondary-btn">
              Filter
            </button>
            <button type="button" className="secondary-btn">
              Export CSV
            </button>
            <button type="button" className="primary-btn">
              Open Selected
            </button>
          </div>
        </div>
      </section>

      <div className="testcases-grid">
        <section className="page-card testcases-left">
          <div className="testcases-panel-title">Suites</div>

          <div className="testcases-suite-list">
            {suites.map((suite) => (
              <button
                key={suite.id}
                type="button"
                className={`testcases-suite-item ${
                  suite.id === selectedSuite.id ? "active" : ""
                }`}
              >
                <div className="testcases-suite-name">{suite.name}</div>
                <div className="testcases-suite-meta">
                  {suite.count} test cases
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="page-card testcases-center">
          <div className="testcases-panel-title">Cases</div>

          <div className="clean-table-wrap">
            <table className="clean-table">
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((tc) => (
                  <tr
                    key={tc.id}
                    className={
                      tc.id === selectedCase.id ? "testcase-row-active" : ""
                    }
                  >
                    <td>{tc.id}</td>
                    <td>{tc.title}</td>
                    <td>
                      <span className={`type-pill ${tc.type}`}>{tc.type}</span>
                    </td>
                    <td>{tc.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="page-card testcases-right">
          <div className="testcases-panel-title">Case Details</div>

          <div className="testcases-detail-block">
            <div className="testcases-detail-label">Case ID</div>
            <div className="testcases-detail-value">{selectedCase.id}</div>
          </div>

          <div className="testcases-detail-block">
            <div className="testcases-detail-label">Title</div>
            <div className="testcases-detail-value">{selectedCase.title}</div>
          </div>

          <div className="testcases-detail-block">
            <div className="testcases-detail-label">Endpoint</div>
            <div className="testcases-detail-value">
              {selectedCase.endpoint}
            </div>
          </div>

          <div className="testcases-detail-block">
            <div className="testcases-detail-label">Objective</div>
            <div className="testcases-detail-value">
              {selectedCase.objective}
            </div>
          </div>

          <div className="testcases-ai-note">
            <div className="testcases-detail-label">AI Reasoning</div>
            <div className="testcases-detail-value">
              {selectedCase.reasoning}
            </div>
          </div>
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

function SettingsPage() {
  return (
    <div className="page-card">
      <h3>Settings</h3>
      <p className="muted">
        Organization, default environment, and AI generation settings will go
        here.
      </p>
    </div>
  );
}

export default function App() {
  const [activeNav, setActiveNav] = useState("overview");
  const [selectedProject, setSelectedProject] = useState(null);

  const [generatorSettings, setGeneratorSettings] = useState({
    include: ["contract", "schema"],
    env: "staging",
    auth_profile: "device",
    guidance: "",
    ai: false,
    spec_source: "",
    generation_mode: "balanced",
  });

  const page = useMemo(() => {
    switch (activeNav) {
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
            options={generatorSettings}
          />
        );

      case "testCases":
        return <TestCasesPage projectId={selectedProject} />;

      case "execution":
        return <ExecutionPage />;

      case "reports":
        return <ReportsPage projectId={selectedProject} />;

      case "settings":
        return <SettingsPage />;

      case "overview":
      default:
        return <OverviewPage />;
    }
  }, [activeNav, selectedProject, generatorSettings]);

  return (
    <AppShell activeNav={activeNav} onChangeNav={setActiveNav}>
      {page}
    </AppShell>
  );
}
