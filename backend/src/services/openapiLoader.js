import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

function isHttpUrl(s) {
  return (
    typeof s === "string" &&
    (s.startsWith("http://") || s.startsWith("https://"))
  );
}

function parseMaybeYaml(text, filename = "") {
  const trimmed = (text || "").trim();
  if (!trimmed) throw new Error("OpenAPI is empty");

  // quick detection
  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  if (looksJson) return JSON.parse(trimmed);

  // yaml fallback
  return yaml.load(trimmed);
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

    const res = await fetch(override, {
      headers: {
        Accept: "application/json, text/plain, application/yaml, text/yaml",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to load OpenAPI URL: ${res.status}`);
    }

    const text = await res.text();

    let doc;
    try {
      doc = JSON.parse(text);
    } catch {
      throw new Error("OpenAPI URL must currently return JSON");
    }

    return {
      cfg: {
        project_id: projectId,
        project_name: projectId,
        openapi: {
          mode: "url",
          value: override,
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
    const res = await fetch(val, {
      headers: { Accept: "application/json,text/yaml,*/*" },
    });
    if (!res.ok) throw new Error(`OpenAPI fetch failed: ${res.status}`);
    text = await res.text();
    return { cfg, doc: parseMaybeYaml(text, val) };
  }

  // local file under projects/<id>/
  const full = path.join(process.cwd(), "projects", projectId, val);
  text = await fs.readFile(full, "utf-8");
  return { cfg, doc: parseMaybeYaml(text, full) };
}
