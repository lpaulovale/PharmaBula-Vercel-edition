/**
 * Test Judge API directly
 */
const { getJudgeConfig } = require("../lib/llm_config");
const { chatForJudge } = require("../lib/llm_client");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  try {
    // Test 1: Check judge config
    const judgeConfig = getJudgeConfig();
    
    // Test 2: Try direct call
    let testResult = null;
    let error = null;
    
    try {
      testResult = await chatForJudge(
        [
          { role: "system", content: "Reply with just OK" },
          { role: "user", content: "Say OK" }
        ],
        { maxTokens: 10 }
      );
    } catch (err) {
      error = err.message;
    }

    return res.status(200).json({
      test: "judge-api",
      config: judgeConfig ? {
        provider: judgeConfig.provider,
        model: judgeConfig.model,
        apiKeyLength: judgeConfig.apiKey?.length || 0,
        baseUrl: judgeConfig.baseUrl,
      } : null,
      testResult: testResult ? {
        text: testResult.text,
        config: testResult.config,
      } : null,
      error: error,
      env: {
        judgeProvider: process.env.JUDGE_PROVIDER,
        judgeModel: process.env.JUDGE_MODEL,
        judgeApiKeyLength: process.env.JUDGE_API_KEY?.length || 0,
        primaryProvider: process.env.PRIMARY_PROVIDER,
        primaryModel: process.env.PRIMARY_MODEL,
        primaryApiKeyLength: process.env.PRIMARY_API_KEY?.length || 0,
        hfTokenLength: process.env.HF_TOKEN?.length || 0,
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
};
