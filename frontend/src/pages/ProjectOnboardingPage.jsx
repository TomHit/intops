import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function prettyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function ProjectOnboardingPage({ onContinueToGeneration }) {
  const navigate = useNavigate();
  const [githubLink, setGithubLink] = useState("");
  const [apiSpecLink, setApiSpecLink] = useState("");
  const [projectNotes, setProjectNotes] = useState("");
  const [jiraLink, setJiraLink] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");

  const canAnalyze = useMemo(() => {
    return (
      uploadedFiles.length > 0 ||
      githubLink.trim() ||
      apiSpecLink.trim() ||
      projectNotes.trim() ||
      jiraLink.trim()
    );
  }, [uploadedFiles, githubLink, apiSpecLink, projectNotes, jiraLink]);

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(files);
  };

  async function handleAnalyze() {
    if (!canAnalyze || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisError("");
    setAnalysisResult(null);
    setActiveTab("summary");

    try {
      let data = null;

      if (uploadedFiles.length > 0) {
        const formData = new FormData();
        formData.append("file", uploadedFiles[0]);

        if (projectNotes.trim()) {
          formData.append("project_notes", projectNotes.trim());
        }

        if (githubLink.trim()) {
          formData.append("github_link", githubLink.trim());
        }

        if (apiSpecLink.trim()) {
          formData.append("api_spec_link", apiSpecLink.trim());
        }

        if (jiraLink.trim()) {
          formData.append("jira_url", jiraLink.trim());
        }

        const res = await fetch("/api/analyze-document", {
          method: "POST",
          body: formData,
        });

        const text = await res.text();

        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          throw new Error(text || "Document analysis failed.");
        }

        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || "Document analysis failed.");
        }

        setAnalysisResult(data?.data?.analysis || data?.data || null);
      } else {
        const res = await fetch("/api/project-analysis", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            project_notes: projectNotes || "",
            github_link: githubLink || "",
            api_spec_link: apiSpecLink || "",
            jira_url: jiraLink || "",
          }),
        });

        const text = await res.text();

        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          throw new Error(text || "Project analysis failed.");
        }

        if (!res.ok) {
          throw new Error(data?.message || "Project analysis failed.");
        }

        setAnalysisResult(data?.data?.analysis || data?.data || data || null);
      }
    } catch (err) {
      setAnalysisError(err.message || "Project analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  }
  const projectCard = analysisResult?.projectCard || null;
  const confidence = analysisResult?.confidence;

  const executiveSummary =
    analysisResult?.executive_summary || analysisResult?.summary || "";

  const qaSummary = analysisResult?.qa_summary || "";

  return (
    <div style={styles.page}>
      <style>{`
        @media (max-width: 1320px) {
          .io-main-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 1200px) {
  .io-hero-title {
    font-size: 34px !important;
    line-height: 1.12 !important;
  }
}
@media (max-width: 640px) {
  .io-hero-title {
    font-size: 28px !important;
    line-height: 1.16 !important;
  }
}
        @media (max-width: 980px) {
          .io-top-row {
            grid-template-columns: 1fr !important;
          }
          .io-metric-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .io-quick-stats {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 900px) {
  .io-flow-strip {
    grid-template-columns: 1fr !important;
    row-gap: 10px !important;
  }
  .io-flow-divider {
    display: none !important;
  }
}
        @media (max-width: 640px) {
          .io-metric-grid {
            grid-template-columns: 1fr !important;
          }
          .io-card-grid {
            grid-template-columns: 1fr !important;
          }
          .io-form-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div style={styles.pageGlowOne} />
      <div style={styles.pageGlowTwo} />

      <div style={styles.shell}>
        <div className="io-top-row" style={styles.topRow}>
          <section style={styles.heroCard}>
            <div style={styles.brandRow}>
              <div style={styles.brandMark}>I</div>
              <div>
                <div style={styles.brandTitle}>IntOps</div>
                <div style={styles.brandSub}>
                  AI Project Understanding Layer
                </div>
              </div>
            </div>

            <div style={styles.heroBadge}>Project Analysis</div>

            <h1 className="io-hero-title" style={styles.heroTitle}>
              Analyze your project first.
              <br />
              Generate eval and red-team cases after understanding.
            </h1>

            <p style={styles.heroText}>
              Upload documents, link your repository, add your API spec, or
              paste project notes. IntOps turns raw project input into a
              structured summary that can guide downstream test generation.
            </p>

            <div className="io-flow-strip" style={styles.flowStrip}>
              <div style={styles.flowStepActive}>1. Add sources</div>
              <div className="io-flow-divider" style={styles.flowDivider} />
              <div
                style={
                  analysisResult ? styles.flowStepDone : styles.flowStepPending
                }
              >
                2. Review analysis
              </div>
              <div style={styles.flowDivider} />
              <div
                style={
                  analysisResult
                    ? styles.flowStepActive
                    : styles.flowStepPending
                }
              >
                3. Continue to generation
              </div>
            </div>

            <div className="io-metric-grid" style={styles.metricGrid}>
              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>Confidence</div>
                <div style={styles.metricValue}>
                  {typeof confidence === "number"
                    ? `${Math.round(confidence * 100)}%`
                    : "--"}
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>Project type</div>
                <div style={styles.metricValueSmall}>
                  {projectCard?.project_type || "--"}
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>Risk tags</div>
                <div style={styles.metricValue}>
                  {Array.isArray(projectCard?.risk_tags)
                    ? projectCard.risk_tags.length
                    : "--"}
                </div>
              </div>
            </div>
          </section>

          <section style={styles.intakeCard}>
            <div style={styles.sectionHead}>
              <div>
                <div style={styles.sectionEyebrow}>Project intake</div>
                <h2 style={styles.sectionTitle}>Sources</h2>
                <p style={styles.sectionText}>
                  Add one or more sources. The backend will analyze real inputs
                  and return a project-aware summary.
                </p>
              </div>
            </div>

            <div className="io-form-grid" style={styles.formGrid}>
              <label style={styles.fieldFull}>
                <span style={styles.label}>Upload documents</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md,.json,.yaml,.yml"
                  onChange={handleFilesChange}
                  style={{ display: "none" }}
                  id="project-upload-input"
                />
                <label htmlFor="project-upload-input" style={styles.uploadBox}>
                  <div style={styles.uploadTitle}>
                    Drop files here or click to upload
                  </div>
                  <div style={styles.uploadSub}>
                    PDF, Word, text, JSON, YAML, architecture notes, product
                    summaries, PRDs, and prompt files
                  </div>
                </label>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>GitHub repository link</span>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="https://github.com/org/repo"
                  value={githubLink}
                  onChange={(e) => setGithubLink(e.target.value)}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Jira story link</span>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="https://your-company.atlassian.net/browse/ABC-123"
                  value={jiraLink}
                  onChange={(e) => setJiraLink(e.target.value)}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>API spec URL</span>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="https://example.com/openapi.json"
                  value={apiSpecLink}
                  onChange={(e) => setApiSpecLink(e.target.value)}
                />
              </label>

              <label style={styles.fieldFull}>
                <span style={styles.label}>Project notes</span>
                <textarea
                  style={styles.textarea}
                  rows={6}
                  placeholder="Paste architecture notes, AI flow, business purpose, user journeys, constraints, or system summary..."
                  value={projectNotes}
                  onChange={(e) => setProjectNotes(e.target.value)}
                />
              </label>
            </div>

            {uploadedFiles.length > 0 ? (
              <div style={styles.fileWrap}>
                {uploadedFiles.map((file) => (
                  <div
                    key={`${file.name}-${file.size}`}
                    style={styles.filePill}
                  >
                    {file.name}
                  </div>
                ))}
              </div>
            ) : null}

            <div style={styles.actionRow}>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!canAnalyze || isAnalyzing}
                style={{
                  ...styles.primaryBtn,
                  ...styles.analyzeBtn,
                  opacity: !canAnalyze || isAnalyzing ? 0.7 : 1,
                  cursor:
                    !canAnalyze || isAnalyzing ? "not-allowed" : "pointer",
                }}
              >
                {isAnalyzing ? "Analyzing..." : "Analyze Project"}
              </button>

              <button type="button" style={styles.secondaryBtn}>
                Save Draft
              </button>
            </div>

            {analysisError ? (
              <div style={styles.errorBox}>{analysisError}</div>
            ) : null}
          </section>
        </div>

        <div className="io-main-grid" style={styles.mainGrid}>
          <section style={styles.analysisCard}>
            {isAnalyzing ? (
              <div style={styles.stateCard}>
                <div style={styles.stateBadge}>Running</div>
                <div style={styles.stateTitle}>Analysis in progress</div>
                <div style={styles.stateText}>
                  We are extracting project intent, workflow hints, risks, and
                  structured QA context from your inputs.
                </div>
              </div>
            ) : analysisResult ? (
              <div style={styles.stateCard}>
                <div style={styles.stateBadgeSuccess}>Ready</div>
                <div style={styles.stateTitle}>Analysis complete</div>
                <div style={styles.stateText}>
                  Review the summary and structured project card, then continue
                  into the workspace to generate tests.
                </div>

                <div className="io-quick-stats" style={styles.quickStats}>
                  <div style={styles.quickStat}>
                    <div style={styles.quickStatLabel}>Confidence</div>
                    <div style={styles.quickStatValue}>
                      {typeof confidence === "number"
                        ? `${Math.round(confidence * 100)}%`
                        : "--"}
                    </div>
                  </div>

                  <div style={styles.quickStat}>
                    <div style={styles.quickStatLabel}>Project type</div>
                    <div style={styles.quickStatValueSmall}>
                      {projectCard?.project_type || "--"}
                    </div>
                  </div>

                  <div style={styles.quickStat}>
                    <div style={styles.quickStatLabel}>Risk tags</div>
                    <div style={styles.quickStatValue}>
                      {Array.isArray(projectCard?.risk_tags)
                        ? projectCard.risk_tags.length
                        : "--"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={styles.stateCard}>
                <div style={styles.stateBadgeMuted}>Waiting</div>
                <div style={styles.stateTitle}>Add inputs to begin</div>
                <div style={styles.stateText}>
                  Upload files, paste notes, or provide repo/spec links to
                  generate an intelligent project summary.
                </div>
              </div>
            )}
          </section>

          <section style={styles.outputCard}>
            <div style={styles.outputTop}>
              <div>
                <div style={styles.sectionEyebrow}>Output</div>
                <h2 style={styles.outputTitleDark}>Analysis output</h2>
                <p style={styles.outputTextDark}>
                  Review the executive summary, QA view, and structured project
                  card before generating tests.
                </p>
              </div>

              <div style={styles.tabRow}>
                <button
                  type="button"
                  onClick={() => setActiveTab("summary")}
                  style={{
                    ...styles.tabBtn,
                    ...(activeTab === "summary" ? styles.tabBtnActive : {}),
                  }}
                >
                  Summary
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("card")}
                  style={{
                    ...styles.tabBtn,
                    ...(activeTab === "card" ? styles.tabBtnActive : {}),
                  }}
                >
                  Project Card
                </button>
              </div>
            </div>

            <div style={styles.outputBody}>
              {!analysisResult ? (
                <div style={styles.emptyHero}>
                  <div style={styles.emptyTitle}>No real output yet</div>
                  <div style={styles.emptyText}>
                    Run analysis to render the executive summary, QA context,
                    and structured project card here.
                  </div>
                </div>
              ) : activeTab === "summary" ? (
                <>
                  <div style={styles.summaryPanel}>
                    <div style={styles.summaryTitle}>Executive Summary</div>
                    <div style={styles.summaryText}>
                      {executiveSummary || "--"}
                    </div>
                  </div>

                  <div style={styles.summaryPanel}>
                    <div style={styles.summaryTitle}>QA Summary</div>
                    <pre style={styles.codeBlock}>{qaSummary || "--"}</pre>
                  </div>

                  <div className="io-card-grid" style={styles.cardGrid}>
                    <div style={styles.infoCard}>
                      <div style={styles.infoLabel}>Project type</div>
                      <div style={styles.infoValue}>
                        {projectCard?.project_type || "--"}
                      </div>
                    </div>

                    <div style={styles.infoCard}>
                      <div style={styles.infoLabel}>Confidence</div>
                      <div style={styles.infoValue}>
                        {typeof confidence === "number"
                          ? `${Math.round(confidence * 100)}%`
                          : "--"}
                      </div>
                    </div>

                    <div style={styles.infoCardWide}>
                      <div style={styles.infoLabel}>Workflow</div>
                      <div style={styles.infoValue}>
                        {Array.isArray(
                          projectCard?.context_workflow?.business_flow_hints,
                        ) &&
                        projectCard.context_workflow.business_flow_hints
                          .length > 0
                          ? projectCard.context_workflow.business_flow_hints
                              .slice(0, 6)
                              .map((item) => String(item).replaceAll("_", " "))
                              .join(" → ")
                          : Array.isArray(projectCard?.workflow) &&
                              projectCard.workflow.length > 0
                            ? projectCard.workflow
                                .slice(0, 6)
                                .map((item) =>
                                  String(item).replaceAll("_", " "),
                                )
                                .join(" → ")
                            : "--"}
                      </div>
                    </div>

                    <div style={styles.infoCardWide}>
                      <div style={styles.infoLabel}>Risk tags</div>
                      <div style={styles.tagWrap}>
                        {Array.isArray(projectCard?.risk_tags) &&
                        projectCard.risk_tags.length ? (
                          projectCard.risk_tags.map((item) => (
                            <span key={item} style={styles.riskTag}>
                              {item}
                            </span>
                          ))
                        ) : (
                          <div style={styles.infoValue}>--</div>
                        )}
                      </div>
                    </div>

                    <div style={styles.infoCardWide}>
                      <div style={styles.infoLabel}>Missing</div>
                      <div style={styles.tagWrap}>
                        {Array.isArray(projectCard?.missing) &&
                        projectCard.missing.length ? (
                          projectCard.missing.map((item) => (
                            <span key={item} style={styles.softTag}>
                              {item}
                            </span>
                          ))
                        ) : (
                          <div style={styles.infoValue}>--</div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={styles.codePanel}>
                  <div style={styles.codeTitle}>Structured Project Card</div>
                  <pre style={styles.codeBlock}>
                    {prettyJson(projectCard || {})}
                  </pre>
                </div>
              )}
            </div>

            <div style={styles.outputActions}>
              <button type="button" style={styles.secondaryBtn}>
                Edit Summary
              </button>

              <button
                type="button"
                style={{
                  ...styles.primaryBtn,
                  ...styles.continueBtn,
                  ...(!analysisResult ? styles.continueBtnDisabled : {}),
                }}
                onClick={() => {
                  if (!analysisResult) return;

                  if (typeof onContinueToGeneration === "function") {
                    onContinueToGeneration();
                    return;
                  }

                  navigate("/workspace");
                }}
                disabled={!analysisResult}
                title={
                  analysisResult
                    ? "Continue to workspace"
                    : "Run project analysis first to continue"
                }
              >
                <span>
                  {analysisResult
                    ? "Continue to Generation"
                    : "Analyze to Continue"}
                </span>
                <span style={styles.continueArrow}>→</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    position: "relative",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(38, 99, 255, 0.16), transparent 28%), linear-gradient(180deg, #071122 0%, #0b1427 100%)",
    padding: "28px",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  pageGlowOne: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 380,
    height: 380,
    borderRadius: "50%",
    background: "rgba(79, 124, 255, 0.15)",
    filter: "blur(80px)",
    pointerEvents: "none",
  },
  pageGlowTwo: {
    position: "absolute",
    right: -120,
    top: 120,
    width: 360,
    height: 360,
    borderRadius: "50%",
    background: "rgba(24, 87, 255, 0.12)",
    filter: "blur(100px)",
    pointerEvents: "none",
  },
  shell: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1520,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  topRow: {
    display: "grid",
    gridTemplateColumns: "1.08fr 0.92fr",
    gap: 24,
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "0.78fr 1.22fr",
    gap: 24,
    alignItems: "start",
  },
  heroCard: {
    border: "1px solid rgba(151, 181, 255, 0.18)",
    borderRadius: 30,
    padding: 32,
    background:
      "linear-gradient(180deg, rgba(10, 20, 39, 0.94) 0%, rgba(10, 22, 42, 0.86) 100%)",
    boxShadow: "0 28px 80px rgba(0, 0, 0, 0.30)",
    color: "#ffffff",
    backdropFilter: "blur(14px)",
  },
  intakeCard: {
    border: "1px solid rgba(151, 181, 255, 0.18)",
    borderRadius: 30,
    padding: 28,
    background: "rgba(10, 18, 33, 0.86)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 28px 80px rgba(0, 0, 0, 0.26)",
  },
  analysisCard: {
    border: "1px solid rgba(151, 181, 255, 0.16)",
    borderRadius: 30,
    padding: 28,
    background: "rgba(10, 18, 33, 0.86)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 28px 80px rgba(0, 0, 0, 0.26)",
  },
  outputCard: {
    border: "1px solid rgba(151, 181, 255, 0.16)",
    borderRadius: 30,
    padding: 32,
    background:
      "linear-gradient(180deg, rgba(248, 251, 255, 0.99) 0%, rgba(239, 245, 255, 0.97) 100%)",
    boxShadow: "0 28px 80px rgba(0, 0, 0, 0.18)",
    minHeight: 760,
    display: "flex",
    flexDirection: "column",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 28,
  },
  brandMark: {
    width: 58,
    height: 58,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    fontSize: 28,
    fontWeight: 900,
    color: "#ffffff",
    background:
      "linear-gradient(135deg, #4f7cff 0%, #2463ff 52%, #123fa8 100%)",
    boxShadow: "0 18px 40px rgba(36, 99, 255, 0.35)",
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  brandSub: {
    fontSize: 13,
    color: "rgba(203, 216, 255, 0.78)",
    marginTop: 2,
  },
  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    height: 36,
    padding: "0 14px",
    borderRadius: 999,
    background: "rgba(98, 138, 255, 0.12)",
    border: "1px solid rgba(129, 163, 255, 0.22)",
    color: "#a8c2ff",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 18,
  },
  heroTitle: {
    margin: 0,
    fontSize: 40,
    lineHeight: 1.08,
    letterSpacing: "-0.04em",
    fontWeight: 900,
    maxWidth: 700,
  },
  heroText: {
    margin: "16px 0 0 0",
    color: "rgba(219, 228, 255, 0.82)",
    fontSize: 16,
    lineHeight: 1.75,
    maxWidth: 700,
  },
  flowStrip: {
    display: "grid",
    gridTemplateColumns: "max-content 24px max-content 24px max-content",
    alignItems: "center",
    columnGap: 12,
    rowGap: 0,
    marginTop: 24,
    paddingTop: 20,
    borderTop: "1px solid rgba(151, 181, 255, 0.12)",
  },
  flowStepActive: {
    height: 34,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 14px",
    borderRadius: 999,
    background: "rgba(79, 124, 255, 0.18)",
    border: "1px solid rgba(129, 163, 255, 0.24)",
    color: "#eaf1ff",
    fontSize: 13,
    fontWeight: 800,
  },
  flowStepDone: {
    height: 34,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 14px",
    borderRadius: 999,
    background: "rgba(36, 197, 94, 0.14)",
    border: "1px solid rgba(74, 222, 128, 0.24)",
    color: "#dfffea",
    fontSize: 13,
    fontWeight: 800,
  },
  flowStepPending: {
    height: 34,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 14px",
    borderRadius: 999,
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(151, 181, 255, 0.12)",
    color: "rgba(214, 228, 255, 0.72)",
    fontSize: 13,
    fontWeight: 700,
  },
  flowDivider: {
    width: 24,
    height: 1,
    background: "rgba(151, 181, 255, 0.22)",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
    marginTop: 28,
  },
  metricCard: {
    padding: "18px 18px 16px 18px",
    borderRadius: 22,
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(162, 184, 255, 0.12)",
  },
  metricLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(199, 213, 255, 0.72)",
    fontWeight: 700,
  },
  metricValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: 900,
    color: "#ffffff",
    letterSpacing: "-0.03em",
  },
  metricValueSmall: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: 900,
    color: "#ffffff",
    letterSpacing: "-0.03em",
    lineHeight: 1.3,
  },
  sectionHead: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 22,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#7ea3ff",
    marginBottom: 8,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.15,
    letterSpacing: "-0.03em",
    fontWeight: 900,
    color: "#f5f8ff",
  },
  outputTitleDark: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.15,
    letterSpacing: "-0.03em",
    fontWeight: 900,
    color: "#102a56",
  },
  sectionText: {
    margin: "8px 0 0 0",
    color: "rgba(205, 214, 233, 0.76)",
    fontSize: 15,
    lineHeight: 1.6,
  },
  outputTextDark: {
    margin: "8px 0 0 0",
    color: "#5c7396",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 680,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  fieldFull: {
    gridColumn: "1 / -1",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: 800,
    color: "#dce8ff",
    letterSpacing: "0.01em",
  },
  input: {
    height: 54,
    borderRadius: 16,
    border: "1px solid rgba(154, 178, 227, 0.18)",
    background: "rgba(255, 255, 255, 0.05)",
    color: "#f3f7ff",
    fontSize: 15,
    padding: "0 16px",
    outline: "none",
    boxSizing: "border-box",
  },
  textarea: {
    minHeight: 146,
    borderRadius: 18,
    border: "1px solid rgba(154, 178, 227, 0.18)",
    background: "rgba(255, 255, 255, 0.05)",
    color: "#f3f7ff",
    fontSize: 15,
    padding: 16,
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
    lineHeight: 1.6,
  },
  uploadBox: {
    minHeight: 132,
    borderRadius: 20,
    border: "1px dashed rgba(135, 167, 243, 0.34)",
    background:
      "linear-gradient(180deg, rgba(36, 61, 104, 0.24) 0%, rgba(17, 29, 52, 0.22) 100%)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    padding: 18,
    cursor: "pointer",
    boxSizing: "border-box",
  },
  uploadTitle: {
    color: "#f5f8ff",
    fontSize: 16,
    fontWeight: 800,
  },
  uploadSub: {
    marginTop: 8,
    color: "rgba(203, 214, 236, 0.74)",
    fontSize: 13,
    lineHeight: 1.5,
    maxWidth: 520,
  },
  fileWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  filePill: {
    height: 34,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 12px",
    borderRadius: 999,
    background: "rgba(91, 129, 221, 0.16)",
    border: "1px solid rgba(136, 165, 236, 0.22)",
    color: "#dce8ff",
    fontSize: 13,
    fontWeight: 700,
  },
  actionRow: {
    display: "flex",
    gap: 12,
    marginTop: 24,
    flexWrap: "wrap",
  },
  primaryBtn: {
    height: 52,
    borderRadius: 16,
    border: "none",
    padding: "0 20px",
    background:
      "linear-gradient(135deg, #4f7cff 0%, #2563ff 52%, #1544b5 100%)",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    boxShadow: "0 18px 40px rgba(37, 99, 255, 0.34)",
    cursor: "pointer",
    transition:
      "transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease",
  },
  analyzeBtn: {
    minWidth: 170,
    justifyContent: "center",
  },
  secondaryBtn: {
    height: 52,
    borderRadius: 16,
    border: "1px solid rgba(155, 176, 216, 0.32)",
    padding: "0 18px",
    background: "rgba(255, 255, 255, 0.05)",
    color: "#eef4ff",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
  },
  errorBox: {
    marginTop: 16,
    borderRadius: 16,
    padding: "14px 16px",
    background: "rgba(120, 22, 22, 0.26)",
    border: "1px solid rgba(255, 120, 120, 0.30)",
    color: "#ffd7d7",
    fontSize: 14,
    fontWeight: 700,
  },
  stateCard: {
    borderRadius: 22,
    padding: 22,
    background:
      "linear-gradient(180deg, rgba(17, 31, 56, 0.78) 0%, rgba(12, 22, 41, 0.88) 100%)",
    border: "1px solid rgba(145, 172, 232, 0.14)",
  },
  stateBadge: {
    display: "inline-flex",
    alignItems: "center",
    height: 28,
    padding: "0 12px",
    borderRadius: 999,
    background: "rgba(79, 124, 255, 0.16)",
    border: "1px solid rgba(129, 163, 255, 0.22)",
    color: "#dce8ff",
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 14,
  },
  stateBadgeSuccess: {
    display: "inline-flex",
    alignItems: "center",
    height: 28,
    padding: "0 12px",
    borderRadius: 999,
    background: "rgba(34, 197, 94, 0.16)",
    border: "1px solid rgba(74, 222, 128, 0.24)",
    color: "#ddffea",
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 14,
  },
  stateBadgeMuted: {
    display: "inline-flex",
    alignItems: "center",
    height: 28,
    padding: "0 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(151, 181, 255, 0.12)",
    color: "#d6e4ff",
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 14,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#ffffff",
  },
  stateText: {
    marginTop: 10,
    color: "rgba(201, 212, 235, 0.72)",
    fontSize: 14,
    lineHeight: 1.7,
  },
  quickStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginTop: 18,
  },
  quickStat: {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(145, 172, 232, 0.12)",
  },
  quickStatLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(199, 213, 255, 0.68)",
    fontWeight: 700,
  },
  quickStatValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: 900,
    color: "#ffffff",
    letterSpacing: "-0.03em",
  },
  quickStatValueSmall: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: 800,
    color: "#ffffff",
    lineHeight: 1.35,
  },
  outputTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 22,
  },
  tabRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  tabBtn: {
    height: 38,
    padding: "0 14px",
    borderRadius: 999,
    border: "1px solid rgba(155, 176, 216, 0.48)",
    background: "rgba(255,255,255,0.66)",
    color: "#35507c",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  tabBtnActive: {
    background: "#173d82",
    color: "#ffffff",
    border: "1px solid #173d82",
  },
  outputBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  emptyHero: {
    borderRadius: 24,
    border: "1px dashed #c6d3ea",
    background: "rgba(255,255,255,0.58)",
    minHeight: 280,
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    padding: 28,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: 900,
    color: "#102a56",
    letterSpacing: "-0.03em",
  },
  emptyText: {
    marginTop: 12,
    maxWidth: 640,
    color: "#516a90",
    fontSize: 15,
    lineHeight: 1.7,
  },
  summaryPanel: {
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #dbe6f5",
    padding: 24,
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.07)",
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#102a56",
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 1.75,
    color: "#435c81",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  infoCard: {
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #dbe6f5",
    padding: 18,
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
  },
  infoCardWide: {
    gridColumn: "1 / -1",
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #dbe6f5",
    padding: 18,
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#5a7498",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  infoValue: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 1.65,
    color: "#102a56",
    fontWeight: 800,
  },
  tagWrap: {
    marginTop: 12,
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  softTag: {
    height: 32,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 12px",
    borderRadius: 999,
    background: "#eff5ff",
    border: "1px solid #d7e3f9",
    color: "#294b83",
    fontSize: 13,
    fontWeight: 700,
  },
  riskTag: {
    height: 32,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 12px",
    borderRadius: 999,
    background: "#fff1f1",
    border: "1px solid #ffd6d6",
    color: "#8f2d2d",
    fontSize: 13,
    fontWeight: 800,
  },
  codePanel: {
    borderRadius: 24,
    background: "#0f172a",
    border: "1px solid #26334f",
    padding: 20,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: 420,
  },
  codeTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "#e7efff",
    marginBottom: 14,
  },
  codeBlock: {
    margin: 0,
    flex: 1,
    overflowX: "auto",
    overflowY: "auto",
    borderRadius: 14,
    background: "#0b1220",
    color: "#e6edf3",
    padding: 14,
    fontSize: 12.5,
    lineHeight: 1.6,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    border: "1px solid rgba(148, 163, 184, 0.12)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  outputActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 22,
    flexWrap: "wrap",
  },
  continueBtn: {
    minWidth: 240,
    justifyContent: "center",
    padding: "0 24px",
  },
  continueBtnDisabled: {
    background: "linear-gradient(135deg, #94a3b8 0%, #7b8798 100%)",
    boxShadow: "none",
    cursor: "not-allowed",
    opacity: 0.75,
  },
  continueArrow: {
    fontSize: 18,
    lineHeight: 1,
  },
};
