import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";

function FeaturePill({ children }) {
  return <span className="auth-feature-pill">{children}</span>;
}

function SetupCard({
  eyebrow,
  title,
  description,
  points,
  cta,
  onClick,
  accentClass,
}) {
  return (
    <div className={`setup-card ${accentClass}`}>
      <div className="setup-card-glow" />
      <div className="setup-card-header">
        <div className="setup-card-eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="setup-card-points">
        {points.map((point) => (
          <div key={point} className="setup-card-point">
            <span className="setup-card-check">✓</span>
            <span>{point}</span>
          </div>
        ))}
      </div>

      <button className="auth-primary-btn" onClick={onClick}>
        {cta}
      </button>
    </div>
  );
}

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="auth-shell">
      <div className="auth-bg-orb auth-bg-orb-1" />
      <div className="auth-bg-orb auth-bg-orb-2" />

      <main className="auth-layout auth-layout-wide">
        <section className="auth-hero-card">
          <div className="auth-hero-topline">API TESTOPS ONBOARDING</div>
          <h1>Set up your workspace the right way.</h1>
          <p className="auth-hero-text">
            Choose a flow that matches how you build APIs. Teams get
            organization structure, projects, and collaboration. Individual
            users get a faster path with personal setup and Google sign-in.
          </p>

          <div className="auth-feature-row">
            <FeaturePill>OpenAPI import</FeaturePill>
            <FeaturePill>AI-generated test cases</FeaturePill>
            <FeaturePill>CSV / JSON export</FeaturePill>
            <FeaturePill>Project-based workflow</FeaturePill>
          </div>

          <div className="setup-grid">
            <SetupCard
              eyebrow="For teams"
              title="Organization"
              description="Best for QA teams, engineering groups, and companies managing multiple APIs, environments, and projects."
              points={[
                "Create organization and team structure",
                "Map projects to teams",
                "Manage multiple API programs centrally",
                "Ready for future SSO / workspace roles",
              ]}
              cta="Continue as Organization"
              accentClass="setup-card-org"
              onClick={() => navigate("/login/organization")}
            />

            <SetupCard
              eyebrow="For solo users"
              title="Individual"
              description="Best for freelancers, solo developers, consultants, and personal API test generation."
              points={[
                "Skip org and team setup",
                "Start directly with your first project",
                "Fast path with Google sign-in",
                "Personal workspace experience",
              ]}
              cta="Continue as Individual"
              accentClass="setup-card-individual"
              onClick={() => navigate("/login/individual")}
            />
          </div>
        </section>

        <aside className="auth-side-card">
          <div className="auth-side-section">
            <h3>How setup works</h3>

            <div className="timeline-list">
              <div className="timeline-item">
                <div className="timeline-dot" />
                <div>
                  <strong>Organization flow</strong>
                  <p>Create organization → add teams → create project</p>
                </div>
              </div>

              <div className="timeline-item">
                <div className="timeline-dot" />
                <div>
                  <strong>Individual flow</strong>
                  <p>Sign in → create project → generate tests</p>
                </div>
              </div>

              <div className="timeline-item">
                <div className="timeline-dot" />
                <div>
                  <strong>Same destination</strong>
                  <p>Both flows reach the same Generate Tests workspace.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-side-section">
            <h3>Why this platform</h3>
            <div className="mini-stat-grid">
              <div className="mini-stat-card">
                <span>Spec-first</span>
                <strong>OpenAPI</strong>
              </div>
              <div className="mini-stat-card">
                <span>Output</span>
                <strong>JSON / CSV</strong>
              </div>
              <div className="mini-stat-card">
                <span>Coverage</span>
                <strong>Contract + Negative</strong>
              </div>
              <div className="mini-stat-card">
                <span>Workflow</span>
                <strong>Project based</strong>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
