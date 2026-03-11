const { getModelChain } = require("../lib/llm_config");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  try {
    const chain = getModelChain();
    
    return res.status(200).json({
      envCheck: {
        primaryProvider: process.env.PRIMARY_PROVIDER || null,
        primaryModel: process.env.PRIMARY_MODEL || null,
        primaryApiKeyExists: !!process.env.PRIMARY_API_KEY,
        primaryApiKeyLength: process.env.PRIMARY_API_KEY ? process.env.PRIMARY_API_KEY.length : 0,
        hfTokenExists: !!process.env.HF_TOKEN,
        hfTokenLength: process.env.HF_TOKEN ? process.env.HF_TOKEN.length : 0,
      },
      resolvedChain: chain.map(c => ({
        ...c,
        apiKey: c.apiKey ? `*** (length: ${c.apiKey.length})` : null
      }))
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
      envCheck: {
        primaryProvider: process.env.PRIMARY_PROVIDER || null,
        primaryModel: process.env.PRIMARY_MODEL || null,
        primaryApiKeyExists: !!process.env.PRIMARY_API_KEY,
      }
    });
  }
};
