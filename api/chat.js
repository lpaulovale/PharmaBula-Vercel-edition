const { findSession, saveMessages } = require("../lib/db");

// HuggingFace Router API (OpenAI-compatible)
const HF_MODEL = "meta-llama/Llama-3.1-8B-Instruct:cerebras";
const HF_API_URL = "https://router.huggingface.co/v1/chat/completions";

const SYSTEM_PROMPT_PATIENT = `Você é o PharmaBula, assistente de medicamentos brasileiros. Use linguagem simples. Inclua indicações, contraindicações, efeitos colaterais e posologia. Sempre avise para consultar um profissional de saúde. Responda em português do Brasil, use markdown para formatar: headers, bold, listas, etc.`;

const SYSTEM_PROMPT_PROFESSIONAL = `Você é o PharmaBula, assistente farmacêutico especializado. Use terminologia técnica: princípios ativos, mecanismos de ação, farmacocinética, interações, classificação ATC, protocolos PCDT/SUS, nomenclatura DCB/DCI. Responda em português do Brasil, use markdown para formatar: headers, bold, listas, tabelas, etc.`;

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
    const messages = [{ role: "system", content: systemPrompt }];

    // Load conversation history from MongoDB Data API
    if (sessionId) {
      const session = await findSession(sessionId);
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

    messages.push({ role: "user", content: message });

    // Call HuggingFace Router API
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
      throw new Error(`HuggingFace API retornou status ${hfResponse.status}: ${errorBody}`);
    }

    const data = await hfResponse.json();
    const responseText = data.choices?.[0]?.message?.content || "Não foi possível gerar uma resposta.";

    // Save exchange to MongoDB via Data API (fire and forget)
    if (sessionId) {
      const newMessages = [
        { role: "user", text: message, timestamp: new Date().toISOString() },
        { role: "model", text: responseText, timestamp: new Date().toISOString() },
      ];
      saveMessages(sessionId, newMessages, mode || "patient").catch(() => {});
    }

    return res.status(200).json({
      response: responseText,
      mode: mode || "patient",
      framework: "llama-3.1-8b",
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
