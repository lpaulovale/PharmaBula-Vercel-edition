const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getSessionsCollection } = require("../lib/db");

// Compact system prompts to reduce token usage
const SYSTEM_PROMPT_PATIENT = `Você é o PharmaBula, assistente de medicamentos brasileiros. Use linguagem simples. Inclua indicações, contraindicações, efeitos colaterais e posologia. Sempre avise para consultar um profissional de saúde. Responda em português do Brasil, texto plano com bullet points.`;

const SYSTEM_PROMPT_PROFESSIONAL = `Você é o PharmaBula, assistente farmacêutico especializado. Use terminologia técnica: princípios ativos, mecanismos de ação, farmacocinética, interações, classificação ATC, protocolos PCDT/SUS, nomenclatura DCB/DCI. Responda em português do Brasil, texto plano com bullet points.`;

// Only keep the last N messages to limit token usage
const MAX_HISTORY_MESSAGES = 6;

module.exports = async function handler(req, res) {
  // CORS headers
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ detail: "GEMINI_API_KEY não configurada no servidor." });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const systemPrompt = mode === "professional" ? SYSTEM_PROMPT_PROFESSIONAL : SYSTEM_PROMPT_PATIENT;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-lite",
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
    });

    // Load conversation history from MongoDB (limited to last N messages)
    let history = [];
    const sessions = await getSessionsCollection();

    if (sessions && sessionId) {
      const session = await sessions.findOne({ sessionId });
      if (session && session.messages) {
        history = session.messages.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
          role: m.role,
          parts: [{ text: m.text }],
        }));
      }
    }

    const chat = model.startChat({ history });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

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
      framework: "gemini",
      sources: [],
      source_files: [],
      metadata: {},
    });
  } catch (error) {
    console.error("Gemini API error:", error);

    // Friendly error for rate limits
    if (error.message && error.message.includes("429")) {
      return res.status(429).json({
        detail: "Limite de uso atingido. Aguarde um momento e tente novamente.",
      });
    }

    return res.status(500).json({
      detail: `Erro ao processar sua mensagem: ${error.message}`,
    });
  }
};
