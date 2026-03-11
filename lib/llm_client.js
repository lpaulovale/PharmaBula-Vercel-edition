/**
 * LLM Client for BulaIA
 *
 * Provider-agnostic LLM API client.
 * Handles request/response formatting for different providers.
 *
 * Usage:
 *   const { chat } = require("./lib/llm_client");
 *   const response = await chat(messages, { model: "custom-model", provider: "openai" });
 *
 * Or with config from llm_config:
 *   const { chatWithConfig } = require("./lib/llm_client");
 *   const response = await chatWithConfig(messages, "primary"); // or "fallback", "judge"
 */

const { getModelChain, getJudgeConfig, getModelConfigForProvider } = require("./llm_config");

// ============================================================
// Request/Response Formatters
// ============================================================

/**
 * Format messages for OpenAI-compatible APIs.
 * @param {Array} messages - Array of { role, content }
 * @param {string} model - Model name
 * @param {Object} options - Additional options
 * @returns {Object} Request body
 */
function formatOpenAIRequest(messages, model, options = {}) {
  return {
    model,
    messages,
    max_tokens: options.maxTokens || 1024,
    temperature: options.temperature !== undefined ? options.temperature : 0.3,
  };
}

/**
 * Format messages for Anthropic API.
 * @param {Array} messages - Array of { role, content }
 * @param {string} model - Model name
 * @param {Object} options - Additional options
 * @returns {Object} Request body
 */
function formatAnthropicRequest(messages, model, options = {}) {
  // Convert OpenAI format to Anthropic format
  const anthropicMessages = messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  const systemMessage = messages.find(m => m.role === "system");

  return {
    model,
    messages: anthropicMessages,
    max_tokens: options.maxTokens || 1024,
    system: systemMessage?.content || "",
  };
}

/**
 * Format messages for Google AI API.
 * @param {Array} messages - Array of { role, content }
 * @param {string} model - Model name
 * @param {Object} options - Additional options
 * @returns {Object} Request body
 */
function formatGoogleRequest(messages, model, options = {}) {
  // Google uses contents array with role: "user" | "model"
  const contents = messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const systemMessage = messages.find(m => m.role === "system");

  return {
    contents,
    systemInstruction: systemMessage ? { role: "system", parts: [{ text: systemMessage.content }] } : undefined,
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ],
    generationConfig: {
      maxOutputTokens: options.maxTokens || 1024,
      temperature: options.temperature !== undefined ? options.temperature : 0.3,
    },
  };
}

/**
 * Format request based on provider.
 * @param {string} provider - Provider name
 * @param {Array} messages - Messages array
 * @param {string} model - Model name
 * @param {Object} options - Options
 * @returns {Object} Formatted request body
 */
function formatRequest(provider, messages, model, options = {}) {
  switch (provider) {
    case "anthropic":
      return formatAnthropicRequest(messages, model, options);
    case "google":
      return formatGoogleRequest(messages, model, options);
    case "openai":
    case "huggingface":
    default:
      return formatOpenAIRequest(messages, model, options);
  }
}

/**
 * Parse response based on provider.
 * @param {string} provider - Provider name
 * @param {Object} data - Response data
 * @returns {string} Response text
 */
function parseResponse(provider, data) {
  try {
    switch (provider) {
      case "anthropic":
        return data.content?.[0]?.text || "";
      case "google":
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      case "openai":
      case "huggingface":
      default:
        return data.choices?.[0]?.message?.content || "";
    }
  } catch (err) {
    console.error(`[LLM Client] Failed to parse ${provider} response:`, err.message);
    return "";
  }
}

/**
 * Build fetch URL for provider.
 * @param {string} provider - Provider name
 * @param {string} baseUrl - Base URL from config
 * @param {string} apiKey - API key
 * @param {string} model - Model name (for providers that need it in URL)
 * @returns {string} Full URL
 */
function buildFetchUrl(provider, baseUrl, apiKey, model) {
  if (provider === "google") {
    // Google uses query param for API key and model in URL
    return `${baseUrl}/${model}:generateContent?key=${apiKey}`;
  }
  return baseUrl;
}

/**
 * Build headers for provider.
 * @param {string} provider - Provider name
 * @param {string} authHeader - Auth header name
 * @param {string} authPrefix - Auth header prefix
 * @param {string} apiKey - API key
 * @param {Object} additionalHeaders - Additional headers from config
 * @returns {Object} Headers object
 */
function buildHeaders(provider, authHeader, authPrefix, apiKey, additionalHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (authHeader && apiKey) {
    headers[authHeader] = `${authPrefix}${apiKey}`;
  }

  // Add provider-specific headers
  if (additionalHeaders) {
    Object.assign(headers, additionalHeaders);
  }

  return headers;
}

// ============================================================
// Core Chat Function
// ============================================================

/**
 * Call LLM with explicit config.
 * @param {Array} messages - Array of { role, content }
 * @param {Object} config - Config from llm_config
 * @param {Object} options - Additional options
 * @returns {Promise<{ text: string, raw: Object, config: Object }>}
 */
async function chatWithConfig(messages, config, options = {}) {
  if (!config) {
    throw new Error("LLM config not provided");
  }

  const { provider, model, apiKey, baseUrl, authHeader, authPrefix, bodyFormat, additionalHeaders } = config;

  const url = buildFetchUrl(provider, baseUrl, apiKey, model);
  const body = formatRequest(provider, messages, model, options);
  const headers = buildHeaders(provider, authHeader, authPrefix, apiKey, additionalHeaders);

  console.log(`[LLM Client] Calling ${provider}/${model}`);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[LLM Client] ${provider} API error:`, response.status, errorText);
    throw new Error(`${provider} API returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = parseResponse(provider, data);

  return {
    text,
    raw: data,
    config: { provider, model },
  };
}

/**
 * Call LLM with fallback chain.
 * Tries primary config, then fallback if available.
 * @param {Array} messages - Array of { role, content }
 * @param {Object} options - Additional options
 * @returns {Promise<{ text: string, raw: Object, config: Object }>}
 */
async function chat(messages, options = {}) {
  const chain = getModelChain();

  if (chain.length === 0) {
    throw new Error("No LLM models configured. Check PRIMARY_MODEL and PRIMARY_API_KEY env vars.");
  }

  let lastError = null;

  for (const config of chain) {
    try {
      return await chatWithConfig(messages, config, options);
    } catch (err) {
      console.warn(`[LLM Client] ${config.provider}/${config.model} failed:`, err.message);
      lastError = err;
      // Continue to next in chain
    }
  }

  throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`);
}

/**
 * Call LLM for judge evaluation.
 * Uses judge config or falls back to primary.
 * @param {Array} messages - Array of { role, content }
 * @param {Object} options - Additional options
 * @returns {Promise<{ text: string, raw: Object, config: Object }>}
 */
async function chatForJudge(messages, options = {}) {
  const config = getJudgeConfig();

  if (!config) {
    throw new Error("No judge model configured. Check JUDGE_MODEL or PRIMARY_MODEL env vars.");
  }

  // Judges typically need temperature 0 for consistency
  return chatWithConfig(messages, config, { temperature: 0, ...options });
}

/**
 * Call LLM with custom provider/model.
 * Useful for runtime model selection.
 * @param {Array} messages - Array of { role, content }
 * @param {Object} options - { provider, model, apiKey, ...llmOptions }
 * @returns {Promise<{ text: string, raw: Object, config: Object }>}
 */
async function chatWithModel(messages, options = {}) {
  const { provider, model, apiKey, ...llmOptions } = options;

  if (!provider || !model) {
    throw new Error("provider and model are required when using chatWithModel");
  }

  const config = getModelConfigForProvider(provider, model, "PRIMARY_API_KEY");

  if (!config) {
    throw new Error(`Could not load config for ${provider}/${model}. Check API key.`);
  }

  // Override API key if provided directly
  if (apiKey) {
    config.apiKey = apiKey;
  }

  return chatWithConfig(messages, config, llmOptions);
}

// ============================================================
// Exports
// ============================================================
module.exports = {
  // Main chat functions
  chat,
  chatWithConfig,
  chatForJudge,
  chatWithModel,

  // Formatters (exported for testing/advanced use)
  formatRequest,
  parseResponse,
  formatOpenAIRequest,
  formatAnthropicRequest,
  formatGoogleRequest,
};
