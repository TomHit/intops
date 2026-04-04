import React, { useMemo, useState } from "react";

function prettyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function ProjectOnboardingPage({ onContinueToGeneration }) {
  const [githubLink, setGithubLink] = useState("");
  const [apiSpecLink, setApiSpecLink] = useState("");
  const [projectNotes, setProjectNotes] = useState("");
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
      projectNotes.trim()
    );
  }, [uploadedFiles, githubLink, apiSpecLink, projectNotes]);

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
      const payload = {
        github_link: githubLink.trim(),
        api_spec_link: apiSpecLink.trim(),
        project_notes: projectNotes.trim(),
        uploaded_files: uploadedFiles.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type,
        })),
      };

      const res = await fetch("/api/project-analysis", {
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
        throw new Error(data?.message || "Project analysis failed.");
      }

      setAnalysisResult(data || null);
    } catch (err) {
      setAnalysisError(err.message || "Project analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  const projectCard = analysisResult?.projectCard || null;
  const confidence = analysisResult?.confidence;
  const summary = analysisResult?.summary || "";
  const signals = analysisResult?.signals || null;

  return (
    <div style={styles.page}>
      <style>{`
        @media (max-width: 1320px) {
          .io-main-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 860px) {
          .io-top-row {
            grid-template-columns: 1fr !important;
          }
          .io-metric-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .io-metric-grid {
            grid-template-columns: 1fr !important;
          }
          .io-card-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

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
            <h1 style={styles.heroTitle}>
              Analyze your project first. Generate eval and red-team cases after
              understanding.
            </h1>
            <p style={styles.heroText}>
              Upload your docs, repo link, API spec, or notes. IntOps will build
              a real project summary and structured project card from your
              analysis backend.
            </p>

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
                  Add whatever you have. The backend will analyze real inputs.
                </p>
              </div>
            </div>

            <div style={styles.formGrid}>
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
                    PDF, Word, text, JSON, YAML, architecture notes, prompt
                    files
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
                  rows={5}
                  placeholder="Paste architecture notes, AI flow, business purpose, or system summary..."
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
            <div style={styles.sectionHead}>
              <div>
                <div style={styles.sectionEyebrow}>Analysis state</div>
                <h2 style={styles.sectionTitle}>Backend response</h2>
                <p style={styles.sectionText}>
                  No fake progress. Only real request state and real response.
                </p>
              </div>
            </div>

            {isAnalyzing ? (
              <div style={styles.stateCard}>
                <div style={styles.stateTitle}>Analysis in progress</div>
                <div style={styles.stateText}>
                  Waiting for the backend intelligence layer to return summary
                  and project card.
                </div>
              </div>
            ) : analysisResult ? (
              <div style={styles.findingsPanel}>
                <div style={styles.findingsTitle}>Returned signals</div>
                <pre style={styles.signalBlock}>{prettyJson(signals)}</pre>
              </div>
            ) : (
              <div style={styles.stateCard}>
                <div style={styles.stateTitle}>No analysis yet</div>
                <div style={styles.stateText}>
                  Add source data and run analysis to populate this section.
                </div>
              </div>
            )}
          </section>

          <section style={styles.outputCard}>
            <div style={styles.outputTop}>
              <div>
                <div style={styles.sectionEyebrow}>Output</div>
                <h2 style={styles.outputTitleDark}>
                  Project summary + project card
                </h2>
                <p style={styles.outputTextDark}>
                  This is the real analysis output that should drive test
                  generation.
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
                    This panel will render only backend-returned data.
                  </div>
                </div>
              ) : activeTab === "summary" ? (
                <>
                  <div style={styles.summaryPanel}>
                    <div style={styles.summaryTitle}>Project Summary</div>
                    <div style={styles.summaryText}>{summary || "--"}</div>
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
                        {Array.isArray(projectCard?.workflow) &&
                        projectCard.workflow.length
                          ? projectCard.workflow.join(" → ")
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
                style={styles.primaryBtn}
                onClick={() => {
                  if (typeof onContinueToGeneration === "function") {
                    onContinueToGeneration();
                  }
                }}
                disabled={!analysisResult}
              >
                Continue to Generation
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
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(38, 99, 255, 0.14), transparent 28%), linear-gradient(180deg, #071122 0%, #0b1427 100%)",
    padding: "28px",
    boxSizing: "border-box",
  },
  shell: {
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
      "linear-gradient(180deg, rgba(10, 20, 39, 0.92) 0%, rgba(10, 22, 42, 0.82) 100%)",
    boxShadow: "0 28px 80px rgba(0, 0, 0, 0.30)",
    color: "#ffffff",
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
    padding: 28,
    background:
      "linear-gradient(180deg, rgba(244, 248, 255, 0.98) 0%, rgba(235, 242, 252, 0.96) 100%)",
    boxShadow: "0 28px 80px rgba(0, 0, 0, 0.26)",
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
    width: 52,
    height: 52,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    fontSize: 24,
    fontWeight: 900,
    color: "#ffffff",
    background:
      "linear-gradient(135deg, #4f7cff 0%, #2463ff 52%, #123fa8 100%)",
    boxShadow: "0 18px 40px rgba(36, 99, 255, 0.35)",
  },
  brandTitle: {
    fontSize: 24,
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
    height: 34,
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
    fontSize: 42,
    lineHeight: 1.08,
    letterSpacing: "-0.04em",
    fontWeight: 900,
    maxWidth: 760,
  },
  heroText: {
    margin: "18px 0 0 0",
    color: "rgba(219, 228, 255, 0.82)",
    fontSize: 17,
    lineHeight: 1.7,
    maxWidth: 820,
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
    height: 52,
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
    minHeight: 138,
    borderRadius: 18,
    border: "1px solid rgba(154, 178, 227, 0.18)",
    background: "rgba(255, 255, 255, 0.05)",
    color: "#f3f7ff",
    fontSize: 15,
    padding: 16,
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
  },
  uploadBox: {
    minHeight: 122,
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
    height: 50,
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
  },
  secondaryBtn: {
    height: 50,
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
    padding: 20,
    background:
      "linear-gradient(180deg, rgba(17, 31, 56, 0.78) 0%, rgba(12, 22, 41, 0.88) 100%)",
    border: "1px solid rgba(145, 172, 232, 0.14)",
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
  findingsPanel: {
    borderRadius: 22,
    padding: 18,
    background:
      "linear-gradient(180deg, rgba(17, 31, 56, 0.78) 0%, rgba(12, 22, 41, 0.88) 100%)",
    border: "1px solid rgba(145, 172, 232, 0.14)",
  },
  findingsTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#f3f7ff",
    marginBottom: 14,
  },
  signalBlock: {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#d6e4ff",
    fontSize: 13,
    lineHeight: 1.7,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
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
    padding: 22,
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
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
    overflow: "auto",
    borderRadius: 18,
    background: "#08101f",
    color: "#cfe0ff",
    padding: 18,
    fontSize: 13,
    lineHeight: 1.7,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  outputActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 22,
    flexWrap: "wrap",
  },
};
