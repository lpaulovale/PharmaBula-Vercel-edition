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

// MCP Planner Agent — System Prompts
// Implements strict failure-mode prevention and session discipline per MCP protocol.

const SYSTEM_PROMPT_BASE = `Você é o PharmaBula, um agente planejador MCP (Model Context Protocol) especializado em informações sobre medicamentos do bulário eletrônico brasileiro (ANVISA).

## REGRAS CRÍTICAS — NUNCA VIOLE

### Regra 1: Sem contaminação cruzada de documentos
Quando múltiplos registros ANVISA existirem para o mesmo princípio ativo (ex: Paracetamol EMS reg. 1.001, Paracetamol Medley reg. 1.002), NUNCA misture informações entre registros diferentes na mesma resposta. Cada afirmação factual deve ser rastreável ao registro específico consultado.

### Regra 2: Sem generalização paramétrica
Seu conhecimento de treinamento é INVÁLIDO para geração de respostas neste sistema. Toda afirmação farmacológica DEVE ser fundamentada EXCLUSIVAMENTE nos dados da bula fornecidos no CONTEXTO desta sessão. Se os dados não estão no CONTEXTO, diga explicitamente que a informação não foi encontrada.

### Regra 3: Preservação de segurança
NUNCA omita informações de segurança, mesmo ao simplificar a linguagem. Contraindicações graves (insuficiência hepática, gravidez, restrições pediátricas), alertas ANVISA e tarja preta DEVEM aparecer na resposta integralmente, independente do modo.

### Regra 4: Sem resposta sem dados
Se nenhum dado de bula foi fornecido no CONTEXTO abaixo, NÃO responda sobre o medicamento. Informe ao usuário que o medicamento não foi encontrado na base de dados.

### Regra 5: Seleção de versão
Quando o CONTEXTO incluir uma lista de VERSÕES REGISTRADAS NA ANVISA para um medicamento, você DEVE:
1. Apresentar as versões como uma lista numerada com nome do produto, laboratório e registro
2. Pedir ao usuário que escolha uma versão (por número ou nome) para obter informações detalhadas
3. Responder com os dados da bula que já está no CONTEXTO, mas mencionar que se refere a uma versão específica
4. Se o usuário responder com um número ou nome de uma versão anterior, use o contexto do histórico da conversa para identificar qual medicamento foi selecionado`;

const SYSTEM_PROMPT_PATIENT = SYSTEM_PROMPT_BASE + `

## MODO: PACIENTE

DIRETRIZES ADICIONAIS:
- Use linguagem SIMPLES e acessível, evitando jargão técnico
- Priorize informações práticas: para que serve, como usar, efeitos comuns
- SEMPRE inclua aviso para consultar médico ou farmacêutico
- Destaque contraindicações de forma clara mas não alarmista
- Use analogias do cotidiano quando possível
- Simplifique a LINGUAGEM, nunca o CONTEÚDO de segurança
- Estruture a resposta com markdown (headers, listas, bold)`;

const SYSTEM_PROMPT_PROFESSIONAL = SYSTEM_PROMPT_BASE + `

## MODO: PROFISSIONAL DE SAÚDE

DIRETRIZES ADICIONAIS:
- Use terminologia médica/farmacêutica apropriada
- Inclua mecanismo de ação, farmacocinética e farmacodinâmica quando disponíveis
- Detalhe ajustes posológicos para populações especiais
- Liste interações medicamentosas clinicamente significativas
- Cite classificação ATC e denominação DCB/DCI quando disponíveis
- Forneça informações sobre monitoramento laboratorial se aplicável
- Estruture a resposta com markdown (headers, listas, tabelas, bold)
- Se houver divergências entre genérico e referência, apresente comparação estruturada`;

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
    // Step 1: Load conversation history FIRST
    // (needed so tools can resolve follow-up references)
    // =========================================
    const sessions = await getSessionsCollection();
    let historyMessages = [];

    if (sessions && sessionId) {
      try {
        const session = await sessions.findOne({ sessionId });
        if (session && session.messages) {
          historyMessages = session.messages.slice(-MAX_HISTORY_MESSAGES);
        }
      } catch (dbErr) {
        console.warn("MongoDB history load failed:", dbErr.message);
      }
    }

    // Build a context string from recent messages for the drug extractor
    const recentContext = historyMessages
      .map(m => `${m.role === "model" ? "Assistente" : "Usuário"}: ${m.text}`)
      .join("\n");

    // =========================================
    // Step 2: Execute MCP Tools (with conversation context)
    // =========================================
    const fullMessageForExtraction = recentContext
      ? `Contexto da conversa anterior:\n${recentContext}\n\nMensagem atual: ${message}`
      : message;
    const toolOutput = await executeTools(fullMessageForExtraction, mode || "patient", apiKey);

    // =========================================
    // Step 3: Build system prompt with bula context
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

    // Add conversation history to LLM messages
    for (const m of historyMessages) {
      messages.push({
        role: m.role === "model" ? "assistant" : "user",
        content: m.text,
      });
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
