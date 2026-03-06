import { makeOllamaProvider } from "./ollama.js";

function envBool(v, def = false) {
  if (v === undefined || v === null || v === "") return def;
  return String(v).toLowerCase() === "true";
}

export function getAIProvider() {
  const enabled = envBool(process.env.AI_ENABLED, false);
  const provider = (process.env.AI_PROVIDER || "ollama").toLowerCase();

  // If AI not enabled -> return disabled provider
  if (!enabled) {
    return {
      name: "disabled",
      enabled: false,
      modelName: "deterministic",
      async generate() {
        throw new Error("AI is disabled");
      },
    };
  }

  // Ollama provider
  if (provider === "ollama") {
    return makeOllamaProvider();
  }

  // Future: openai/deepseek providers here
  return {
    name: "disabled",
    enabled: false,
    modelName: null,
    async generate() {
      throw new Error(`Unknown AI_PROVIDER=${provider}`);
    },
  };
}
