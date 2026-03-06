import fs from "fs/promises";
import path from "path";
import { loadOpenApiDoc } from "./openapiLoader.js";
import { extractEndpoints } from "./openapiParser.js";
import { buildGeneratorPrompt, buildRepairPrompt } from "./prompt.js";
import { getAIProvider } from "../providers/ai/index.js";
import { buildDeterministicTestPlan } from "./deterministicPlan.js";
import { validateTestPlanOrThrow } from "./schemaValidate.js";
import { buildReport } from "./report.js";
const SCHEMA_SHAPE_GUIDE = `
Return ONLY JSON.
Top keys: project, generation, suites.
Each suite: suite_id,name,endpoints[],cases[].
Each case: id,title,type,priority,method,path,request{query,headers,body?},steps[],expected[],assertions[],needs_review,review_notes?.
Rules: method uppercase. Omit request.body for GET/DELETE. assertions must be objects (not strings). Exactly 1 case per included type. Max 3 cases.
`.trim();
function nowIso() {
  return new Date().toISOString();
}

function safeParseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

// Trim model output to JSON object (common small model issue)
function tryExtractJsonObject(text) {
  if (!text) return null;
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const slice = text.slice(first, last + 1);
  return safeParseJson(slice);
}

async function loadSchemaText() {
  const schemaPath = path.join(
    process.cwd(),
    "src",
    "schema",
    "testplan.schema.json",
  );
  return await fs.readFile(schemaPath, "utf-8");
}

export async function generateTestPlan(payload) {
  const project_id = payload?.project_id;
  if (!project_id) throw new Error("project_id is required");

  const include = Array.isArray(payload?.include)
    ? payload.include
    : ["smoke", "contract", "negative"];
  const env = payload?.env || "staging";
  const auth_profile = payload?.auth_profile || "device";
  const guidance = payload?.guidance || "";

  // Load OpenAPI + project config
  const { cfg, doc } = await loadOpenApiDoc(project_id);

  // Parse endpoints catalog
  const allEndpoints = extractEndpoints(doc);

  // If UI passes selected endpoints, restrict
  const selected = Array.isArray(payload?.endpoints) ? payload.endpoints : [];
  let endpointRecords = allEndpoints;

  if (selected.length > 0) {
    const keyset = new Set(
      selected.map((e) => `${String(e.method).toUpperCase()} ${e.path}`),
    );
    endpointRecords = allEndpoints.filter((e) =>
      keyset.has(`${e.method} ${e.path}`),
    );
  }

  if (endpointRecords.length === 0) {
    const err = new Error(
      "No endpoints matched selection. Check OpenAPI or selection payload.",
    );
    err.details = { selected, endpoints_found: allEndpoints.length };
    throw err;
  }
  // ✅ Reduce endpointRecords size for small local models (speed + avoids timeouts)
  endpointRecords = endpointRecords.map((e) => ({
    id: e.id,
    method: e.method,
    path: e.path,
    summary: e.summary || "",
    tags: e.tags || [],
    params: {
      query: Array.isArray(e?.params?.query)
        ? e.params.query.map((p) => ({ name: p.name, required: !!p.required }))
        : [],
      path: Array.isArray(e?.params?.path)
        ? e.params.path.map((p) => ({ name: p.name, required: !!p.required }))
        : [],
    },
  }));

  // Build project block used by schema
  const projectBlock = {
    project_id: cfg.project_id || project_id,
    project_name: cfg.project_name || project_id,
    env,
    base_url_var: "BASE_URL",
    auth_profile,
    auth_vars: ["DEVICE_ID", "SESSION_COOKIE"], // keep generic; refine per project later
  };

  const options = { include, env, auth_profile, guidance };

  const schemaText = ""; // keep schema out of LLM prompt (AJV enforces it anyway)
  const endpointText = endpointRecords
    .map((e) => {
      const rq = (e?.params?.query || [])
        .filter((p) => p.required)
        .map((p) => p.name);
      return `${e.method} ${e.path} | required_query=${rq.join(",") || "none"} | ${e.summary || ""}`;
    })
    .join("\n");
  const prompt = buildGeneratorPrompt({
    project: projectBlock,
    options,
    endpointRecords,
    schemaText: SCHEMA_SHAPE_GUIDE,
  });

  // ------------------------------
  // Deterministic-first baseline
  // ------------------------------
  let obj = null;

  const deterministic = buildDeterministicTestPlan({
    project: projectBlock,
    options,
    endpoints: endpointRecords,
  });

  // ------------------------------
  // Optional AI enrichment
  // ------------------------------
  const ai = getAIProvider();
  const wantAI = payload?.ai === true; // UI toggle (default false)

  if (wantAI && ai.enabled) {
    const model = ai.modelName || process.env.OLLAMA_MODEL || "unknown";

    try {
      const raw1 = await ai.generate({ prompt, temperature: 0.3 });
      obj = tryExtractJsonObject(raw1);

      // repair (one pass) if needed
      if (!obj) {
        const repairPrompt = buildRepairPrompt({
          badJsonText: raw1,
          schemaText,
        });
        const raw2 = await ai.generate({
          prompt: repairPrompt,
          temperature: 0.2,
        });
        obj = tryExtractJsonObject(raw2);
        if (!obj) throw new Error("AI output not valid JSON after repair pass");
      }

      // Fill generation metadata if missing (safe enrichment)
      obj.generation = obj.generation || {};
      obj.generation.generated_at = obj.generation.generated_at || nowIso();
      obj.generation.generator_version =
        obj.generation.generator_version || "v1";
      obj.generation.model = obj.generation.model || model;
      obj.generation.prompt_version = obj.generation.prompt_version || "p1";
      obj.generation.rag_enabled = obj.generation.rag_enabled ?? false;

      // Ensure project matches selection (safe)
      obj.project = obj.project || projectBlock;
      obj.project.project_id =
        obj.project.project_id || projectBlock.project_id;
      obj.project.project_name =
        obj.project.project_name || projectBlock.project_name;
      obj.project.env = obj.project.env || projectBlock.env;
      obj.project.base_url_var =
        obj.project.base_url_var || projectBlock.base_url_var;
      obj.project.auth_profile =
        obj.project.auth_profile || projectBlock.auth_profile;
      obj.project.auth_vars = Array.isArray(obj.project.auth_vars)
        ? obj.project.auth_vars
        : projectBlock.auth_vars;
    } catch (e) {
      // IMPORTANT: never fail generator because AI failed
      obj = null;
      deterministic.generation = deterministic.generation || {};
      deterministic.generation.ai_skipped = false;
      deterministic.generation.ai_provider = ai.name;
      deterministic.generation.ai_error = String(e?.message || e);
    }
  }

  // If AI disabled/unavailable/failed -> use deterministic
  if (!obj) {
    obj = deterministic;
    obj.generation = obj.generation || {};
    obj.generation.ai_skipped = wantAI ? false : true;
    obj.generation.ai_provider = ai.name;
    obj.generation.generated_at = obj.generation.generated_at || nowIso();
    obj.generation.generator_version = obj.generation.generator_version || "v1";
    obj.generation.model = obj.generation.model || "deterministic";
    obj.generation.prompt_version = obj.generation.prompt_version || "p1";
    obj.generation.rag_enabled = obj.generation.rag_enabled ?? false;
  }

  // Fill generation metadata if missing (safe enrichment)
  obj.generation = obj.generation || {};
  obj.generation.generated_at = obj.generation.generated_at || nowIso();
  obj.generation.generator_version = obj.generation.generator_version || "v1";
  obj.generation.model = obj.generation.model || model;
  obj.generation.prompt_version = obj.generation.prompt_version || "p1";
  obj.generation.rag_enabled = obj.generation.rag_enabled ?? false;

  // Ensure project matches selection (safe)
  obj.project = obj.project || projectBlock;
  obj.project.project_id = obj.project.project_id || projectBlock.project_id;
  obj.project.project_name =
    obj.project.project_name || projectBlock.project_name;
  obj.project.env = obj.project.env || projectBlock.env;
  obj.project.base_url_var =
    obj.project.base_url_var || projectBlock.base_url_var;
  obj.project.auth_profile =
    obj.project.auth_profile || projectBlock.auth_profile;
  obj.project.auth_vars = Array.isArray(obj.project.auth_vars)
    ? obj.project.auth_vars
    : projectBlock.auth_vars;

  // 3) validate schema (hard fail if invalid)
  await validateTestPlanOrThrow(obj);

  // 4) report
  const report = buildReport(obj);

  return {
    run_id: `run_${Date.now()}`,
    testplan: obj,
    report,
  };
}
