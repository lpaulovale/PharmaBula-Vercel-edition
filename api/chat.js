/**
 * BulaIA Chat API — Planner-Based Architecture
 *
 * Simplified orchestrator using LLM planner:
 *   1. planner       → Analyzes question, returns JSON execution plan
 *   2. tool_registry → Executes tools from plan (PARALLEL)
 *   3. prompt_manager → Builds system prompt with tool results
 *   4. llm_client    → Generates final response
 *
 * Flow:
 *   1. Load conversation history (MongoDB)
 *   2. Plan query (LLM) → { drugs, tools[], needs_clarification }
 *   3. Execute tools from plan (PARALLEL with Promise.all)
 *   4. Build prompt via prompt_manager
 *   5. Call LLM → return response + sources
 */

const { getSessionsCollection } = require("../lib/db");
const { executeTool, listTools } = require("../lib/tool_registry");
const { getSystemPrompt, buildContextPrompt, getNoDataPrompt } = require("../lib/prompt_manager");
const { planQuery } = require("../lib/planner");
const { chat, chatWithModel } = require("../lib/llm_client");

const MAX_HISTORY_MESSAGES = 6;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Método não permitido." });

  const { message, mode = "patient", sessionId, model: runtimeModel } = req.body || {};
  if (!message || message.length < 2) {
    return res.status(400).json({ detail: "A mensagem deve ter pelo menos 2 caracteres." });
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

    // =========================================
    // Step 2: Plan query (LLM returns JSON plan)
    // =========================================
    const plan = await planQuery(message, mode, historyMessages);
    console.log("[Planner] Plan received:", JSON.stringify(plan, null, 2));

    // If clarification needed, return early
    if (plan.needs_clarification) {
      return res.status(200).json({
        response: plan.needs_clarification,
        sources: [],
        metadata: {
          mode,
          drugsDetected: plan.drugs || [],
          clarificationNeeded: true,
          availableTools: listTools().map(t => t.name),
          evaluateUrl: "/api/evaluate",
          plan: plan,
        },
      });
    }

    // =========================================
    // Step 2b: Fetch history if planner detected need
    // =========================================
    if (plan.needs_history && sessions && sessionId) {
      try {
        const session = await sessions.findOne({ sessionId });
        if (session && session.messages) {
          historyMessages = session.messages.slice(-MAX_HISTORY_MESSAGES);
          console.log(`[Chat] Fetched ${historyMessages.length} history messages (needs_history=true)`);
        }
      } catch (dbErr) {
        console.warn("[Chat] History fetch failed:", dbErr.message);
      }
    }

    // =========================================
    // Step 3: Execute tools from plan (PARALLEL)
    // =========================================
    const toolResults = [];
    const toolLog = [];

    if (plan.tools.length === 0) {
      console.log("[MCP] No tools to execute.");
    } else {
      console.log(`[MCP] Executing ${plan.tools.length} tool(s) in parallel...`);

      // Execute all tools in parallel
      const results = await Promise.all(
        plan.tools.map(async (toolCall) => {
          try {
            const result = await executeTool(toolCall.name, toolCall.args);
            toolLog.push({ tool: toolCall.name, args: toolCall.args });
            return result;
          } catch (err) {
            console.error(`[MCP] Tool ${toolCall.name} failed:`, err.message);
            return { tool: toolCall.name, error: err.message };
          }
        })
      );

      toolResults.push(...results);
    }

    // =========================================
    // Step 4: Build prompt via prompt_manager
    // =========================================
    const context = buildContextPrompt(toolResults);

    const systemPrompt = getSystemPrompt(mode, {
      date: new Date().toISOString().split("T")[0],
      question: message,
      documents: context || getNoDataPrompt(),
      topics: plan.topics || [],
      implicitQuestions: plan.implicit_questions || [],
    });

    const messages = [{ role: "system", content: systemPrompt }];

    for (const m of historyMessages) {
      messages.push({
        role: m.role === "model" ? "assistant" : "user",
        content: m.text,
      });
    }

    messages.push({ role: "user", content: message });

    // =========================================
    // Step 5: Call LLM for response
    // =========================================
    let llmResult;
    let llmError = null;
    
    try {
      if (runtimeModel) {
        let modelOptions = {};
        if (typeof runtimeModel === "string") {
          modelOptions = { model: runtimeModel };
        } else if (typeof runtimeModel === "object") {
          modelOptions = runtimeModel;
        }
        llmResult = await chatWithModel(messages, modelOptions);
      } else {
        // chat() has built-in fallback chain (primary -> fallback)
        llmResult = await chat(messages, { temperature: 0.3, maxTokens: 1024 });
      }
    } catch (llmErr) {
      console.error("LLM call failed:", llmErr.message);
      llmError = llmErr;
    }
    
    // If LLM call failed and no fallback succeeded, return error
    if (!llmResult) {
      return res.status(502).json({ 
        detail: "Erro na API do LLM: Todos os provedores falharam.", 
        error: llmError?.message,
        suggestion: "Verifique suas chaves de API ou tente novamente mais tarde."
      });
    }

    const responseText = llmResult.text || "Desculpe, não consegui gerar uma resposta.";

    // =========================================
    // Step 6: Build sources
    // =========================================
    const sources = [];
    const seenNames = new Set();

    for (const r of toolResults) {
      if (r.tool === "get_bula_data" && r.found && r.data) {
        const name = `Bula ${r.data.name} - ANVISA`;
        if (!seenNames.has(name)) {
          seenNames.add(name);
          sources.push({
            name: r.data.name,
            displayName: name,
            pdfUrl: r.data.pdfUrl || null
          });
        }
      }
      if (r.tool === "get_section" && r.found && r.data) {
        const name = `Bula ${r.data.name} - ANVISA (${r.data.section})`;
        if (!seenNames.has(name)) {
          seenNames.add(name);
          sources.push({
            name: r.data.name,
            displayName: name,
            pdfUrl: r.data.pdfUrl || null
          });
        }
      }
      if (r.tool === "find_generic_versions" && r.versionsFound > 0) {
        for (const v of r.versions) {
          const name = `${v.name} (${v.company})`;
          if (!seenNames.has(name)) {
            seenNames.add(name);
            sources.push({
              name: v.name,
              displayName: name,
              pdfUrl: v.pdfUrl || null
            });
          }
        }
      }
    }

    // =========================================
    // Step 7: Save to session + respond
    // =========================================
    if (sessions && sessionId) {
      try {
        await sessions.updateOne(
          { sessionId },
          {
            $push: {
              messages: {
                $each: [
                  {
                    role: "user",
                    text: message,
                    timestamp: new Date(),
                    // Store classification context for the question
                    topics: plan.topics || [],
                    implicit_questions: plan.implicit_questions || [],
                    classification_confidence: plan.classification_confidence,
                    classification_method: plan.classification_method,
                  },
                  {
                    role: "model",
                    text: responseText,
                    timestamp: new Date(),
                    // Store what was used to generate the response
                    topics_covered: plan.topics || [],
                    implicit_questions_checklist: plan.implicit_questions || [],
                    tools_executed: toolLog,
                    drugs_detected: plan.drugs || [],
                    model: llmResult?.config || null,
                    needs_history: plan.needs_history || false,
                    // Store retrieved documents (truncated for space)
                    documents_context: context ? context.substring(0, 5000) : null,
                  },
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
        mode,
        drugsDetected: plan.drugs || [],
        toolsExecuted: toolLog,
        availableTools: listTools().map(t => t.name),
        documents: context || null,
        evaluateUrl: "/api/evaluate",
        model: llmResult?.config || null,
        usedFallback: llmResult?.usedFallback || false, // Signal if fallback was used
        plan: plan, // Include full plan for debugging
      },
    });

  } catch (err) {
    console.error("Chat handler error:", err);
    return res.status(500).json({ detail: "Erro interno do servidor.", error: err.message });
  }
};
