/**
 * Test Google API directly
 */
const { getModelConfig } = require("../lib/llm_config");
const { chatWithModel } = require("../lib/llm_client");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  try {
    // Test 1: Check config
    const googleConfig = getModelConfig("primary");
    
    // Test 2: Try direct call
    let testResult = null;
    let error = null;
    
    try {
      testResult = await chatWithModel(
        [
          { role: "system", content: "Reply with just OK" },
          { role: "user", content: "Say OK" }
        ],
        {
          provider: "google",
          model: "gemini-1.5-flash",
          maxTokens: 10
        }
      );
    } catch (err) {
      error = err.message;
    }

    return res.status(200).json({
      test: "google-api",
      config: googleConfig ? {
        provider: googleConfig.provider,
        model: googleConfig.model,
        apiKeyLength: googleConfig.apiKey?.length || 0,
        baseUrl: googleConfig.baseUrl,
      } : null,
      testResult: testResult ? {
        text: testResult.text,
        config: testResult.config,
      } : null,
      error: error,
      env: {
        primaryProvider: process.env.PRIMARY_PROVIDER,
        primaryModel: process.env.PRIMARY_MODEL,
        googleApiKeyLength: process.env.GOOGLE_API_KEY?.length || 0,
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
};
