/**
 * BulaIA Models API — Lists available LLM models
 *
 * Returns the primary and fallback models configured via environment
 * variables, without exposing API keys.
 */

const { getModelChain, PROVIDER_CONFIGS } = require("../lib/llm_config");

/**
 * Build a short display label from a full model ID.
 * e.g. "meta-llama/Llama-3.1-8B-Instruct:cerebras" → "Llama 3.1 8B"
 */
function buildLabel(modelId) {
  let name = modelId;
  // Take only the part after '/'
  if (name.includes("/")) {
    name = name.split("/").pop();
  }
  // Remove provider suffix after ':'
  if (name.includes(":")) {
    name = name.split(":")[0];
  }
  // Clean up common suffixes
  name = name.replace(/-Instruct/gi, "").replace(/-Chat/gi, "");
  // Replace hyphens with spaces
  name = name.replace(/-/g, " ");
  return name;
}

/**
 * Read models directly from env vars (does not require valid API keys).
 * Falls back to getModelChain() if env vars are not set.
 */
function getAvailableModels() {
  const models = [];
  const seen = new Set();

  // Read primary from env
  const primaryProvider = (process.env.PRIMARY_PROVIDER || "huggingface").toLowerCase();
  const primaryModel = process.env.PRIMARY_MODEL || 
    (primaryProvider === "huggingface" ? "meta-llama/Llama-3.1-8B-Instruct:cerebras" : null);

  if (primaryModel && !seen.has(primaryModel)) {
    seen.add(primaryModel);
    const providerConfig = PROVIDER_CONFIGS[primaryProvider];
    models.push({
      id: primaryModel,
      provider: primaryProvider,
      providerName: providerConfig?.name || primaryProvider,
      label: buildLabel(primaryModel),
      purpose: "primary",
    });
  }

  // Read fallback from env
  const fallbackProvider = (process.env.FALLBACK_PROVIDER || "").toLowerCase();
  const fallbackModel = process.env.FALLBACK_MODEL || null;

  if (fallbackModel && !seen.has(fallbackModel)) {
    seen.add(fallbackModel);
    const providerConfig = PROVIDER_CONFIGS[fallbackProvider || "huggingface"];
    models.push({
      id: fallbackModel,
      provider: fallbackProvider || "huggingface",
      providerName: providerConfig?.name || fallbackProvider,
      label: buildLabel(fallbackModel),
      purpose: "fallback",
    });
  }

  return models;
}

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ detail: "Método não permitido." });

  try {
    const models = getAvailableModels();

    return res.status(200).json({
      models,
      default: models.length > 0 ? models[0].id : null,
    });
  } catch (err) {
    console.error("[Models API] Error:", err.message);
    return res.status(500).json({ detail: "Erro ao listar modelos.", error: err.message });
  }
};
