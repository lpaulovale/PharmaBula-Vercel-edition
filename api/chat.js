/**
 * PharmaBula Chat API — MCP Architecture
 * 
 * Orchestrator that coordinates the MCP components:
 *   1. prompt_manager  → system prompts by mode
 *   2. tool_registry   → tool schemas, discovery, execution
 *   3. resource_manager → data sources (sample data, ANVISA API)
 *   4. tools.js         → drug extraction + intent detection
 * 
 * Flow:
 *   1. Load conversation history (MongoDB)
 *   2. Extract drug names (LLM + local fallback)
 *   3. Detect intent (generics? section? general?)
 *   4. Execute tools via tool_registry
 *   5. Build prompt via prompt_manager
 *   6. Call LLM → return response + sources
 */

const { getSessionsCollection } = require("../lib/db");
const { executeTool, listTools } = require("../lib/tool_registry");
const { getSystemPrompt, buildContextPrompt, getNoDataPrompt } = require("../lib/prompt_manager");
const { extractDrugNames, localFallbackExtract, detectIntent } = require("../lib/tools");

// HuggingFace Router API
const HF_MODEL = "meta-llama/Llama-3.1-8B-Instruct:cerebras";
const HF_API_URL = "https://router.huggingface.co/v1/chat/completions";
const MAX_HISTORY_MESSAGES = 6;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Método não permitido." });

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
    // Step 1: Load conversation history
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

    // Build context string for the drug extractor
    const recentContext = historyMessages
      .map(m => `${m.role === "model" ? "Assistente" : "Usuário"}: ${m.text}`)
      .join("\n");

    const fullMessageForExtraction = recentContext
      ? `Contexto da conversa anterior:\n${recentContext}\n\nMensagem atual: ${message}`
      : message;

    // =========================================
    // Step 2: Extract drug names
    // =========================================
    let drugNames = await extractDrugNames(fullMessageForExtraction, apiKey);
    console.log("[MCP] Drugs detected by LLM:", drugNames);

    if (drugNames.length === 0) {
      drugNames = localFallbackExtract(fullMessageForExtraction);
      console.log("[MCP] Drugs detected by local fallback:", drugNames);
    }

    // Last resort: try each word against sample data
    if (drugNames.length === 0) {
      const words = message.toLowerCase().split(/[\s,.;:!?]+/).filter(w => w.length > 3);
      for (const word of words) {
        const result = await executeTool("get_bula_data", { drug_name: word, mode: mode || "patient" });
        if (result.found) {
          drugNames.push(word);
          break;
        }
      }
    }

    // =========================================
    // Step 3: Detect intent
    // =========================================
    const intent = detectIntent(fullMessageForExtraction);
    console.log("[MCP] Intent:", intent.type, intent.section ? `(${intent.section})` : "");

    // =========================================
    // Step 4: Execute tools via registry (ROUTER)
    // =========================================
    const toolResults = [];
    const toolLog = []; // Session discipline: log every tool call

    if (drugNames.length === 0) {
      // No drug found — nothing to tool-call
      console.log("[MCP] No drugs detected, skipping tool execution.");

    } else if (drugNames.length >= 2) {
      // Multiple drugs → check interactions
      const interactionResult = await executeTool("check_interactions", {
        drugs: drugNames, mode: mode || "patient",
      });
      toolResults.push(interactionResult);
      toolLog.push({ tool: "check_interactions", args: { drugs: drugNames } });

      for (const name of drugNames) {
        const bulaResult = await executeTool("get_bula_data", {
          drug_name: name, mode: mode || "patient",
        });
        toolResults.push(bulaResult);
        toolLog.push({ tool: "get_bula_data", args: { drug_name: name } });
      }

    } else {
      // Single drug → ROUTE based on intent
      const drugName = drugNames[0];

      if (intent.type === "generics") {
        // ROUTE A: Find generic versions → present list
        const genericsResult = await executeTool("find_generic_versions", { drug_name: drugName });
        toolResults.push(genericsResult);
        toolLog.push({ tool: "find_generic_versions", args: { drug_name: drugName } });

        // Also get base bula for context
        const bulaResult = await executeTool("get_bula_data", {
          drug_name: drugName, mode: mode || "patient",
        });
        toolResults.push(bulaResult);
        toolLog.push({ tool: "get_bula_data", args: { drug_name: drugName } });

      } else if (intent.type === "section" && intent.section) {
        // ROUTE B: Extract specific section
        const sectionResult = await executeTool("get_section", {
          drug_name: drugName, section: intent.section, mode: mode || "patient",
        });
        toolResults.push(sectionResult);
        toolLog.push({ tool: "get_section", args: { drug_name: drugName, section: intent.section } });

        // If section not found, fallback to full bula
        if (!sectionResult.found) {
          const bulaResult = await executeTool("get_bula_data", {
            drug_name: drugName, mode: mode || "patient",
          });
          toolResults.push(bulaResult);
          toolLog.push({ tool: "get_bula_data", args: { drug_name: drugName } });
        }

      } else {
        // ROUTE C: General query → local bula first, then ANVISA PDF
        const bulaResult = await executeTool("get_bula_data", {
          drug_name: drugName, mode: mode || "patient",
        });
        toolResults.push(bulaResult);
        toolLog.push({ tool: "get_bula_data", args: { drug_name: drugName } });

        // If local data not found, try fetching real bula from ANVISA
        if (!bulaResult.found) {
          console.log(`[MCP] Local bula not found for '${drugName}', trying ANVISA PDF...`);
          const anvisaResult = await executeTool("fetch_anvisa_bula", {
            drug_name: drugName, mode: mode || "patient",
          });
          toolResults.push(anvisaResult);
          toolLog.push({ tool: "fetch_anvisa_bula", args: { drug_name: drugName } });
        }
      }
    }

    // =========================================
    // Step 5: Build prompt via prompt_manager
    // =========================================
    let systemPrompt = getSystemPrompt(mode || "patient");
    const context = buildContextPrompt(toolResults);

    if (context) {
      systemPrompt += `\n\nCONTEXTO DAS BULAS (dados oficiais):\n${context}`;
    } else {
      systemPrompt += getNoDataPrompt();
    }

    const messages = [{ role: "system", content: systemPrompt }];

    for (const m of historyMessages) {
      messages.push({
        role: m.role === "model" ? "assistant" : "user",
        content: m.text,
      });
    }

    messages.push({ role: "user", content: message });

    // =========================================
    // Step 6: Call LLM
    // =========================================
    const llmRes = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      console.error("LLM API error:", llmRes.status, errText);
      return res.status(502).json({ detail: `Erro na API do LLM: ${llmRes.status}` });
    }

    const llmData = await llmRes.json();
    const responseText = llmData.choices?.[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.";

    // =========================================
    // Step 7: Build sources
    // =========================================
    const sources = [];
    const seenNames = new Set();

    for (const r of toolResults) {
      if (r.tool === "get_bula_data" && r.found && r.data) {
        const name = `Bula ${r.data.name} - ANVISA`;
        if (!seenNames.has(name)) {
          seenNames.add(name);
          sources.push(name);
        }
      }
      if (r.tool === "get_section" && r.found && r.data) {
        const name = `Bula ${r.data.name} - ANVISA (${r.data.section})`;
        if (!seenNames.has(name)) {
          seenNames.add(name);
          sources.push(name);
        }
      }
      if (r.tool === "find_generic_versions" && r.versionsFound > 0) {
        for (const v of r.versions) {
          const name = `${v.name} (${v.company})`;
          if (!seenNames.has(name)) {
            seenNames.add(name);
            sources.push(name);
          }
        }
      }
    }

    // =========================================
    // Step 8: Save to session + respond
    // =========================================
    if (sessions && sessionId) {
      try {
        await sessions.updateOne(
          { sessionId },
          {
            $push: {
              messages: {
                $each: [
                  { role: "user", text: message, timestamp: new Date() },
                  { role: "model", text: responseText, timestamp: new Date() },
                ],
              },
            },
            $set: { updatedAt: new Date(), mode },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true }
        );
      } catch (dbErr) {
        console.warn("MongoDB save failed:", dbErr.message);
      }
    }

    return res.status(200).json({
      response: responseText,
      sources,
      metadata: {
        mode: mode || "patient",
        drugsDetected: drugNames,
        intent: intent.type,
        section: intent.section,
        toolsExecuted: toolLog,
        availableTools: listTools().map(t => t.name),
      },
    });

  } catch (err) {
    console.error("Chat handler error:", err);
    return res.status(500).json({ detail: "Erro interno do servidor.", error: err.message });
  }
};
