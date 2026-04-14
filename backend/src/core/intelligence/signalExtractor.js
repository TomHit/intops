const OPENAPI_SOURCE_WEIGHT = 1.0;
const NOTES_SOURCE_WEIGHT = 0.85;
const GITHUB_SOURCE_WEIGHT = 0.75;

const DOMAIN_KEYWORDS = {
  banking_finance: [
    "account",
    "accounts",
    "payment",
    "payments",
    "payment_intent",
    "paymentintent",
    "charge",
    "charges",
    "invoice",
    "invoices",
    "subscription",
    "subscriptions",
    "balance",
    "balances",
    "payout",
    "payouts",
    "refund",
    "refunds",
    "transfer",
    "transfers",
    "settlement",
    "settlements",
    "wallet",
    "bank",
    "banking",
    "card",
    "cards",
    "transaction",
    "transactions",
    "credit",
    "debit",
    "billing",
    "checkout",
    "treasury",
    "financial",
    "finance",
    "tax",
    "taxes",
  ],
  retail_commerce: [
    "order",
    "orders",
    "cart",
    "checkout",
    "catalog",
    "inventory",
    "shipment",
    "shipping",
    "product",
    "products",
    "price",
    "prices",
    "merchant",
    "store",
    "coupon",
    "discount",
    "return",
    "returns",
  ],
  healthcare: [
    "patient",
    "patients",
    "appointment",
    "appointments",
    "doctor",
    "doctors",
    "provider",
    "providers",
    "clinical",
    "medical",
    "diagnosis",
    "ehr",
    "emr",
    "lab",
    "labs",
    "prescription",
    "prescriptions",
    "pharmacy",
    "insurance",
    "claim",
    "claims",
  ],
  identity_access: [
    "auth",
    "authentication",
    "authorization",
    "oauth",
    "token",
    "tokens",
    "identity",
    "identities",
    "user",
    "users",
    "login",
    "logout",
    "session",
    "sessions",
    "role",
    "roles",
    "permission",
    "permissions",
    "access",
    "mfa",
    "sso",
  ],
  messaging: [
    "message",
    "messages",
    "conversation",
    "conversations",
    "chat",
    "thread",
    "threads",
    "email",
    "emails",
    "sms",
    "notification",
    "notifications",
    "webhook",
    "webhooks",
  ],
  analytics: [
    "analytics",
    "metric",
    "metrics",
    "report",
    "reports",
    "dashboard",
    "dashboards",
    "insight",
    "insights",
    "event",
    "events",
    "tracking",
    "telemetry",
    "monitoring",
    "usage",
    "summary",
    "aggregation",
  ],
  document_management: [
    "document",
    "documents",
    "file",
    "files",
    "upload",
    "uploads",
    "folder",
    "folders",
    "storage",
    "attachment",
    "attachments",
    "pdf",
    "docx",
    "archive",
    "archives",
  ],
};

const AI_KEYWORDS = {
  rag_core: [
    "rag",
    "retrieval augmented generation",
    "retrieval",
    "rerank",
    "grounding",
    "citation",
    "citations",
    "knowledge base",
    "semantic search",
    "vector",
    "vector store",
    "embedding",
    "embeddings",
    "chunk",
    "chunks",
  ],
  llm_core: [
    "llm",
    "large language model",
    "prompt",
    "prompts",
    "completion",
    "completions",
    "assistant",
    "assistants",
    "chat completion",
    "chat completions",
    "model",
    "models",
    "inference",
    "generation",
  ],
  ml_core: [
    "predict",
    "prediction",
    "predictions",
    "classify",
    "classification",
    "score",
    "scoring",
    "forecast",
    "recommendation",
    "recommender",
    "train",
    "training",
    "classifier",
  ],
};

const WORKFLOW_KEYWORDS = {
  ingest: ["ingest", "upload", "parse", "extract", "import"],
  retrieve: ["retrieve", "search", "query", "lookup", "fetch", "rerank"],
  llm: ["llm", "prompt", "completion", "generate", "assistant", "chat"],
  predict: ["predict", "forecast", "score", "classify", "recommend"],
  authenticate: [
    "auth",
    "authenticate",
    "authorization",
    "oauth",
    "token",
    "login",
  ],
  webhook: ["webhook", "event", "events", "callback"],
  process: [
    "process",
    "processing",
    "execute",
    "handle",
    "orchestrate",
    "submit",
    "confirm",
  ],
  validate: [
    "validate",
    "validation",
    "verify",
    "verification",
    "check",
    "screen",
  ],
  respond: ["response", "respond", "return", "result", "output", "status"],
};

const RISK_KEYWORDS = {
  auth_authz: ["auth", "authorization", "oauth", "token", "api key", "bearer"],
  input_validation: [
    "validation",
    "schema",
    "required",
    "format",
    "constraint",
  ],
  rate_limiting: ["rate limit", "throttle", "429"],
  idempotency: ["idempotency", "idempotent"],
  sensitive_data_exposure: [
    "card",
    "bank",
    "account",
    "pii",
    "personal data",
    "financial",
  ],
  webhook_integrity: ["webhook", "signature", "event verification"],
  file_upload_security: ["upload", "file", "multipart", "binary", "document"],
  prompt_injection: ["prompt injection", "jailbreak"],
  hallucination: ["hallucination"],
  retrieval_mismatch: ["retrieval", "grounding", "citation", "semantic search"],
  document_poisoning: ["document poisoning", "poisoned document"],
};

function toLower(value) {
  return String(value || "").toLowerCase();
}

function pushUnique(arr, value) {
  if (!value) return;
  if (!arr.includes(value)) arr.push(value);
}

function addEvidence(bucket, term, source, weight = 1, meta = {}) {
  if (!term) return;
  if (!bucket[term]) {
    bucket[term] = {
      score: 0,
      sources: {},
      examples: [],
      ...meta,
    };
  }

  bucket[term].score += weight;
  bucket[term].sources[source] = (bucket[term].sources[source] || 0) + weight;

  if (meta.example) {
    pushUnique(bucket[term].examples, meta.example);
  }
}

function countKeywordHits(text, keywords = []) {
  let count = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) count += 1;
  }
  return count;
}

function collectMatches(text, keywords = []) {
  const matches = [];
  for (const keyword of keywords) {
    if (text.includes(keyword)) matches.push(keyword);
  }
  return matches;
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value || {}).toLowerCase();
  } catch {
    return "";
  }
}

function extractSchemaNames(openapi = {}) {
  const schemas = openapi?.components?.schemas || {};
  return Object.keys(schemas);
}

function extractSecurityTypes(openapi = {}) {
  const schemes = openapi?.components?.securitySchemes || {};
  const found = [];

  for (const [schemeName, scheme] of Object.entries(schemes)) {
    const type = toLower(scheme?.type);
    const schemeType = toLower(scheme?.scheme);
    const name = `${schemeName} ${type} ${schemeType}`.trim();

    if (name) found.push(name);
  }

  return found;
}

function normalizeGithubText(githubData) {
  if (!githubData) return "";
  if (typeof githubData === "string") return githubData.toLowerCase();

  const parts = [];

  const maybePush = (value) => {
    if (!value) return;
    if (typeof value === "string") {
      parts.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(maybePush);
      return;
    }
    if (typeof value === "object") {
      Object.values(value).forEach(maybePush);
    }
  };

  maybePush(githubData);
  return parts.join(" ").toLowerCase();
}

function getTopTerms(bucket, limit = 12) {
  return Object.entries(bucket)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([term, data]) => ({
      term,
      score: Number(data.score.toFixed(2)),
      sources: data.sources,
      examples: data.examples || [],
    }));
}

function getTopScoredKeys(scoreMap = {}, limit = 5) {
  return Object.entries(scoreMap)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, limit)
    .map(([key, score]) => ({
      key,
      score: Number((score || 0).toFixed(2)),
    }));
}

function computeCompositeSignals(scores = {}) {
  const domain = scores.domain || {};
  const ai = scores.ai || {};
  const workflow = scores.workflow || {};
  const risk = scores.risk || {};

  const ragStrength =
    (ai.rag || 0) + (workflow.retrieve || 0) + (workflow.ingest || 0);

  const llmStrength = ai.llm || 0;
  const mlStrength = ai.ml || 0;

  return {
    rag_strength: Number(ragStrength.toFixed(2)),
    llm_strength: Number(llmStrength.toFixed(2)),
    ml_strength: Number(mlStrength.toFixed(2)),
    is_ai_system: ragStrength >= 3 || llmStrength >= 2 || mlStrength >= 2,
    dominant_domain:
      Object.entries(domain).sort(
        (a, b) => (b[1] || 0) - (a[1] || 0),
      )[0]?.[0] || "unknown",
    dominant_risks: Object.entries(risk)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, 5)
      .map(([key]) => key),
  };
}

export function extractSignals(input = {}) {
  const {
    openapi = null,
    projectNotes = "",
    githubData = null,
    documentsText = "",
  } = input;

  const paths = openapi?.paths || {};
  const schemaNames = extractSchemaNames(openapi);
  const securityTypes = extractSecurityTypes(openapi);

  const notesText = toLower(projectNotes);
  const githubText = normalizeGithubText(githubData);
  const docsText = toLower(documentsText);

  const signals = {
    sources: {
      openapi: { present: !!openapi, confidence: !!openapi ? 0.95 : 0 },
      docs: { present: !!documentsText, confidence: !!documentsText ? 0.8 : 0 },
      github: { present: !!githubData, confidence: !!githubData ? 0.75 : 0 },
      notes: { present: !!projectNotes, confidence: !!projectNotes ? 0.85 : 0 },
    },

    analysisMode: "unknown",

    hasChat: false,
    hasSearch: false,
    hasUpload: false,
    hasPredict: false,
    hasTextInput: false,
    hasFileInput: false,
    hasAuth: false,

    endpoints: [],
    projectNotes,
    githubData,

    evidence: {
      domain_terms: {},
      api_patterns: {},
      ai_terms: {},
      workflow_terms: {},
      risk_terms: {},
      repo_terms: {},
      resource_terms: {},
    },

    scores: {
      domain: {},
      ai: {},
      workflow: {},
      risk: {},
    },

    detected: {
      resources: [],
      auth: [],
      transports: [],
      formats: [],
      schemaNames,
    },

    rawText: {
      notes: notesText,
      github: githubText,
      docs: docsText,
    },
  };

  const activeSources = Object.entries(signals.sources)
    .filter(([, value]) => value.present)
    .map(([key]) => key);

  if (activeSources.length === 1) {
    signals.analysisMode = `${activeSources[0]}_only`;
  } else if (activeSources.length > 1) {
    signals.analysisMode = "multi_source";
  }

  const securitySchemes = openapi?.components?.securitySchemes || {};
  const rootSecurity = openapi?.security || [];

  if (Object.keys(securitySchemes).length > 0 || rootSecurity.length > 0) {
    signals.hasAuth = true;
  }

  for (const securityType of securityTypes) {
    pushUnique(signals.detected.auth, securityType);
    addEvidence(
      signals.evidence.api_patterns,
      securityType,
      "openapi",
      OPENAPI_SOURCE_WEIGHT,
      {
        example: "securitySchemes",
      },
    );
  }

  for (const schemaName of schemaNames) {
    const lowerName = toLower(schemaName);
    pushUnique(signals.detected.resources, schemaName);

    addEvidence(
      signals.evidence.resource_terms,
      lowerName,
      "openapi",
      OPENAPI_SOURCE_WEIGHT * 0.8,
      { example: `schema:${schemaName}` },
    );
  }

  for (const [path, methods] of Object.entries(paths)) {
    const normalizedMethods = methods || {};

    for (const [method, endpoint] of Object.entries(normalizedMethods)) {
      if (!endpoint || typeof endpoint !== "object") continue;

      const lowerPath = toLower(path);
      const summary = toLower(endpoint.summary);
      const description = toLower(endpoint.description);
      const operationId = toLower(endpoint.operationId);
      const tagsText = Array.isArray(endpoint.tags)
        ? endpoint.tags.join(" ").toLowerCase()
        : "";

      const parameters = Array.isArray(endpoint.parameters)
        ? endpoint.parameters
        : [];
      const paramsStr = safeJsonStringify(parameters);
      const requestBody = endpoint.requestBody?.content || {};
      const responses = endpoint.responses || {};
      const responseStr = safeJsonStringify(responses);

      const contentTypes = Object.keys(requestBody);
      const requestBodyText = contentTypes
        .map((contentType) => {
          const content = requestBody[contentType] || {};
          const schema = content.schema || {};
          return `${contentType} ${safeJsonStringify(schema)}`;
        })
        .join(" ");

      const combinedText = [
        lowerPath,
        summary,
        description,
        operationId,
        tagsText,
        paramsStr,
        requestBodyText,
        responseStr,
      ]
        .filter(Boolean)
        .join(" ");

      signals.endpoints.push({
        path,
        method: method.toUpperCase(),
        summary: endpoint.summary || "",
      });

      if (
        combinedText.includes("chat") ||
        combinedText.includes("message") ||
        combinedText.includes("conversation") ||
        combinedText.includes("assistant")
      ) {
        signals.hasChat = true;
      }

      if (
        combinedText.includes("search") ||
        combinedText.includes("query") ||
        combinedText.includes("retrieve") ||
        combinedText.includes("retrieval") ||
        combinedText.includes("lookup")
      ) {
        signals.hasSearch = true;
      }

      if (
        combinedText.includes("upload") ||
        combinedText.includes("file") ||
        combinedText.includes("document") ||
        combinedText.includes("ingest") ||
        combinedText.includes("multipart/form-data")
      ) {
        signals.hasUpload = true;
        signals.hasFileInput = true;
      }

      if (
        combinedText.includes("predict") ||
        combinedText.includes("prediction") ||
        combinedText.includes("inference") ||
        combinedText.includes("classification") ||
        combinedText.includes("score") ||
        combinedText.includes("forecast")
      ) {
        signals.hasPredict = true;
      }

      if (
        combinedText.includes("text") ||
        combinedText.includes("message") ||
        combinedText.includes("prompt") ||
        combinedText.includes("query") ||
        combinedText.includes("input")
      ) {
        signals.hasTextInput = true;
      }

      if (Array.isArray(endpoint.security) && endpoint.security.length > 0) {
        signals.hasAuth = true;
      }

      for (const contentType of contentTypes) {
        const lowerType = toLower(contentType);
        pushUnique(signals.detected.formats, lowerType);

        addEvidence(
          signals.evidence.api_patterns,
          lowerType,
          "openapi",
          OPENAPI_SOURCE_WEIGHT * 0.7,
          {
            example: `${method.toUpperCase()} ${path}`,
          },
        );

        if (lowerType.includes("json")) {
          pushUnique(signals.detected.transports, "json");
        }
        if (lowerType.includes("multipart/form-data")) {
          pushUnique(signals.detected.transports, "multipart");
        }
        if (lowerType.includes("application/x-www-form-urlencoded")) {
          pushUnique(signals.detected.transports, "form");
        }
      }

      const pathTokens = lowerPath
        .split(/[\/{}_\-]+/)
        .map((token) => token.trim())
        .filter(Boolean);

      for (const token of pathTokens) {
        if (token.length < 3) continue;

        addEvidence(
          signals.evidence.resource_terms,
          token,
          "openapi",
          OPENAPI_SOURCE_WEIGHT,
          { example: `${method.toUpperCase()} ${path}` },
        );

        pushUnique(signals.detected.resources, token);
      }

      for (const [domainName, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
        const hits = collectMatches(combinedText, keywords);
        if (hits.length === 0) continue;

        signals.scores.domain[domainName] =
          (signals.scores.domain[domainName] || 0) +
          hits.length * OPENAPI_SOURCE_WEIGHT;

        for (const hit of hits) {
          addEvidence(
            signals.evidence.domain_terms,
            hit,
            "openapi",
            OPENAPI_SOURCE_WEIGHT,
            {
              example: `${method.toUpperCase()} ${path}`,
            },
          );
        }
      }

      const ragHits = collectMatches(combinedText, AI_KEYWORDS.rag_core);
      const llmHits = collectMatches(combinedText, AI_KEYWORDS.llm_core);
      const mlHits = collectMatches(combinedText, AI_KEYWORDS.ml_core);

      for (const hit of ragHits) {
        signals.scores.ai.rag =
          (signals.scores.ai.rag || 0) + OPENAPI_SOURCE_WEIGHT;
        addEvidence(
          signals.evidence.ai_terms,
          hit,
          "openapi",
          OPENAPI_SOURCE_WEIGHT,
          {
            example: `${method.toUpperCase()} ${path}`,
          },
        );
      }

      for (const hit of llmHits) {
        signals.scores.ai.llm =
          (signals.scores.ai.llm || 0) + OPENAPI_SOURCE_WEIGHT;
        addEvidence(
          signals.evidence.ai_terms,
          hit,
          "openapi",
          OPENAPI_SOURCE_WEIGHT,
          {
            example: `${method.toUpperCase()} ${path}`,
          },
        );
      }

      for (const hit of mlHits) {
        signals.scores.ai.ml =
          (signals.scores.ai.ml || 0) + OPENAPI_SOURCE_WEIGHT;
        addEvidence(
          signals.evidence.ai_terms,
          hit,
          "openapi",
          OPENAPI_SOURCE_WEIGHT,
          {
            example: `${method.toUpperCase()} ${path}`,
          },
        );
      }

      for (const [workflowStep, keywords] of Object.entries(
        WORKFLOW_KEYWORDS,
      )) {
        const hits = collectMatches(combinedText, keywords);
        if (hits.length === 0) continue;

        signals.scores.workflow[workflowStep] =
          (signals.scores.workflow[workflowStep] || 0) +
          hits.length * OPENAPI_SOURCE_WEIGHT;

        for (const hit of hits) {
          addEvidence(
            signals.evidence.workflow_terms,
            hit,
            "openapi",
            OPENAPI_SOURCE_WEIGHT,
            {
              example: `${method.toUpperCase()} ${path}`,
            },
          );
        }
      }

      for (const [riskName, keywords] of Object.entries(RISK_KEYWORDS)) {
        const hits = collectMatches(combinedText, keywords);
        if (hits.length === 0) continue;

        signals.scores.risk[riskName] =
          (signals.scores.risk[riskName] || 0) +
          hits.length * OPENAPI_SOURCE_WEIGHT;

        for (const hit of hits) {
          addEvidence(
            signals.evidence.risk_terms,
            hit,
            "openapi",
            OPENAPI_SOURCE_WEIGHT,
            {
              example: `${method.toUpperCase()} ${path}`,
            },
          );
        }
      }
    }
  }

  const sourceTextConfigs = [
    { source: "notes", text: notesText, weight: NOTES_SOURCE_WEIGHT },
    { source: "github", text: githubText, weight: GITHUB_SOURCE_WEIGHT },
    { source: "docs", text: docsText, weight: NOTES_SOURCE_WEIGHT },
  ];

  for (const { source, text, weight } of sourceTextConfigs) {
    if (!text) continue;

    for (const [domainName, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      const hits = collectMatches(text, keywords);
      if (hits.length === 0) continue;

      signals.scores.domain[domainName] =
        (signals.scores.domain[domainName] || 0) + hits.length * weight;

      for (const hit of hits) {
        addEvidence(signals.evidence.domain_terms, hit, source, weight, {
          example: source,
        });
      }
    }

    for (const hit of collectMatches(text, AI_KEYWORDS.rag_core)) {
      signals.scores.ai.rag = (signals.scores.ai.rag || 0) + weight;
      addEvidence(signals.evidence.ai_terms, hit, source, weight, {
        example: source,
      });
    }

    for (const hit of collectMatches(text, AI_KEYWORDS.llm_core)) {
      signals.scores.ai.llm = (signals.scores.ai.llm || 0) + weight;
      addEvidence(signals.evidence.ai_terms, hit, source, weight, {
        example: source,
      });
    }

    for (const hit of collectMatches(text, AI_KEYWORDS.ml_core)) {
      signals.scores.ai.ml = (signals.scores.ai.ml || 0) + weight;
      addEvidence(signals.evidence.ai_terms, hit, source, weight, {
        example: source,
      });
    }

    for (const [workflowStep, keywords] of Object.entries(WORKFLOW_KEYWORDS)) {
      const hits = collectMatches(text, keywords);
      if (hits.length === 0) continue;

      signals.scores.workflow[workflowStep] =
        (signals.scores.workflow[workflowStep] || 0) + hits.length * weight;

      for (const hit of hits) {
        addEvidence(signals.evidence.workflow_terms, hit, source, weight, {
          example: source,
        });
      }
    }

    for (const [riskName, keywords] of Object.entries(RISK_KEYWORDS)) {
      const hits = collectMatches(text, keywords);
      if (hits.length === 0) continue;

      signals.scores.risk[riskName] =
        (signals.scores.risk[riskName] || 0) + hits.length * weight;

      for (const hit of hits) {
        addEvidence(signals.evidence.risk_terms, hit, source, weight, {
          example: source,
        });
      }
    }
  }

  if (signals.hasAuth) {
    signals.scores.risk.auth_authz =
      (signals.scores.risk.auth_authz || 0) + 1.5;
  }

  if (signals.hasFileInput) {
    signals.scores.risk.file_upload_security =
      (signals.scores.risk.file_upload_security || 0) + 1.5;
  }

  if (signals.hasUpload) {
    signals.scores.workflow.ingest =
      (signals.scores.workflow.ingest || 0) + 1.0;
  }

  if (signals.hasSearch) {
    signals.scores.workflow.retrieve =
      (signals.scores.workflow.retrieve || 0) + 1.0;
  }

  if (signals.hasChat) {
    signals.scores.workflow.llm = (signals.scores.workflow.llm || 0) + 0.75;
  }

  if (signals.hasPredict) {
    signals.scores.workflow.predict =
      (signals.scores.workflow.predict || 0) + 1.0;
  }

  const repoIndicators = [
    "langchain",
    "llamaindex",
    "pinecone",
    "weaviate",
    "milvus",
    "faiss",
    "chromadb",
    "openai",
    "anthropic",
    "cohere",
    "redis",
    "bullmq",
    "queue",
    "worker",
    "embedding",
    "vector",
  ];

  for (const indicator of repoIndicators) {
    if (githubText.includes(indicator)) {
      addEvidence(
        signals.evidence.repo_terms,
        indicator,
        "github",
        GITHUB_SOURCE_WEIGHT,
        {
          example: "github",
        },
      );
    }
  }

  signals.topEvidence = {
    domain_terms: getTopTerms(signals.evidence.domain_terms, 12),
    ai_terms: getTopTerms(signals.evidence.ai_terms, 12),
    workflow_terms: getTopTerms(signals.evidence.workflow_terms, 12),
    risk_terms: getTopTerms(signals.evidence.risk_terms, 12),
    resource_terms: getTopTerms(signals.evidence.resource_terms, 15),
    repo_terms: getTopTerms(signals.evidence.repo_terms, 12),
    api_patterns: getTopTerms(signals.evidence.api_patterns, 12),
  };

  signals.workflow_model = getTopScoredKeys(signals.scores.workflow, 6).map(
    ({ key }) => key,
  );

  signals.system_profile = {
    dominant_domain:
      getTopScoredKeys(signals.scores.domain, 1)[0]?.key || "unknown",
    primary_workflows: signals.workflow_model,
    primary_risks: getTopScoredKeys(signals.scores.risk, 5).map(
      ({ key }) => key,
    ),
    interaction_modes: [
      signals.hasChat ? "chat" : null,
      signals.hasSearch ? "search" : null,
      signals.hasUpload ? "upload" : null,
      signals.hasPredict ? "predict" : null,
      signals.hasAuth ? "authenticated" : null,
    ].filter(Boolean),
  };

  signals.composite = computeCompositeSignals(signals.scores);

  signals.flags = {
    openapiOnly:
      signals.sources.openapi.present &&
      !signals.sources.docs.present &&
      !signals.sources.github.present &&
      !signals.sources.notes.present,

    hasStrongRagHints:
      (signals.scores.ai.rag || 0) >= 4 &&
      (signals.scores.workflow.retrieve || 0) >= 2 &&
      (signals.scores.workflow.ingest || 0) >= 1 &&
      (signals.scores.ai.llm || 0) >= 1,

    hasStrongPaymentsHints: (signals.scores.domain.banking_finance || 0) >= 5,
    hasStrongAuthHints:
      signals.hasAuth || (signals.scores.risk.auth_authz || 0) >= 2,
  };

  return signals;
}
