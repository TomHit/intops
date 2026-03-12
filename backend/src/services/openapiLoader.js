import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

function isHttpUrl(s) {
  return (
    typeof s === "string" &&
    (s.startsWith("http://") || s.startsWith("https://"))
  );
}

function normalizeSpecUrl(input) {
  const url = String(input || "").trim();
  if (!url) return url;

  if (url.startsWith("https://github.com/") && url.includes("/blob/")) {
    return url
      .replace("https://github.com/", "https://raw.githubusercontent.com/")
      .replace("/blob/", "/");
  }

  return url;
}

function buildCandidateSpecUrls(input) {
  const raw = String(input || "").trim();
  const normalized = normalizeSpecUrl(raw);
  const out = [];

  if (raw) out.push(raw);
  if (normalized && normalized !== raw) out.push(normalized);

  return [...new Set(out)];
}

function parseMaybeYaml(text, filename = "") {
  const trimmed = (text || "").trim();
  if (!trimmed) throw new Error("OpenAPI is empty");

  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  if (looksJson) return JSON.parse(trimmed);

  return yaml.load(trimmed);
}

async function fetchSpecFromCandidates(inputUrl) {
  const candidateUrls = buildCandidateSpecUrls(inputUrl);

  let lastStatus = null;
  let lastUrlTried = null;
  let text = null;
  let resolvedUrl = null;

  for (const candidateUrl of candidateUrls) {
    lastUrlTried = candidateUrl;

    const res = await fetch(candidateUrl, {
      headers: {
        Accept:
          "application/json, text/plain, application/yaml, text/yaml, application/x-yaml, */*",
      },
    });

    if (res.ok) {
      text = await res.text();
      resolvedUrl = candidateUrl;
      break;
    }

    lastStatus = res.status;
  }

  if (text == null) {
    throw new Error(
      `Failed to load OpenAPI URL: ${lastStatus || "unknown"}${lastUrlTried ? ` (${lastUrlTried})` : ""}`,
    );
  }

  return { text, resolvedUrl };
}

export async function loadProjectConfig(projectId) {
  const p = path.join(process.cwd(), "projects", projectId, "project.json");
  const raw = await fs.readFile(p, "utf-8");
  return JSON.parse(raw);
}

export async function loadOpenApiDoc(projectId, opts = {}) {
  const override = opts?.specSourceOverride;

  if (override) {
    if (!/^https?:\/\//i.test(override)) {
      throw new Error("Only http/https OpenAPI URL is supported right now");
    }

    const { text, resolvedUrl } = await fetchSpecFromCandidates(override);
    const doc = parseMaybeYaml(text, resolvedUrl || override);

    return {
      cfg: {
        project_id: projectId,
        project_name: projectId,
        openapi: {
          mode: "url",
          value: resolvedUrl || override,
        },
      },
      doc,
    };
  }

  const cfg = await loadProjectConfig(projectId);
  if (!cfg?.openapi?.value) throw new Error("Project openapi config missing");

  const mode =
    cfg.openapi.mode || (isHttpUrl(cfg.openapi.value) ? "url" : "file");
  const val = cfg.openapi.value;

  let text = "";

  if (mode === "url" || isHttpUrl(val)) {
    const { text: fetchedText } = await fetchSpecFromCandidates(val);
    text = fetchedText;
    return { cfg, doc: parseMaybeYaml(text, val) };
  }

  const full = path.join(process.cwd(), "projects", projectId, val);
  text = await fs.readFile(full, "utf-8");
  return { cfg, doc: parseMaybeYaml(text, full) };
}
