// backend/src/providers/ai/ollama.js

export async function ollamaGenerate({
  model = "qwen2.5:3b",
  prompt,
  temperature = 0.3,
  timeoutMs = 180000,
}) {
  const url = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature,
          num_predict: 800, // hard cap output tokens
          top_p: 0.9,
        },
        stop: ["\n\n\n", "```"],
      }),
    });

    const text = await res.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(
        `Ollama returned non-JSON: ${String(text).slice(0, 200)}`,
      );
    }

    if (!res.ok) {
      throw new Error(
        `Ollama error: ${res.status} ${data?.error || ""}`.trim(),
      );
    }

    return data?.response || "";
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error(`Ollama timeout after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// Provider wrapper used by getAIProvider()
export function makeOllamaProvider() {
  const modelName = process.env.OLLAMA_MODEL || "qwen2.5:3b";
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || "180000");

  return {
    name: "ollama",
    enabled: true,
    modelName,
    async generate({ prompt, temperature = 0.3 } = {}) {
      if (!prompt) throw new Error("prompt is required");
      return await ollamaGenerate({
        model: modelName,
        prompt,
        temperature,
        timeoutMs,
      });
    },
  };
}
