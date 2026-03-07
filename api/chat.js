/**
 * PharmaBula Chat API — MCP-Style Architecture
 * 
 * Implements the MCP (Model Context Protocol) pattern:
 * 1. Extract drug names from user message
 * 2. Execute MCP tools (search_medication, get_bula_data, check_interactions)
 * 3. Inject tool results as context into the LLM prompt
 * 4. Generate response grounded in real bula data
 * 5. Return response with source citations
 */

const { getSessionsCollection } = require("../lib/db");
const { executeTools } = require("../lib/tools");

// HuggingFace Router API (OpenAI-compatible)
const HF_MODEL = "meta-llama/Llama-3.1-8B-Instruct:cerebras";
const HF_API_URL = "https://router.huggingface.co/v1/chat/completions";

// MCP-style prompts matching the original server.py
const SYSTEM_PROMPT_PATIENT = `Você é o PharmaBula, assistente especializado em informações sobre medicamentos do bulário eletrônico brasileiro (ANVISA).

MODO: PACIENTE

DIRETRIZES:
- Responda APENAS com base nas informações das bulas oficiais fornecidas no CONTEXTO
- Use linguagem SIMPLES e acessível, evitando jargão técnico
- Priorize informações práticas: para que serve, como usar, efeitos comuns
- SEMPRE inclua aviso para consultar médico ou farmacêutico
- Destaque contraindicações de forma clara mas não alarmista
- Use analogias do cotidiano quando possível
- Estruture a resposta com markdown (headers, listas, bold)
- NUNCA invente informações além das fontes fornecidas`;

const SYSTEM_PROMPT_PROFESSIONAL = `Você é o PharmaBula, assistente especializado em informações sobre medicamentos do bulário eletrônico brasileiro (ANVISA).

MODO: PROFISSIONAL DE SAÚDE

DIRETRIZES:
- Responda APENAS com base nas informações das bulas oficiais fornecidas no CONTEXTO
- Use terminologia médica/farmacêutica apropriada
- Inclua mecanismo de ação, farmacocinética e farmacodinâmica quando disponíveis
- Detalhe ajustes posológicos para populações especiais
- Liste interações medicamentosas clinicamente significativas
- Cite classificação ATC e denominação DCB/DCI quando disponíveis
- Forneça informações sobre monitoramento laboratorial se aplicável
- Estruture a resposta com markdown (headers, listas, tabelas, bold)
- NUNCA invente informações além das fontes fornecidas`;

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
    // =========================================
    // Step 1: Execute MCP Tools
    // =========================================
    const toolOutput = await executeTools(message, mode || "patient");

    // =========================================
    // Step 2: Build system prompt with context
    // =========================================
    const basePrompt = mode === "professional"
      ? SYSTEM_PROMPT_PROFESSIONAL
      : SYSTEM_PROMPT_PATIENT;

    let systemPrompt = basePrompt;

    if (toolOutput.context) {
      systemPrompt += `\n\nCONTEXTO DAS BULAS (dados oficiais):\n${toolOutput.context}`;
    } else {
      systemPrompt += `\n\nNenhum medicamento específico foi identificado na pergunta. Responda com base em seu conhecimento geral sobre medicamentos brasileiros, mas sempre recomende consultar a bula oficial.`;
    }

    const messages = [{ role: "system", content: systemPrompt }];

    // =========================================
    // Step 3: Load conversation history
    // =========================================
    const sessions = await getSessionsCollection();

    if (sessions && sessionId) {
      try {
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
      } catch (dbErr) {
        console.warn("MongoDB history load failed:", dbErr.message);
      }
    }

    messages.push({ role: "user", content: message });

    // =========================================
    // Step 4: Call LLM (HuggingFace)
    // =========================================
    const hfResponse = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages,
        max_tokens: 1500,
        temperature: 0.3,
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

    // =========================================
    // Step 5: Save to MongoDB (fire and forget)
    // =========================================
    if (sessions && sessionId) {
      const newMessages = [
        { role: "user", text: message, timestamp: new Date() },
        { role: "model", text: responseText, timestamp: new Date() },
      ];

      sessions.updateOne(
        { sessionId },
        {
          $push: { messages: { $each: newMessages } },
          $set: { lastActive: new Date(), mode: mode || "patient" },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      ).catch(err => console.warn("MongoDB save failed:", err.message));
    }

    // =========================================
    // Step 6: Return response with sources
    // =========================================
    return res.status(200).json({
      response: responseText,
      mode: mode || "patient",
      framework: "mcp-llama-3.1",
      sources: toolOutput.sources.map(s => s.name),
      source_files: toolOutput.sources.map(s => ({
        name: s.name,
        drug_id: s.drug_id,
        pdf_url: `/api/pdfs/${s.drug_id}`,
      })),
      metadata: {
        drugsDetected: toolOutput.drugsDetected,
        toolsExecuted: toolOutput.toolResults.map(r => r.tool),
        bulaType: mode === "professional" ? "profissional" : "paciente",
      },
    });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({
      detail: `Erro ao processar sua mensagem: ${error.message}`,
    });
  }
};
