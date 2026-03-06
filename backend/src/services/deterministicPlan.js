// backend/src/services/deterministicPlan.js

function nowIso() {
  return new Date().toISOString();
}

function safeId(s) {
  return String(s || "")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function makeCase({ type, method, path, i }) {
  const m = String(method).toUpperCase();

  const request = {
    query: {},
    headers: {},
  };

  if (type === "negative") {
    request.query = { invalid: "true" };
  }

  const base = {
    id: `${type}.${i}.${safeId(m)}.${safeId(path)}`,
    title: `${type.toUpperCase()} | ${m} ${path}`,
    type,
    priority: type === "smoke" ? "P0" : "P1",
    method: m,
    path,
    request,

    steps: [`Send ${m} request to ${path}`],

    expected: ["API responds successfully"],

    assertions: [{ op: "status_check" }],

    needs_review: true,

    review_notes: ["Auto generated baseline test"],
  };

  if (type === "contract") {
    base.expected = ["Response status is 2xx", "Response body is valid JSON"];
  }

  if (type === "negative") {
    base.priority = "P2";
    base.expected = ["API returns client error (4xx)"];
  }

  return base;
}

export function buildDeterministicTestPlan({ project, options, endpoints }) {
  const include = Array.isArray(options?.include)
    ? options.include
    : ["smoke", "contract", "negative"];

  const eps = Array.isArray(endpoints) ? endpoints : [];
  if (eps.length === 0) throw new Error("deterministicPlan: endpoints empty");

  const types = include.slice(0, 3);
  const first = eps[0];

  const suite = {
    suite_id: "auto_v1",
    name: "Deterministic Generated Suite",
    endpoints: eps.map((e) => ({
      method: String(e.method).toUpperCase(),
      path: e.path,
    })),
    cases: types.map((t, idx) =>
      makeCase({
        type: t,
        method: first.method,
        path: first.path,
        i: idx + 1,
      }),
    ),
  };

  return {
    project,
    generation: {
      generated_at: nowIso(),
      generator_version: "v1",
      model: "deterministic",
      prompt_version: "p1",
      rag_enabled: false,
    },
    suites: [suite],
  };
}
