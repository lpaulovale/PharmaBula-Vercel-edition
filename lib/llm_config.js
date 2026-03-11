/**
 * LLM Configuration for BulaIA
 *
 * Centralized configuration for AI model selection.
 * Reads environment variables and provides model/provider configurations.
 *
 * Environment Variables:
 *   - PRIMARY_PROVIDER, PRIMARY_MODEL, PRIMARY_API_KEY
 *   - FALLBACK_PROVIDER, FALLBACK_MODEL, FALLBACK_API_KEY
 *   - JUDGE_PROVIDER, JUDGE_MODEL, JUDGE_API_KEY
 *   - Provider-specific keys: HF_TOKEN, OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY
 */

// ============================================================
// Provider Configurations
// ============================================================
const PROVIDER_CONFIGS = {
  huggingface: {
    name: "HuggingFace",
    baseUrl: "https://router.huggingface.co/v1/chat/completions",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    bodyFormat: "openai", // Uses OpenAI-compatible format
  },
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    bodyFormat: "openai",
  },
  anthropic: {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1/messages",
    authHeader: "x-api-key",
    authPrefix: "",
    bodyFormat: "anthropic",
    additionalHeaders: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
  },
  google: {
    name: "Google AI",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    authHeader: null, // Uses query param
    authPrefix: "",
    bodyFormat: "google",
  },
};

// ============================================================
// Configuration Loader
// ============================================================

/**
 * Get API key for a provider.
 * Checks specific key first, then falls back to provider-specific env var.
 * Placeholder values like "your_..._here" are treated as invalid.
 * @param {string} provider - Provider name
 * @param {string} specificKeyEnv - Specific key env var (e.g., PRIMARY_API_KEY)
 * @returns {string|null} API key or null
 */
function getApiKey(provider, specificKeyEnv) {
  // First try the specific key from config
  const specificKey = process.env[specificKeyEnv];
  if (specificKey && !specificKey.startsWith("your_") && !specificKey.endsWith("_here")) {
    return specificKey;
  }

  // Fallback to provider-specific env var
  const providerKeyMap = {
    huggingface: "HF_TOKEN",
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_API_KEY",
  };

  const providerKeyEnv = providerKeyMap[provider?.toLowerCase()];
  if (providerKeyEnv) {
    const providerKey = process.env[providerKeyEnv];
    if (providerKey && !providerKey.startsWith("your_") && !providerKey.endsWith("_here")) {
      return providerKey;
    }
  }

  return null;
}

/**
 * Get model configuration.
 * @param {string} purpose - "primary", "fallback", or "judge"
 * @returns {Object|null} Config with { provider, model, apiKey, baseUrl, ... } or null
 */
function getModelConfig(purpose = "primary") {
  const purposeUpper = purpose.toUpperCase();
  const providerEnv = `${purposeUpper}_PROVIDER`;
  const modelEnv = `${purposeUpper}_MODEL`;
  const keyEnv = `${purposeUpper}_API_KEY`;

  const provider = process.env[providerEnv]?.toLowerCase() || "huggingface";
  const model = process.env[modelEnv];

  if (!model) {
    console.warn(`[LLM Config] ${modelEnv} not set, using default`);
    return null;
  }

  const providerConfig = PROVIDER_CONFIGS[provider];
  if (!providerConfig) {
    console.warn(`[LLM Config] Unknown provider '${provider}', falling back to huggingface`);
    return getModelConfigForProvider("huggingface", model, keyEnv);
  }

  const apiKey = getApiKey(provider, keyEnv);
  if (!apiKey) {
    console.error(`[LLM Config] No API key found for provider '${provider}'`);
    return null;
  }

  return {
    purpose,
    provider,
    model,
    apiKey,
    ...providerConfig,
  };
}

/**
 * Get model configuration for a specific provider.
 * @param {string} provider - Provider name
 * @param {string} model - Model name/ID
 * @param {string} keyEnv - Env var name for API key
 * @returns {Object|null} Config object or null
 */
function getModelConfigForProvider(provider, model, keyEnv) {
  const providerConfig = PROVIDER_CONFIGS[provider];
  if (!providerConfig) {
    return null;
  }

  const apiKey = getApiKey(provider, keyEnv);
  if (!apiKey) {
    return null;
  }

  return {
    purpose: "custom",
    provider,
    model,
    apiKey,
    ...providerConfig,
  };
}

/**
 * Get primary model config with fallback chain.
 * @returns {Object[]} Array of configs (primary, then fallback)
 */
function getModelChain() {
  const configs = [];

  const primary = getModelConfig("primary");
  if (primary) {
    configs.push(primary);
  }

  const fallback = getModelConfig("fallback");
  if (fallback && (!primary || fallback.model !== primary.model)) {
    configs.push(fallback);
  }

  return configs;
}

/**
 * Get judge model config.
 * @returns {Object|null} Judge config or primary if judge not configured
 */
function getJudgeConfig() {
  let judge = getModelConfig("judge");

  // If judge not configured, use primary
  if (!judge) {
    judge = getModelConfig("primary");
  }

  return judge;
}

/**
 * List all available providers.
 * @returns {string[]} Provider names
 */
function listProviders() {
  return Object.keys(PROVIDER_CONFIGS);
}

/**
 * Get provider info.
 * @param {string} provider - Provider name
 * @returns {Object|null} Provider config or null
 */
function getProviderInfo(provider) {
  return PROVIDER_CONFIGS[provider] || null;
}

// ============================================================
// Exports
// ============================================================
module.exports = {
  // Configuration getters
  getModelConfig,
  getModelConfigForProvider,
  getModelChain,
  getJudgeConfig,
  getApiKey,

  // Provider info
  listProviders,
  getProviderInfo,

  // Constants
  PROVIDER_CONFIGS,
};
