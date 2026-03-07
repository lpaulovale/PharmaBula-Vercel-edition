const { getSessionsCollection } = require("../lib/db");

const HF_MODEL = "mistralai/Mistral-7B-Instruct-v0.3";
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}/v1/chat/completions`;

const SYSTEM_PROMPT_PATIENT = `Você é o PharmaBula, assistente de medicamentos brasileiros. Use linguagem simples. Inclua indicações, contraindicações, efeitos colaterais e posologia. Sempre avise para consultar um profissional de saúde. Responda em português do Brasil, texto plano com bullet points.`;

const SYSTEM_PROMPT_PROFESSIONAL = `Você é o PharmaBula, assistente farmacêutico especializado. Use terminologia técnica: princípios ativos, mecanismos de ação, farmacocinética, interações, classificação ATC, protocolos PCDT/SUS, nomenclatura DCB/DCI. Responda em português do Brasil, texto plano com bullet points.`;

const MAX_HISTORY_MESSAGES = 6;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ detail: "Method not allowed" });
  }

  const { message, mode, sessionId } = req.body || {};

  if (!message || message.length < 2) {
    return res.status(400).json({ detail: "A mensagem deve ter pelo menos 2 caracteres." });
  }

  const apiKey = process.env.HF_TOKEN;
  if (!apiKey) {
    return res.status(500).json({ detail: "HF_TOKEN não configurado no servidor." });
  }

  try {
    const systemPrompt = mode === "professional" ? SYSTEM_PROMPT_PROFESSIONAL : SYSTEM_PROMPT_PATIENT;

    // Build the messages array with system prompt
    const messages = [{ role: "system", content: systemPrompt }];

    // Load conversation history from MongoDB if available
    const sessions = await getSessionsCollection();

    if (sessions && sessionId) {
      const session = await sessions.findOne({ sessionId });
      if (session && session.messages) {
        const recentMessages = session.messages.slice(-MAX_HISTORY_MESSAGES);
        for (const m of recentMessages) {
          messages.push({
            role: m.role === "model" ? "assistant" : "user",
            content: m.text,
          });
        }
      }
    }

    // Add the current user message
    messages.push({ role: "user", content: message });

    // Call HuggingFace Inference API (OpenAI-compatible chat completions)
    const hfResponse = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!hfResponse.ok) {
      const errorBody = await hfResponse.text();
      console.error("HuggingFace API error:", hfResponse.status, errorBody);

      if (hfResponse.status === 429) {
        return res.status(429).json({
          detail: "Limite de uso atingido. Aguarde um momento e tente novamente.",
        });
      }
      if (hfResponse.status === 503) {
        return res.status(503).json({
          detail: "Modelo está carregando. Tente novamente em ~20 segundos.",
        });
      }
      throw new Error(`HuggingFace API retornou status ${hfResponse.status}`);
    }

    const data = await hfResponse.json();
    const responseText = data.choices?.[0]?.message?.content || "Não foi possível gerar uma resposta.";

    // Save the exchange to MongoDB
    if (sessions && sessionId) {
      const newMessages = [
        { role: "user", text: message, timestamp: new Date() },
        { role: "model", text: responseText, timestamp: new Date() },
      ];

      await sessions.updateOne(
        { sessionId },
        {
          $push: { messages: { $each: newMessages } },
          $set: { lastActive: new Date(), mode: mode || "patient" },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
    }

    return res.status(200).json({
      response: responseText,
      mode: mode || "patient",
      framework: "llama-3-70b",
      sources: [],
      source_files: [],
      metadata: {},
    });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({
      detail: `Erro ao processar sua mensagem: ${error.message}`,
    });
  }
};
