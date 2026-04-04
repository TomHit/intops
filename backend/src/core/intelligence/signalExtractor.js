export function extractSignals(input = {}) {
  const { openapi, projectNotes = "", githubData = null } = input;

  const paths = openapi?.paths || {};
  const signals = {
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
  };

  const securitySchemes = openapi?.components?.securitySchemes || {};
  const rootSecurity = openapi?.security || [];

  if (Object.keys(securitySchemes).length > 0 || rootSecurity.length > 0) {
    signals.hasAuth = true;
  }

  for (const path in paths) {
    const methods = paths[path] || {};

    for (const method in methods) {
      const endpoint = methods[method];

      if (!endpoint || typeof endpoint !== "object") continue;

      const lowerPath = String(path || "").toLowerCase();
      const summary = String(endpoint.summary || "").toLowerCase();
      const description = String(endpoint.description || "").toLowerCase();
      const operationId = String(endpoint.operationId || "").toLowerCase();
      const tagsText = Array.isArray(endpoint.tags)
        ? endpoint.tags.join(" ").toLowerCase()
        : "";

      const combinedText =
        `${lowerPath} ${summary} ${description} ${operationId} ${tagsText}`.trim();

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
        combinedText.includes("retrieval")
      ) {
        signals.hasSearch = true;
      }

      if (
        combinedText.includes("upload") ||
        combinedText.includes("file") ||
        combinedText.includes("document") ||
        combinedText.includes("ingest")
      ) {
        signals.hasUpload = true;
        signals.hasFileInput = true;
      }

      if (
        combinedText.includes("predict") ||
        combinedText.includes("inference") ||
        combinedText.includes("classification") ||
        combinedText.includes("model") ||
        combinedText.includes("score")
      ) {
        signals.hasPredict = true;
      }

      if (Array.isArray(endpoint.security) && endpoint.security.length > 0) {
        signals.hasAuth = true;
      }

      const parameters = Array.isArray(endpoint.parameters)
        ? endpoint.parameters
        : [];

      const paramsStr = JSON.stringify(parameters).toLowerCase();
      if (
        paramsStr.includes("text") ||
        paramsStr.includes("message") ||
        paramsStr.includes("prompt") ||
        paramsStr.includes("query")
      ) {
        signals.hasTextInput = true;
      }

      const requestBody = endpoint.requestBody?.content || {};

      for (const contentType in requestBody) {
        const content = requestBody[contentType] || {};
        const schema = content.schema || {};
        const schemaStr = JSON.stringify(schema).toLowerCase();

        if (
          contentType.includes("json") &&
          (schemaStr.includes("text") ||
            schemaStr.includes("message") ||
            schemaStr.includes("prompt") ||
            schemaStr.includes("query") ||
            schemaStr.includes("input"))
        ) {
          signals.hasTextInput = true;
        }

        if (
          contentType.includes("multipart/form-data") ||
          contentType.includes("octet-stream") ||
          schemaStr.includes("binary") ||
          schemaStr.includes("file")
        ) {
          signals.hasFileInput = true;
          signals.hasUpload = true;
        }
      }

      signals.endpoints.push({
        path,
        method: method.toUpperCase(),
        summary: endpoint.summary || "",
      });
    }
  }

  return signals;
}
