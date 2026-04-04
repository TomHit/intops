// src/core/intelligence/domainClassifier.js

const DOMAIN_RULES = {
  retail_commerce: {
    label: "Retail / Commerce",
    keywords: [
      "store",
      "order",
      "inventory",
      "product",
      "cart",
      "checkout",
      "catalog",
      "price",
      "pricing",
      "purchase",
      "buyer",
      "seller",
      "item",
      "sku",
      "stock",
      "shop",
    ],
    subdomains: {
      pet_store: ["pet", "pets", "animal"],
      marketplace: ["marketplace", "vendor", "merchant", "seller"],
      food_delivery: ["restaurant", "menu", "delivery", "food", "meal"],
    },
  },

  banking_finance: {
    label: "Banking / Finance",
    keywords: [
      "account",
      "transaction",
      "payment",
      "payments",
      "balance",
      "ledger",
      "loan",
      "card",
      "cards",
      "wallet",
      "bank",
      "transfer",
      "deposit",
      "withdrawal",
      "credit",
      "debit",
      "invoice",
      "billing",
      "settlement",
    ],
    subdomains: {
      banking: ["bank", "account", "balance", "transfer", "deposit"],
      payments: ["payment", "checkout", "invoice", "settlement", "gateway"],
      lending: ["loan", "emi", "interest", "repayment"],
    },
  },

  healthcare: {
    label: "Healthcare",
    keywords: [
      "patient",
      "doctor",
      "appointment",
      "medical",
      "clinic",
      "hospital",
      "diagnosis",
      "prescription",
      "medication",
      "ehr",
      "emr",
      "lab",
      "test result",
      "care plan",
      "symptom",
      "treatment",
    ],
    subdomains: {
      clinical: ["patient", "doctor", "diagnosis", "treatment"],
      hospital_ops: ["hospital", "ward", "bed", "admission", "discharge"],
      pharmacy: ["prescription", "drug", "medication", "pharmacy"],
    },
  },

  insurance: {
    label: "Insurance",
    keywords: [
      "policy",
      "claim",
      "claims",
      "premium",
      "coverage",
      "insured",
      "insurer",
      "underwriting",
      "beneficiary",
      "renewal",
      "quote",
    ],
    subdomains: {
      claims: ["claim", "claims", "settlement"],
      policy_admin: ["policy", "premium", "renewal", "coverage"],
    },
  },

  travel_hospitality: {
    label: "Travel / Hospitality",
    keywords: [
      "trip",
      "travel",
      "flight",
      "hotel",
      "booking",
      "reservation",
      "ticket",
      "itinerary",
      "passenger",
      "destination",
      "checkin",
      "checkout",
    ],
    subdomains: {
      airline: ["flight", "passenger", "boarding", "pnr"],
      hotel: ["hotel", "room", "reservation", "checkin", "checkout"],
      transport: ["cab", "ride", "driver", "vehicle", "trip"],
    },
  },

  logistics_supply_chain: {
    label: "Logistics / Supply Chain",
    keywords: [
      "shipment",
      "shipping",
      "tracking",
      "warehouse",
      "inventory",
      "fulfillment",
      "carrier",
      "dispatch",
      "delivery",
      "consignment",
      "route",
      "fleet",
    ],
    subdomains: {
      shipping: ["shipment", "tracking", "carrier", "consignment"],
      warehouse: ["warehouse", "bin", "stock", "fulfillment"],
      fleet: ["fleet", "vehicle", "route", "driver", "dispatch"],
    },
  },

  hr_payroll: {
    label: "HR / Payroll",
    keywords: [
      "employee",
      "employees",
      "payroll",
      "salary",
      "leave",
      "attendance",
      "recruitment",
      "candidate",
      "onboarding",
      "benefits",
      "timesheet",
      "department",
    ],
    subdomains: {
      payroll: ["payroll", "salary", "benefits", "deduction"],
      hrms: ["employee", "attendance", "leave", "department"],
      hiring: ["candidate", "recruitment", "interview", "job posting"],
    },
  },

  education: {
    label: "Education",
    keywords: [
      "student",
      "course",
      "lesson",
      "exam",
      "quiz",
      "grade",
      "teacher",
      "classroom",
      "learning",
      "assignment",
      "school",
      "university",
    ],
    subdomains: {
      lms: ["course", "lesson", "assignment", "quiz", "grade"],
      institution: ["student", "teacher", "school", "university"],
    },
  },

  legal_compliance: {
    label: "Legal / Compliance",
    keywords: [
      "contract",
      "agreement",
      "clause",
      "compliance",
      "regulation",
      "audit",
      "policy",
      "consent",
      "legal",
      "gdpr",
      "kyc",
      "aml",
    ],
    subdomains: {
      legal_docs: ["contract", "agreement", "clause", "legal"],
      compliance_ops: ["compliance", "audit", "regulation", "policy"],
    },
  },

  media_content: {
    label: "Media / Content",
    keywords: [
      "content",
      "article",
      "video",
      "audio",
      "stream",
      "playlist",
      "podcast",
      "image",
      "thumbnail",
      "caption",
      "publish",
      "channel",
    ],
    subdomains: {
      video: ["video", "stream", "playlist", "channel"],
      publishing: ["article", "publish", "editorial", "content"],
      audio: ["audio", "podcast", "episode"],
    },
  },

  social_communication: {
    label: "Social / Communication",
    keywords: [
      "message",
      "messages",
      "chat",
      "conversation",
      "thread",
      "comment",
      "post",
      "feed",
      "notification",
      "friend",
      "follow",
      "group",
    ],
    subdomains: {
      messaging: ["chat", "message", "conversation", "thread"],
      social: ["post", "feed", "comment", "follow", "friend"],
    },
  },

  developer_tools: {
    label: "Developer Tools",
    keywords: [
      "repository",
      "repo",
      "build",
      "deploy",
      "pipeline",
      "artifact",
      "commit",
      "branch",
      "ci",
      "cd",
      "environment",
      "webhook",
      "sdk",
      "api key",
    ],
    subdomains: {
      cicd: ["build", "deploy", "pipeline", "artifact", "release"],
      code_hosting: ["repository", "repo", "commit", "branch", "pull request"],
    },
  },

  security_identity: {
    label: "Security / Identity",
    keywords: [
      "auth",
      "authentication",
      "authorize",
      "authorization",
      "identity",
      "user",
      "role",
      "permission",
      "token",
      "session",
      "sso",
      "mfa",
      "otp",
      "login",
      "logout",
      "access",
    ],
    subdomains: {
      iam: ["role", "permission", "identity", "access"],
      authentication: ["login", "logout", "token", "mfa", "otp", "sso"],
    },
  },

  crm_sales: {
    label: "CRM / Sales",
    keywords: [
      "customer",
      "lead",
      "opportunity",
      "deal",
      "contact",
      "sales",
      "pipeline",
      "quote",
      "account manager",
      "prospect",
    ],
    subdomains: {
      crm: ["customer", "contact", "lead", "prospect"],
      sales_ops: ["deal", "opportunity", "quote", "pipeline", "sales"],
    },
  },

  generic_service: {
    label: "Generic Service",
    keywords: [],
    subdomains: {},
  },
};

function tokenizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9_/\-\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function normalizePathParts(path) {
  return String(path || "")
    .toLowerCase()
    .replace(/[{}]/g, "")
    .split(/[\/\-_]+/)
    .filter(Boolean);
}

function collectCorpus({ openapi, signals, projectNotes }) {
  const chunks = [];

  if (projectNotes) chunks.push(String(projectNotes));

  if (openapi?.info?.title) chunks.push(openapi.info.title);
  if (openapi?.info?.description) chunks.push(openapi.info.description);

  const tags = Array.isArray(openapi?.tags) ? openapi.tags : [];
  for (const tag of tags) {
    if (tag?.name) chunks.push(tag.name);
    if (tag?.description) chunks.push(tag.description);
  }

  const endpoints = Array.isArray(signals?.endpoints) ? signals.endpoints : [];
  for (const ep of endpoints) {
    if (ep?.path) chunks.push(ep.path);
    if (ep?.summary) chunks.push(ep.summary);
    if (ep?.method) chunks.push(ep.method);
  }

  const paths = openapi?.paths || {};
  for (const [path, methods] of Object.entries(paths)) {
    chunks.push(path);

    for (const [method, endpoint] of Object.entries(methods || {})) {
      chunks.push(method);
      if (endpoint?.summary) chunks.push(endpoint.summary);
      if (endpoint?.description) chunks.push(endpoint.description);
      if (endpoint?.operationId) chunks.push(endpoint.operationId);

      if (Array.isArray(endpoint?.tags)) {
        chunks.push(endpoint.tags.join(" "));
      }

      const parameters = Array.isArray(endpoint?.parameters)
        ? endpoint.parameters
        : [];
      for (const param of parameters) {
        if (param?.name) chunks.push(param.name);
        if (param?.description) chunks.push(param.description);
      }

      const requestBody = endpoint?.requestBody?.content || {};
      for (const content of Object.values(requestBody)) {
        if (content?.schema) {
          chunks.push(JSON.stringify(content.schema));
        }
      }

      const responses = endpoint?.responses || {};
      for (const response of Object.values(responses)) {
        const responseContent = response?.content || {};
        for (const content of Object.values(responseContent)) {
          if (content?.schema) {
            chunks.push(JSON.stringify(content.schema));
          }
        }
      }
    }
  }

  return chunks.filter(Boolean);
}

function scoreKeywordList(corpusText, keywords, weight = 1) {
  let score = 0;
  const matched = [];

  for (const keyword of keywords) {
    const lowered = keyword.toLowerCase();
    if (corpusText.includes(lowered)) {
      score += weight;
      matched.push(lowered);
    }
  }

  return { score, matched };
}

function scorePathTokens(endpoints = [], keywords = [], weight = 2) {
  let score = 0;
  const matched = [];

  for (const ep of endpoints) {
    const pathParts = normalizePathParts(ep?.path || "");
    for (const keyword of keywords) {
      const lowered = keyword.toLowerCase();
      if (pathParts.includes(lowered)) {
        score += weight;
        matched.push(lowered);
      }
    }
  }

  return { score, matched };
}

function pickTopDomain(domainScores) {
  const ranked = Object.entries(domainScores)
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0 || ranked[0].score <= 0) {
    return null;
  }

  const top = ranked[0];
  const second = ranked[1];

  let confidence = Math.min(0.95, 0.35 + top.score * 0.06);

  if (second && top.score - second.score <= 2) {
    confidence -= 0.12;
  }

  confidence = Math.max(0.2, Math.min(0.95, confidence));

  return {
    top,
    second: second || null,
    confidence,
  };
}

function detectSubdomain(domainRule, corpusText) {
  const subdomains = domainRule?.subdomains || {};
  let bestKey = null;
  let bestScore = 0;
  let bestSignals = [];

  for (const [subKey, keywords] of Object.entries(subdomains)) {
    const { score, matched } = scoreKeywordList(corpusText, keywords, 1);
    if (score > bestScore) {
      bestKey = subKey;
      bestScore = score;
      bestSignals = matched;
    }
  }

  if (!bestKey || bestScore === 0) {
    return null;
  }

  return {
    subdomain: bestKey,
    signals: [...new Set(bestSignals)],
  };
}

export function classifyBusinessDomain(input = {}) {
  const { openapi = {}, signals = {}, projectNotes = "" } = input;

  const corpusChunks = collectCorpus({ openapi, signals, projectNotes });
  const corpusText = corpusChunks.join(" ").toLowerCase();

  const domainScores = {};

  for (const [domainKey, rule] of Object.entries(DOMAIN_RULES)) {
    if (domainKey === "generic_service") continue;

    const keywordScore = scoreKeywordList(corpusText, rule.keywords, 1);
    const pathScore = scorePathTokens(
      signals?.endpoints || [],
      rule.keywords,
      2,
    );

    const totalScore = keywordScore.score + pathScore.score;
    const matchedSignals = [
      ...new Set([...keywordScore.matched, ...pathScore.matched]),
    ];

    domainScores[domainKey] = {
      score: totalScore,
      label: rule.label,
      signals: matchedSignals,
    };
  }

  const picked = pickTopDomain(domainScores);

  if (!picked) {
    return {
      business_domain: "generic_service",
      business_domain_label: DOMAIN_RULES.generic_service.label,
      subdomain: null,
      domain_confidence: 0.2,
      domain_signals: [],
      secondary_domains: [],
    };
  }

  const topRule = DOMAIN_RULES[picked.top.key];
  const subdomainResult = detectSubdomain(topRule, corpusText);

  const secondaryDomains = Object.entries(domainScores)
    .filter(
      ([key, value]) =>
        key !== picked.top.key &&
        value.score >= Math.max(3, picked.top.score - 2),
    )
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 2)
    .map(([key, value]) => ({
      domain: key,
      label: value.label,
      score: value.score,
    }));

  return {
    business_domain: picked.top.key,
    business_domain_label: picked.top.label,
    subdomain: subdomainResult?.subdomain || null,
    domain_confidence: picked.confidence,
    domain_signals: picked.top.signals,
    secondary_domains: secondaryDomains,
  };
}
