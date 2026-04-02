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
          "Move faster with a clean personal setup for API test generation and review.",
        badge: "INDIVIDUAL ACCESS",
        previewChip: "Personal Workspace",
        previewTitle: "Focused for solo API work",
        formTitle: "Continue with Google",
        formText: "Use your Google account to access your personal workspace.",
        submitLabel: "Continue to Personal Workspace",
        footnote: "Google sign-in will be connected in the next step.",
      };
    }

    return {
      title: "Sign in to your organization workspace",
      subtitle:
        "Access shared API quality workflows, teams, and projects in one secure workspace.",
      badge: "ORGANIZATION ACCESS",
      previewChip: "Team Workspace",
      previewTitle: "Built for shared API quality workflows",
      formTitle: "Workspace login",
      formText: "Use your work email to continue into the shared workspace.",
      submitLabel: "Continue to Organization Workspace",
      footnote:
        "Next step: connect organization auth backend and role-based session handling.",
    };
  }, [isIndividual]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.email.trim()) {
      alert("Email is required.");
      return;
    }

    if (!isIndividual && !form.password.trim()) {
      alert("Password is required.");
      return;
    }

    if (isIndividual) {
      navigate("/workspace", {
        state: {
          mode,
          email: form.email,
        },
      });
      return;
    }

    try {
      const res = await fetch("/api/auth/org-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Organization login failed");
      }

      navigate("/workspace", {
        state: {
          mode,
          email: data.user?.email || form.email.trim(),
          user_id: data.user?.user_id || "",
          org_id: data.organization?.org_id || "",
          org_name: data.organization?.name || "",
        },
      });
    } catch (err) {
      alert(err.message || "Login failed");
    }
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

          <h1 className="auth-hero-title">{pageMeta.title}</h1>

          <div className="auth-hero-preview auth-hero-preview-equal">
            <div className="auth-preview-top">
              <div className="auth-preview-brand">API TestOps</div>
              <div className="auth-preview-chip">{pageMeta.previewChip}</div>
            </div>

            <div className="auth-preview-center">
              <div className="auth-preview-orb">✦</div>
              <h3>{pageMeta.previewTitle}</h3>
            </div>
          </div>

          <Link to="/onboarding" className="auth-back-link">
            ← Back to setup selection
          </Link>
        </section>
        <section
          className={`login-panel login-panel-form ${
            isIndividual ? "login-panel-form-individual" : ""
          }`}
        >
          <div className="login-card">
            <div className="login-card-head">
              <h2>{pageMeta.formTitle}</h2>
              <p>{pageMeta.formText}</p>
            </div>

            {isIndividual ? (
              <div className="login-google-only">
                <button
                  type="button"
                  className="google-btn"
                  onClick={handleGoogleClick}
                >
                  <GoogleMark />
                  <span>Continue with Google</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                  <label>Work Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="name@company.com"
                  />
                </div>

                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="Enter your password"
                  />
                </div>

                <button
                  type="submit"
                  className="auth-primary-btn auth-primary-btn-full"
                >
                  {pageMeta.submitLabel}
                </button>
              </form>
            )}

            <div className="login-footnote">{pageMeta.footnote}</div>
          </div>
        </section>
      </main>
    </div>
  );
}
