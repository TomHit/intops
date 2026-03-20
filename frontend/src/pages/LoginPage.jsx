import React, { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "../styles/auth.css";

function GoogleMark() {
  return (
    <span className="google-mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path
          fill="#EA4335"
          d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.2-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.5-.2-2.2H12z"
        />
        <path
          fill="#34A853"
          d="M12 22c2.6 0 4.8-.9 6.4-2.5l-3.1-2.4c-.9.6-2 .9-3.3.9-2.5 0-4.7-1.7-5.5-4H3.3v2.5C4.9 19.9 8.2 22 12 22z"
        />
        <path
          fill="#4A90E2"
          d="M6.5 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.5H3.3C2.5 9 2 10.4 2 12s.5 3 1.3 4.5L6.5 14z"
        />
        <path
          fill="#FBBC05"
          d="M12 6c1.4 0 2.6.5 3.6 1.4l2.7-2.7C16.8 3.1 14.6 2 12 2 8.2 2 4.9 4.1 3.3 7.5L6.5 10c.8-2.3 3-4 5.5-4z"
        />
      </svg>
    </span>
  );
}

export default function LoginPage() {
  const { mode } = useParams();
  const navigate = useNavigate();
  const isIndividual = mode === "individual";

  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  const pageMeta = useMemo(() => {
    if (isIndividual) {
      return {
        title: "Sign in to your personal workspace",
        subtitle:
          "Start quickly with Google or continue with your email for a personal API TestOps experience.",
        badge: "INDIVIDUAL ACCESS",
      };
    }

    return {
      title: "Sign in to your organization workspace",
      subtitle:
        "Access projects, teams, and shared API quality workflows for your organization.",
      badge: "ORGANIZATION ACCESS",
    };
  }, [isIndividual]);

  function handleSubmit(e) {
    e.preventDefault();

    if (!form.email.trim()) {
      alert("Email is required.");
      return;
    }

    if (!isIndividual && !form.password.trim()) {
      alert("Password is required.");
      return;
    }

    navigate("/workspace", {
      state: {
        mode,
        email: form.email,
      },
    });
  }

  function handleGoogleClick() {
    alert(
      "This is the frontend UI button for now. In the next step we will connect real Google Identity Services.",
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-bg-orb auth-bg-orb-1" />
      <div className="auth-bg-orb auth-bg-orb-2" />

      <main className="login-layout">
        <section className="login-panel login-panel-brand">
          <div className="auth-hero-topline">{pageMeta.badge}</div>
          <h1>{pageMeta.title}</h1>
          <p className="auth-hero-text">{pageMeta.subtitle}</p>

          <div className="brand-preview-card">
            <div className="brand-preview-top">
              <div className="brand-preview-title">API TestOps</div>
              <div className="brand-preview-chip">
                {isIndividual ? "Personal" : "Team Workspace"}
              </div>
            </div>

            <div className="brand-preview-metrics">
              <div className="brand-preview-metric">
                <span>Projects</span>
                <strong>{isIndividual ? "1+" : "Multiple"}</strong>
              </div>
              <div className="brand-preview-metric">
                <span>Coverage</span>
                <strong>Contract / Negative</strong>
              </div>
              <div className="brand-preview-metric">
                <span>Source</span>
                <strong>OpenAPI / Swagger</strong>
              </div>
            </div>

            <div className="brand-preview-list">
              <div>✓ Structured project workspace</div>
              <div>✓ AI-assisted case generation</div>
              <div>✓ Cleaner onboarding path</div>
            </div>
          </div>

          <Link to="/" className="auth-back-link">
            ← Back to setup selection
          </Link>
        </section>

        <section className="login-panel login-panel-form">
          <div className="login-card">
            <div className="login-card-head">
              <h2>{isIndividual ? "Welcome back" : "Workspace login"}</h2>
              <p>
                {isIndividual
                  ? "Use Google for the fastest sign-in, or continue with email."
                  : "Use your work email to continue into the shared workspace."}
              </p>
            </div>

            {isIndividual ? (
              <>
                <button
                  type="button"
                  className="google-btn"
                  onClick={handleGoogleClick}
                >
                  <GoogleMark />
                  <span>Continue with Google</span>
                </button>

                <div className="auth-divider">
                  <span>or continue with email</span>
                </div>
              </>
            ) : null}

            <form onSubmit={handleSubmit} className="login-form">
              {isIndividual ? (
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, fullName: e.target.value }))
                    }
                    placeholder="Enter your full name"
                  />
                </div>
              ) : null}

              <div className="form-group">
                <label>{isIndividual ? "Email" : "Work Email"}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder={
                    isIndividual ? "you@example.com" : "name@company.com"
                  }
                />
              </div>

              <div className="form-group">
                <label>
                  {isIndividual ? "Password (optional for now)" : "Password"}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder={
                    isIndividual
                      ? "Optional placeholder"
                      : "Enter your password"
                  }
                />
              </div>

              <button
                type="submit"
                className="auth-primary-btn auth-primary-btn-full"
              >
                {isIndividual
                  ? "Continue to Personal Workspace"
                  : "Continue to Organization Workspace"}
              </button>
            </form>

            <div className="login-footnote">
              {isIndividual
                ? "Next step: connect real Google Identity Services sign-in."
                : "Next step: connect organization auth backend and role-based session handling."}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
