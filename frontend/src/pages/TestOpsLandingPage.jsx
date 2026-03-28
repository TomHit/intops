import React from "react";
import "./testOpsLandingPage.css";
import { useNavigate } from "react-router-dom";
const sampleRows = [
  {
    title: "Validate successful login response",
    type: "contract",
    endpoint: "POST /auth/login",
    priority: "P1",
  },
  {
    title: "Reject request when password is missing",
    type: "negative",
    endpoint: "POST /auth/login",
    priority: "P1",
  },
  {
    title: "Validate response schema for user profile",
    type: "schema",
    endpoint: "GET /users/{id}",
    priority: "P2",
  },
  {
    title: "Reject invalid path parameter for user lookup",
    type: "negative",
    endpoint: "GET /users/{id}",
    priority: "P2",
  },
];

const steps = [
  "Upload OpenAPI / Swagger spec",
  "Select endpoints you want to test",
  "Generate structured test cases instantly",
  "Review and export to your QA workflow",
];

export default function TestOpsLandingPage() {
  const navigate = useNavigate();
  return (
    <div className="tol-page">
      <header className="tol-header">
        <div className="tol-brand">
          <img src="/intops-logo.png" alt="IntOps" className="tol-brand-logo" />
        </div>

        <nav className="tol-nav">
          <a href="#problem">Problem</a>
          <a href="#demo">Demo</a>
          <a href="#how">How it works</a>
          <a href="#cta">Try it</a>
        </nav>
      </header>

      <main>
        <section className="tol-hero tol-hero-top">
          <div className="tol-hero-visual tol-hero-visual-top">
            <div className="tol-hero-art">
              <div className="tol-hero-art-glow tol-hero-art-glow-a" />
              <div className="tol-hero-art-glow tol-hero-art-glow-b" />
              <div className="tol-hero-art-glow tol-hero-art-glow-c" />

              <div className="tol-hero-art-inner">
                <div className="tol-hero-art-left">
                  <div className="tol-hero-mini-line short" />
                  <div className="tol-hero-mini-line mid" />

                  <div className="tol-hero-mini-box tol-hero-intelligence-box">
                    <div className="tol-hero-upload-orb tol-hero-ai-orb">✦</div>
                    <div className="tol-hero-upload-title">
                      TestOps Intelligence
                    </div>
                  </div>

                  <div
                    className="tol-hero-mini-line long"
                    style={{ marginTop: 16 }}
                  />
                  <div className="tol-hero-mini-line mid" />
                </div>

                <div className="tol-hero-art-right">
                  <div className="tol-hero-mini-chip-row"></div>

                  <div className="tol-hero-mini-row tol-hero-float-row">
                    <span className="tol-hero-row-label">Smart generation</span>
                  </div>

                  <div className="tol-hero-mini-row tol-hero-float-row delay-2">
                    <span className="tol-hero-row-label">Automation</span>
                  </div>

                  <div className="tol-hero-mini-row short tol-hero-float-row delay-3">
                    <span className="tol-hero-row-label">Scale in cloud</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="tol-hero-copy tol-hero-copy-right">
            <h1>
              Stop Writing Test Cases
              <span> by Hand.</span>
            </h1>

            <p className="tol-hero-text">
              Turn OpenAPI and Swagger specs into structured, review-ready test
              cases with readable steps, expected results, and negative
              scenarios—so your team spends less time documenting and more time
              testing.
            </p>

            <div className="tol-hero-actions">
              <button
                type="button"
                className="tol-btn tol-btn-primary"
                onClick={() => navigate("/onboarding")}
              >
                Try the Live Generator
              </button>
              <button type="button" className="tol-btn tol-btn-secondary">
                View Sample Output
              </button>
            </div>
          </div>
        </section>

        <section className="tol-demo-section">
          <div className="tol-demo-shell tol-demo-shell-wide">
            <div className="tol-demo-topbar">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
              <div className="tol-demo-url">app.testops.dev/generate</div>
            </div>

            <div className="tol-demo-body">
              <aside className="tol-demo-sidebar">
                <div className="tol-panel-title">Upload spec</div>

                <div className="tol-upload-box">
                  <div className="tol-upload-icon">↑</div>
                  <div className="tol-upload-title">Drop OpenAPI file here</div>
                  <div className="tol-upload-meta">
                    JSON / YAML / URL import
                  </div>
                </div>

                <div className="tol-panel-title tol-mt">Detected endpoints</div>
                <div className="tol-endpoint-pill active">POST /auth/login</div>
                <div className="tol-endpoint-pill">GET /users/{"{id}"}</div>
                <div className="tol-endpoint-pill">PUT /profile</div>
                <div className="tol-endpoint-pill">
                  DELETE /sessions/{"{id}"}
                </div>
              </aside>

              <section className="tol-demo-main">
                <div className="tol-main-header">
                  <div>
                    <div className="tol-panel-title">Generated test cases</div>
                    <div className="tol-panel-subtitle">
                      Structured output your QA team can review and use
                    </div>
                  </div>

                  <button type="button" className="tol-btn tol-btn-small">
                    Export CSV
                  </button>
                </div>

                <div className="tol-table-wrap">
                  <table className="tol-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Endpoint</th>
                        <th>Priority</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sampleRows.map((row) => (
                        <tr key={`${row.title}-${row.endpoint}`}>
                          <td>{row.title}</td>
                          <td>
                            <span className={`tol-chip ${row.type}`}>
                              {row.type}
                            </span>
                          </td>
                          <td>{row.endpoint}</td>
                          <td>{row.priority}</td>
                          <td>
                            <button type="button" className="tol-link-btn">
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="tol-drawer">
                  <div className="tol-panel-title">
                    Reject request when password is missing
                  </div>

                  <div className="tol-drawer-grid">
                    <div>
                      <div className="tol-drawer-label">Objective</div>
                      <p>
                        Verify that the login endpoint rejects requests when the
                        required password field is not sent.
                      </p>
                    </div>

                    <div>
                      <div className="tol-drawer-label">Expected results</div>
                      <p>
                        Request is rejected, failure response is returned, and
                        documented error behavior is preserved.
                      </p>
                    </div>
                  </div>

                  <div className="tol-drawer-label">Steps</div>
                  <ol className="tol-ordered">
                    <li>Set HTTP method to POST.</li>
                    <li>Use endpoint path /auth/login.</li>
                    <li>Provide body without the password field.</li>
                    <li>Send the request.</li>
                  </ol>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section id="problem" className="tol-section">
          <div className="tol-section-head">
            <div className="tol-kicker">The problem</div>
            <h2>Manual test case writing is eating your sprint.</h2>
            <p>
              QA teams lose execution time because test case creation is still a
              repetitive documentation task instead of a fast generation flow.
            </p>
          </div>

          <div className="tol-grid-three">
            <div className="tol-info-card">
              <div className="tol-info-icon">⏱</div>
              <h3>Hours lost per endpoint</h3>
              <p>
                Teams spend 4–5 hours manually writing cases in Jira for each
                new or changed API flow.
              </p>
            </div>

            <div className="tol-info-card">
              <div className="tol-info-icon">⚠</div>
              <h3>Coverage breaks under pressure</h3>
              <p>
                Validation, negative, and edge scenarios get missed when sprint
                time gets tight.
              </p>
            </div>

            <div className="tol-info-card">
              <div className="tol-info-icon">🚧</div>
              <h3>QA becomes the bottleneck</h3>
              <p>
                Delivery moves fast, but manual test design slows execution and
                increases release risk.
              </p>
            </div>
          </div>
        </section>

        <section className="tol-section tol-dark-band">
          <div className="tol-before-after">
            <div className="tol-compare-card">
              <div className="tol-compare-title">Before TestOps</div>
              <ul>
                <li>Read story and API spec manually</li>
                <li>Write each case in Jira by hand</li>
                <li>Lose time before execution starts</li>
                <li>Miss negative and validation coverage</li>
              </ul>
            </div>

            <div className="tol-big-shift">
              <div className="tol-shift-label">Sprint shift</div>
              <div className="tol-shift-value">Hours → Minutes</div>
              <p>
                Move from repetitive test documentation to usable structured
                output.
              </p>
            </div>

            <div className="tol-compare-card">
              <div className="tol-compare-title">After TestOps</div>
              <ul>
                <li>Upload OpenAPI spec</li>
                <li>Select endpoints</li>
                <li>Generate structured cases instantly</li>
                <li>Review, export, and start execution faster</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="demo" className="tol-section">
          <div className="tol-section-head">
            <div className="tol-kicker">What makes it different</div>
            <h2>Not generic AI. Not random output.</h2>
            <p>
              Built to generate readable, structured, QA-ready test cases that
              teams can actually review and use.
            </p>
          </div>

          <div className="tol-grid-four">
            <div className="tol-feature-card">
              <h3>Structured</h3>
              <p>
                Readable title, objective, steps, expected results, and data.
              </p>
            </div>
            <div className="tol-feature-card">
              <h3>Scenario-aware</h3>
              <p>Contract, schema, and negative cases generated with intent.</p>
            </div>
            <div className="tol-feature-card">
              <h3>QA workflow focused</h3>
              <p>
                Made for review, export, and sprint execution—not just demos.
              </p>
            </div>
            <div className="tol-feature-card">
              <h3>Future-ready</h3>
              <p>Starts with API and grows into UI and automation workflows.</p>
            </div>
          </div>
        </section>

        <section id="how" className="tol-section">
          <div className="tol-section-head">
            <div className="tol-kicker">How it works</div>
            <h2>Simple flow. Real output.</h2>
          </div>

          <div className="tol-steps">
            {steps.map((item, index) => (
              <div className="tol-step-card" key={item}>
                <div className="tol-step-index">0{index + 1}</div>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="tol-section">
          <div className="tol-section-head">
            <div className="tol-kicker">Built for more than one persona</div>
            <h2>Works for individual testers and growing teams.</h2>
          </div>

          <div className="tol-grid-three">
            <div className="tol-audience-card">
              <h3>Individual testers</h3>
              <p>
                Save time, reduce repetitive documentation, and improve test
                case consistency.
              </p>
            </div>
            <div className="tol-audience-card">
              <h3>QA teams</h3>
              <p>
                Standardize quality, reduce sprint bottlenecks, and improve
                coverage across endpoints.
              </p>
            </div>
            <div className="tol-audience-card">
              <h3>Engineering leaders</h3>
              <p>
                Improve release confidence and create a stronger test design
                foundation for scale.
              </p>
            </div>
          </div>
        </section>

        <section id="cta" className="tol-section tol-final-cta">
          <div className="tol-final-box">
            <div className="tol-kicker">Ready to test the idea?</div>
            <h2>
              If your API changes every sprint,
              <span> your test design should not stay manual.</span>
            </h2>
            <p>
              Start with a spec. Leave with structured test cases your team can
              review, export, and use.
            </p>

            <div className="tol-hero-actions center">
              <button
                type="button"
                className="tol-btn tol-btn-primary"
                onClick={() => navigate("/onboarding")}
              >
                Try the Live Generator
              </button>
              <button type="button" className="tol-btn tol-btn-secondary">
                Request Early Access
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
