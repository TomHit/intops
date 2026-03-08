// ------------------------------
// Generic Test Case ID Generator
// ------------------------------

function splitWords(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camelCase -> camel Case
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2") // XMLParser -> XML Parser
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toUpperCase());
}

function cleanToken(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function uniqTokens(tokens) {
  const out = [];
  const seen = new Set();

  for (const t of tokens || []) {
    const x = cleanToken(t);
    if (!x || seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }

  return out;
}

function dedupeAdjacent(tokens) {
  const out = [];
  for (const t of tokens || []) {
    const x = cleanToken(t);
    if (!x) continue;
    if (out.length && out[out.length - 1] === x) continue;
    out.push(x);
  }
  return out;
}

function truncateToken(token, maxLen = 12) {
  const t = cleanToken(token);
  if (!t) return "";
  return t.length <= maxLen ? t : t.slice(0, maxLen);
}

function normalizeMethod(method) {
  return cleanToken(method || "GET") || "GET";
}

function normalizePath(path) {
  return String(path || "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/\?.*$/, "")
    .replace(/^\/+|\/+$/g, "");
}

function pathToTokens(path) {
  const segments = normalizePath(path)
    .split("/")
    .filter(Boolean)
    .filter((seg) => !/^v\d+$/i.test(seg)) // skip v1, v2, v3...
    .filter((seg) => !/^_?api$/i.test(seg)); // skip api / _api

  const out = [];

  for (const seg of segments) {
    if (/^\{.+\}$/.test(seg)) {
      const name = seg.slice(1, -1).trim();
      const words = splitWords(name);
      out.push("BY", ...(words.length ? words : ["PARAM"]));
    } else {
      out.push(...splitWords(seg));
    }
  }

  return uniqTokens(out);
}

function operationIdToTokens(operationId) {
  return uniqTokens(splitWords(operationId));
}

function tagToTokens(tag) {
  const words = splitWords(tag);
  return words.length ? uniqTokens(words) : ["DEFAULT"];
}

function removeSharedPrefix(tokens, prefixTokens) {
  const a = [...(tokens || [])];
  const b = [...(prefixTokens || [])];

  let i = 0;
  while (
    i < a.length &&
    i < b.length &&
    cleanToken(a[i]) === cleanToken(b[i])
  ) {
    i++;
  }
  return a.slice(i);
}

function shortenTokens(tokens, { maxTokenLen = 12, maxParts = 6 } = {}) {
  return (tokens || [])
    .map((t) => truncateToken(t, maxTokenLen))
    .filter(Boolean)
    .slice(0, maxParts);
}

function stableHash(input) {
  // Small deterministic non-crypto hash for collision suffixes
  const s = String(input || "");
  let h = 2166136261;

  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }

  return (h >>> 0).toString(36).toUpperCase();
}

function buildEndpointFingerprint(endpoint) {
  return JSON.stringify({
    method: normalizeMethod(endpoint?.method),
    path: normalizePath(endpoint?.path),
    operationId: endpoint?.operationId || "",
    tags: Array.isArray(endpoint?.tags) ? endpoint.tags : [],
  });
}

function getGroupTokens(endpoint) {
  const tags = Array.isArray(endpoint?.tags) ? endpoint.tags : [];
  if (tags.length > 0) return tagToTokens(tags[0]);

  const pathTokens = pathToTokens(endpoint?.path);
  if (pathTokens.length > 0) return [pathTokens[0]];

  return ["DEFAULT"];
}

function getActionTokens(endpoint) {
  const opTokens = operationIdToTokens(endpoint?.operationId);
  if (opTokens.length > 0) return opTokens;

  const method = normalizeMethod(endpoint?.method);
  const pathTokens = pathToTokens(endpoint?.path);
  return [method, ...pathTokens];
}

function buildBaseCaseIdParts(endpoint, options = {}) {
  const {
    prefix = "TC",
    maxGroupTokenLen = 10,
    maxGroupParts = 2,
    maxActionTokenLen = 12,
    maxActionParts = 6,
  } = options;

  const groupRaw = getGroupTokens(endpoint);
  const actionRaw = getActionTokens(endpoint);

  const groupTokens = shortenTokens(groupRaw, {
    maxTokenLen: maxGroupTokenLen,
    maxParts: maxGroupParts,
  });

  let actionTokens = dedupeAdjacent(actionRaw);
  actionTokens = removeSharedPrefix(actionTokens, groupTokens);
  actionTokens = shortenTokens(actionTokens, {
    maxTokenLen: maxActionTokenLen,
    maxParts: maxActionParts,
  });

  if (!actionTokens.length) {
    actionTokens = [normalizeMethod(endpoint?.method)];
  }

  return [cleanToken(prefix), ...groupTokens, ...actionTokens].filter(Boolean);
}

function fitIdToLength(parts, seq, options = {}) {
  const { maxIdLength = 80, minKeepParts = 2 } = options;

  const seqPart = String(seq).padStart(3, "0");
  let working = [...parts, seqPart];

  if (working.join("_").length <= maxIdLength) {
    return working.join("_");
  }

  // Step 1: tighten each token
  working = [
    ...parts.map((p, idx) => truncateToken(p, idx === 0 ? 6 : 8)),
    seqPart,
  ];
  if (working.join("_").length <= maxIdLength) {
    return working.join("_");
  }

  // Step 2: reduce part count but keep prefix + some meaning
  let core = parts.slice(0, Math.max(minKeepParts, 1));
  if (core.length < 2 && parts.length >= 2) core = parts.slice(0, 2);

  let id = [...core, seqPart].join("_");
  if (id.length <= maxIdLength) {
    return id;
  }

  // Step 3: final compact fallback
  const compact = [
    truncateToken(parts[0] || "TC", 6),
    truncateToken(parts[1] || "DEFAULT", 8),
    truncateToken(parts[2] || "CASE", 10),
    seqPart,
  ].filter(Boolean);

  return compact.join("_");
}

function buildHumanCaseTitle(endpoint, scenarioName = "") {
  const method = normalizeMethod(endpoint?.method);
  const path = endpoint?.path || "/";
  return scenarioName
    ? `${method} ${path} - ${scenarioName}`
    : `${method} ${path}`;
}

/**
 * Creates a generator function that stays collision-safe across a full Swagger upload.
 *
 * Usage:
 *   const gen = createCaseIdGenerator(allEndpoints);
 *   const id1 = gen.buildCaseId(endpoint, 1);
 *   const id2 = gen.buildCaseId(endpoint, 2, "Missing auth");
 */
export function createCaseIdGenerator(allEndpoints = [], options = {}) {
  const {
    prefix = "TC",
    maxIdLength = 80,
    maxGroupTokenLen = 10,
    maxGroupParts = 2,
    maxActionTokenLen = 12,
    maxActionParts = 6,
    collisionHashLen = 4,
  } = options;

  // Precompute endpoint base IDs
  const endpointRows = (allEndpoints || []).map((endpoint, index) => {
    const fingerprint = buildEndpointFingerprint(endpoint);
    const parts = buildBaseCaseIdParts(endpoint, {
      prefix,
      maxGroupTokenLen,
      maxGroupParts,
      maxActionTokenLen,
      maxActionParts,
    });
    const base = parts.join("_");

    return {
      endpoint,
      index,
      fingerprint,
      parts,
      base,
    };
  });

  // Detect collisions for endpoint-level bases
  const baseCount = new Map();
  for (const row of endpointRows) {
    baseCount.set(row.base, (baseCount.get(row.base) || 0) + 1);
  }

  const endpointBaseMap = new Map();

  for (const row of endpointRows) {
    const isCollision = (baseCount.get(row.base) || 0) > 1;

    let resolvedParts = [...row.parts];

    if (isCollision) {
      const hashSuffix = stableHash(row.fingerprint).slice(0, collisionHashLen);
      resolvedParts.push(hashSuffix);
    }

    const resolvedBase = resolvedParts.join("_");
    endpointBaseMap.set(row.fingerprint, resolvedBase);
  }

  // Prevent duplicate case IDs when same endpoint + seq repeats
  const usedCaseIds = new Map();

  function buildCaseId(endpoint, seq = 1, scenarioName = "") {
    const fingerprint = buildEndpointFingerprint(endpoint);

    let base = endpointBaseMap.get(fingerprint);
    if (!base) {
      // Fallback for endpoints not present in initial array
      const parts = buildBaseCaseIdParts(endpoint, {
        prefix,
        maxGroupTokenLen,
        maxGroupParts,
        maxActionTokenLen,
        maxActionParts,
      });
      base = parts.join("_");
    }

    let id = fitIdToLength(base.split("_"), seq, { maxIdLength });

    // Case-level collision handling
    const key = id;
    const seen = usedCaseIds.get(key) || 0;

    if (seen > 0) {
      const scenarioHash = stableHash(
        JSON.stringify({
          endpoint: fingerprint,
          seq,
          scenarioName,
          seen,
        }),
      ).slice(0, collisionHashLen);

      const baseWithoutSeq = id.replace(/_\d{3}$/, "");
      id = fitIdToLength([...baseWithoutSeq.split("_"), scenarioHash], seq, {
        maxIdLength,
      });
    }

    usedCaseIds.set(id, (usedCaseIds.get(id) || 0) + 1);
    return id;
  }

  function buildCaseMeta(endpoint, seq = 1, scenarioName = "") {
    return {
      id: buildCaseId(endpoint, seq, scenarioName),
      title: buildHumanCaseTitle(endpoint, scenarioName),
      method: normalizeMethod(endpoint?.method),
      path: endpoint?.path || "/",
      operationId: endpoint?.operationId || null,
      tags: Array.isArray(endpoint?.tags) ? endpoint.tags : [],
      seq: String(seq).padStart(3, "0"),
      scenario: scenarioName || null,
    };
  }

  return {
    buildCaseId,
    buildCaseMeta,
    buildCaseTitle: buildHumanCaseTitle,
  };
}
