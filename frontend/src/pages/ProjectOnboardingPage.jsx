import React, { useMemo, useState } from "react";

const PROGRESS_STEPS = [
  "Reading uploaded materials",
  "Mapping project architecture",
  "Detecting frameworks and dependencies",
  "Finding API and workflow patterns",
  "Checking for RAG, tools, and agents",
  "Inferring testing risks",
  "Building project understanding profile",
];

const INITIAL_FINDINGS = [
  {
    label: "Project type",
    value: "RAG assistant / chatbot",
  },
  {
    label: "Stack detected",
    value: "Python, FastAPI, LangChain, Vector DB",
  },
  {
    label: "Risk areas",
    value: "Hallucination, Prompt Injection, Retrieval Mismatch",
  },
  {
    label: "Likely inputs",
    value: "User query, documents, API payloads",
  },
];

export default function ProjectOnboardingPage() {
  const [githubLink, setGithubLink] = useState("");
  const [apiSpecLink, setApiSpecLink] = useState("");
  const [projectNotes, setProjectNotes] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

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

  const handleAnalyze = () => {
    if (!canAnalyze || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisDone(false);
    setCurrentStep(0);

    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      if (index < PROGRESS_STEPS.length) {
        setCurrentStep(index);
      } else {
        clearInterval(interval);
        setIsAnalyzing(false);
        setAnalysisDone(true);
      }
    }, 850);
  };

  return (
    <div className="io-page">
      <div className="io-shell">
        <aside className="io-sidebar">
          <div className="io-brand">
            <div className="io-brand-mark">I</div>
            <div>
              <div className="io-brand-title">IntOps</div>
              <div className="io-brand-subtitle">
                AI Project Understanding Layer
              </div>
            </div>
          </div>

          <div className="io-side-card">
            <div className="io-side-title">What IntOps will detect</div>
            <div className="io-chip-wrap">
              <span className="io-chip">Project type</span>
              <span className="io-chip">Tech stack</span>
              <span className="io-chip">RAG usage</span>
              <span className="io-chip">Agents / tools</span>
              <span className="io-chip">API patterns</span>
              <span className="io-chip">Workflow pipeline</span>
              <span className="io-chip">Risk areas</span>
              <span className="io-chip">Missing details</span>
            </div>
          </div>

          <div className="io-side-card">
            <div className="io-side-title">Accepted inputs</div>
            <div className="io-side-list">
              <div>PDF / Word docs</div>
              <div>GitHub repository link</div>
              <div>OpenAPI / Swagger URL</div>
              <div>Prompt notes / architecture notes</div>
              <div>Sample requests and responses</div>
            </div>
          </div>
        </aside>

        <main className="io-main">
          <section className="io-hero">
            <div className="io-hero-copy">
              <div className="io-badge">Project Intake</div>
              <h1 className="io-title">
                Analyze your AI project before generating test cases
              </h1>
              <p className="io-subtitle">
                Upload docs, paste a GitHub link, or add your API spec. IntOps
                will understand the project, detect the stack and workflow, and
                build a precise summary for eval and red-team generation.
              </p>
            </div>

            <div className="io-hero-panel">
              <div className="io-mini-stat">
                <span className="io-mini-label">Understanding confidence</span>
                <span className="io-mini-value">
                  {analysisDone ? "82%" : "--"}
                </span>
              </div>
              <div className="io-mini-stat">
                <span className="io-mini-label">AI patterns detected</span>
                <span className="io-mini-value">
                  {analysisDone ? "RAG, APIs" : "--"}
                </span>
              </div>
              <div className="io-mini-stat">
                <span className="io-mini-label">Next step</span>
                <span className="io-mini-value">
                  {analysisDone ? "Generate cases" : "Analyze"}
                </span>
              </div>
            </div>
          </section>

          <section className="io-grid">
            <div className="io-card io-card-form">
              <div className="io-card-head">
                <div>
                  <h2>Project sources</h2>
                  <p>
                    Add whatever you have. IntOps will do the heavy lifting.
                  </p>
                </div>
              </div>

              <div className="io-form-grid">
                <label className="io-field io-upload">
                  <span className="io-label">Upload documents</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.md,.json,.yaml,.yml"
                    onChange={handleFilesChange}
                  />
                  <div className="io-upload-box">
                    <div className="io-upload-title">
                      Drop files here or click to upload
                    </div>
                    <div className="io-upload-sub">
                      PDF, Word, text, JSON, YAML, architecture notes, prompt
                      files
                    </div>
                  </div>
                </label>

                <label className="io-field">
                  <span className="io-label">GitHub repository link</span>
                  <input
                    className="io-input"
                    type="text"
                    placeholder="https://github.com/org/repo"
                    value={githubLink}
                    onChange={(e) => setGithubLink(e.target.value)}
                  />
                </label>

                <label className="io-field">
                  <span className="io-label">API spec URL</span>
                  <input
                    className="io-input"
                    type="text"
                    placeholder="https://example.com/openapi.json"
                    value={apiSpecLink}
                    onChange={(e) => setApiSpecLink(e.target.value)}
                  />
                </label>

                <label className="io-field io-field-full">
                  <span className="io-label">Project notes</span>
                  <textarea
                    className="io-textarea"
                    rows="5"
                    placeholder="Paste architecture notes, feature summary, prompt behavior, or any known details..."
                    value={projectNotes}
                    onChange={(e) => setProjectNotes(e.target.value)}
                  />
                </label>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="io-file-list">
                  {uploadedFiles.map((file) => (
                    <div
                      className="io-file-pill"
                      key={`${file.name}-${file.size}`}
                    >
                      {file.name}
                    </div>
                  ))}
                </div>
              )}

              <div className="io-actions">
                <button
                  className="io-btn io-btn-primary"
                  onClick={handleAnalyze}
                  disabled={!canAnalyze || isAnalyzing}
                >
                  {isAnalyzing ? "Analyzing..." : "Analyze Project"}
                </button>

                <button className="io-btn io-btn-secondary" type="button">
                  Save Draft
                </button>
              </div>
            </div>

            <div className="io-card io-card-status">
              <div className="io-card-head">
                <div>
                  <h2>AI analysis progress</h2>
                  <p>
                    IntOps is building a structured understanding of your
                    project.
                  </p>
                </div>
              </div>

              <div className="io-progress-wrap">
                {PROGRESS_STEPS.map((step, index) => {
                  const active = isAnalyzing && index === currentStep;
                  const done =
                    analysisDone || (isAnalyzing && index < currentStep);

                  return (
                    <div
                      key={step}
                      className={`io-progress-item ${active ? "is-active" : ""} ${
                        done ? "is-done" : ""
                      }`}
                    >
                      <div className="io-progress-dot" />
                      <div className="io-progress-text">{step}</div>
                    </div>
                  );
                })}
              </div>

              <div className="io-live-panel">
                <div className="io-live-title">Live findings</div>
                <div className="io-live-list">
                  {INITIAL_FINDINGS.map((item) => (
                    <div className="io-live-item" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="io-card io-summary-card">
            <div className="io-card-head">
              <div>
                <h2>Detected project summary</h2>
                <p>
                  This structured profile is what IntOps will pass to the next
                  layer for eval and red-team generation.
                </p>
              </div>
            </div>

            <div className="io-summary-grid">
              <div className="io-summary-block">
                <div className="io-summary-label">Project type</div>
                <div className="io-summary-value">
                  {analysisDone ? "RAG assistant / knowledge chatbot" : "--"}
                </div>
              </div>

              <div className="io-summary-block">
                <div className="io-summary-label">Tech stack</div>
                <div className="io-summary-value">
                  {analysisDone ? "Python, FastAPI, LangChain, ChromaDB" : "--"}
                </div>
              </div>

              <div className="io-summary-block">
                <div className="io-summary-label">Inputs</div>
                <div className="io-summary-value">
                  {analysisDone
                    ? "Text queries, uploaded documents, API payloads"
                    : "--"}
                </div>
              </div>

              <div className="io-summary-block">
                <div className="io-summary-label">Outputs</div>
                <div className="io-summary-value">
                  {analysisDone
                    ? "Answer, supporting context, citations"
                    : "--"}
                </div>
              </div>

              <div className="io-summary-block io-summary-block-wide">
                <div className="io-summary-label">Workflow</div>
                <div className="io-summary-value">
                  {analysisDone
                    ? "Document ingestion → embeddings → retrieval → LLM answer generation → API response"
                    : "--"}
                </div>
              </div>

              <div className="io-summary-block io-summary-block-wide">
                <div className="io-summary-label">Risk areas</div>
                <div className="io-tag-wrap">
                  {analysisDone ? (
                    <>
                      <span className="io-tag">Hallucination</span>
                      <span className="io-tag">Prompt Injection</span>
                      <span className="io-tag">Retrieval Mismatch</span>
                      <span className="io-tag">Data Leakage</span>
                    </>
                  ) : (
                    <div className="io-summary-value">--</div>
                  )}
                </div>
              </div>

              <div className="io-summary-block io-summary-block-wide">
                <div className="io-summary-label">Missing information</div>
                <div className="io-summary-value">
                  {analysisDone
                    ? "Guardrails not detected, fallback logic unclear, human review policy not found"
                    : "--"}
                </div>
              </div>
            </div>

            <div className="io-actions io-actions-end">
              <button className="io-btn io-btn-secondary" type="button">
                Edit Summary
              </button>
              <button
                className="io-btn io-btn-primary"
                type="button"
                disabled={!analysisDone}
              >
                Continue to Test Generation
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
