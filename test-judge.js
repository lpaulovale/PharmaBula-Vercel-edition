/**
 * Test script to debug judge configuration
 */
require('dotenv').config();
const { getJudgeConfig, getModelChain, PROVIDER_CONFIGS } = require("./lib/llm_config");
const { chatForJudge } = require("./lib/llm_client");

console.log("=== Environment Variables ===");
console.log("PRIMARY_PROVIDER:", process.env.PRIMARY_PROVIDER);
console.log("PRIMARY_MODEL:", process.env.PRIMARY_MODEL);
console.log("PRIMARY_API_KEY exists:", !!process.env.PRIMARY_API_KEY);
console.log("PRIMARY_API_KEY length:", process.env.PRIMARY_API_KEY?.length || 0);
console.log("JUDGE_PROVIDER:", process.env.JUDGE_PROVIDER);
console.log("JUDGE_MODEL:", process.env.JUDGE_MODEL);
console.log("JUDGE_API_KEY exists:", !!process.env.JUDGE_API_KEY);
console.log("JUDGE_API_KEY length:", process.env.JUDGE_API_KEY?.length || 0);
console.log("HF_TOKEN exists:", !!process.env.HF_TOKEN);
console.log("HF_TOKEN length:", process.env.HF_TOKEN?.length || 0);
console.log("GOOGLE_API_KEY exists:", !!process.env.GOOGLE_API_KEY);
console.log("GOOGLE_API_KEY length:", process.env.GOOGLE_API_KEY?.length || 0);
console.log("GOOGLE_API_KEY value:", process.env.GOOGLE_API_KEY);

console.log("\n=== Model Chain ===");
const chain = getModelChain();
console.log("Chain length:", chain.length);
chain.forEach((config, i) => {
  console.log(`[${i}] provider: ${config.provider}, model: ${config.model}, apiKey length: ${config.apiKey?.length || 0}`);
});

console.log("\n=== Judge Config ===");
const judgeConfig = getJudgeConfig();
if (judgeConfig) {
  console.log("Judge provider:", judgeConfig.provider);
  console.log("Judge model:", judgeConfig.model);
  console.log("Judge apiKey length:", judgeConfig.apiKey?.length || 0);
  console.log("Judge baseUrl:", judgeConfig.baseUrl);
} else {
  console.log("Judge config: NULL");
}

console.log("\n=== Test Judge LLM Call ===");
(async () => {
  try {
    const messages = [
      { role: "system", content: "You are a test assistant. Return ONLY: OK" },
      { role: "user", content: "Say OK" }
    ];
    
    console.log("Calling chatForJudge...");
    const result = await chatForJudge(messages, { maxTokens: 50 });
    console.log("SUCCESS!");
    console.log("Response:", result.text);
    console.log("Config used:", result.config);
  } catch (err) {
    console.error("FAILED!");
    console.error("Error:", err.message);
    console.error("Stack:", err.stack);
  }
})();
