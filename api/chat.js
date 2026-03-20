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
const { getSystemPrompt, buildContextPrompt, getNoDataPrompt, getResponsePrompt } = require("../lib/prompt_manager");
const { planQuery } = require("../lib/planner");
const { chat, chatWithModel } = require("../lib/llm_client");
const { tagAndFilter, groupByTag } = require("../lib/tagger");

const MAX_HISTORY_MESSAGES = 6;

/**
 * Format a tag as a readable title.
 * @param {string} tag - Tag name (e.g., "dosage_adult", "side_effects_dermatologic")
 * @returns {string} Readable title
 */
function formatTagAsTitle(tag) {
  const tagTitles = {
    // Dosage
    'dosage_adult': 'Posologia para Adultos',
    'dosage_pediatric': 'Posologia para Crianças',
    'dosage_elderly': 'Posologia para Idosos',
    'dosage_renal': 'Dosagem para Insuficiência Renal',
    'dosage_hepatic': 'Dosagem para Insuficiência Hepática',
    'dosage_diabetic': 'Informações para Diabéticos',
    'administration': 'Como Administrar',
    'max_dose': 'Dose Máxima',
    'age_restriction': 'Restrições de Idade',
    
    // Side effects by category
    'side_effects_hypersensitivity': 'Reações de Hipersensibilidade',
    'side_effects_hematologic': 'Reações Hematológicas',
    'side_effects_dermatologic': 'Reações da Pele',
    'side_effects_gastrointestinal': 'Reações Gastrointestinais',
    'side_effects_cardiovascular': 'Reações Cardiovasculares',
    'side_effects_hepatic': 'Reações Hepáticas',
    'side_effects_renal': 'Reações Renais',
    'side_effects_neurologic': 'Reações Neurológicas',
    'side_effects_other': 'Outras Reações',
    
    // Warnings
    'warning_pregnancy': 'Uso em Grávidas',
    'warning_lactation': 'Uso durante Amamentação',
    'warning_alcohol': 'Interação com Álcool',
    'warning_driving': 'Direção e Operação de Máquinas',
    'warning_children': 'Uso em Crianças',
    'warning_elderly': 'Uso em Idosos',
    'warning_prolonged_use': 'Uso Prolongado',
    'warning_diabetic': 'Atenção para Diabéticos',
    'warning_renal': 'Atenção para Pacientes Renais',
    'warning_hepatic': 'Atenção para Pacientes Hepáticos',
    
    // Contraindications
    'contraindication_allergy': 'Alergias',
    'contraindication_disease': 'Doenças Contraindicadas',
    'contraindication_age': 'Faixas Etárias Contraindicadas',
    'contraindication_pregnancy': 'Uso na Gravidez',
  };
  
  // Exact match
  if (tagTitles[tag]) {
    return tagTitles[tag];
  }
  
  // Handle weight-based tags (dosage_pediatric_weight_5_8kg)
  const weightMatch = tag.match(/dosage_pediatric_weight_(\d+)_(\d+)kg/);
  if (weightMatch) {
    return `${weightMatch[1]} a ${weightMatch[2]} kg`;
  }
  
  // Generic fallback - capitalize and replace underscores
  return tag
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

module.exports = async function handler(req, res) {
  const totalStartTime = Date.now();
  
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ detail: "Método não permitido." });

  const { message, mode = "patient", sessionId, model: runtimeModel } = req.body || {};
  console.log(`[API] Received mode: ${mode}, message length: ${message.length}`);
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
    // Step 3: Execute tools from plan (with fallback support)
    // =========================================
    const toolResults = [];
    const toolLog = [];

    // Debug: log planned sections
    console.log('[DEBUG] Planned tools:', JSON.stringify(plan.tools, null, 2));
    console.log('[DEBUG] Plan fallbacks:', JSON.stringify(plan.fallbacks, null, 2));

    if (plan.tools.length === 0) {
      console.log("[MCP] No tools to execute.");
    } else {
      console.log(`[MCP] Executing ${plan.tools.length} tool(s)...`);

      // Execute tools sequentially to support fallback
      for (const toolCall of plan.tools) {
        try {
          let result = await executeTool(toolCall.name, toolCall.args);
          toolLog.push({ tool: toolCall.name, args: toolCall.args });

          // Check if we need to use fallback (section not found)
          // Look for matching fallback in plan.fallbacks array
          if (result.found === false && toolCall.name === 'get_section') {
            const fallbackInfo = plan.fallbacks?.find(f => f.section === toolCall.args?.section);
            if (fallbackInfo) {
              console.log(`[MCP] Section not found (${toolCall.args.section}), falling back to ${fallbackInfo.fallback}`);
              result = await executeTool(fallbackInfo.fallback, { drug_name: toolCall.args.drug_name, mode: toolCall.args.mode });
              toolLog.push({ tool: fallbackInfo.fallback, args: { drug_name: toolCall.args.drug_name, mode: toolCall.args.mode }, fallback: true });
              result._usedFallback = true;
            }
          }

          toolResults.push(result);
        } catch (err) {
          console.error(`[MCP] Tool ${toolCall.name} failed:`, err.message);
          toolResults.push({ tool: toolCall.name, error: err.message });
        }
      }
    }

    // =========================================
    // FAIL CLEANLY if MongoDB tools returned errors
    // =========================================
    const mongoFailure = toolResults.find(r =>
      (r.tool === "get_bula_data" || r.tool === "get_section") &&
      r.found === false &&
      r.error
    );

    if (mongoFailure) {
      return res.status(200).json({
        response: mongoFailure.error,
        sources: [],
        metadata: {
          mode,
          drugsDetected: plan.drugs || [],
          mongoError: true,
          toolsExecuted: toolLog,
        },
      });
    }

    // =========================================
    // Step 4: Tag and filter content (NEW)
    // =========================================
    let taggedContext = null;
    const taggerStartTime = Date.now();

    if (toolResults.length > 0 && plan.tags && plan.tags.length > 0) {
      console.log('[Tagger] Tagging and filtering content for tags:', plan.tags);

      const allTaggedSentences = [];

      for (const result of toolResults) {
        if ((result.tool === 'get_section' || result.tool === 'get_bula_data') && result.found && result.data) {
          const content = result.data.content || result.data.textContent || '';
          const section = result.data.section || 'bula_completa';

          if (content && content.length > 50) {
            try {
              const tagged = await tagAndFilter(content, section, plan.tags);
              allTaggedSentences.push(...tagged);
            } catch (err) {
              console.warn(`[Tagger] Failed for section ${section}:`, err.message);
            }
          }
        }
      }

      if (allTaggedSentences.length > 0) {
        // Group by tag for organized output
        const grouped = groupByTag(allTaggedSentences);

        // Build formatted context from tagged sentences
        taggedContext = Object.entries(grouped).map(([tag, sentences]) => {
          const title = formatTagAsTitle(tag);
          
          // Use bullets only for list-like content (dosages, independent items)
          const useBullets = tag.includes('dosage') || 
                             tag.includes('contraindication') ||
                             tag.includes('administration') ||
                             tag.includes('max_dose');
          
          // Capitalize each sentence
          const formattedSentences = sentences.map(s => {
            const trimmed = s.trim();
            return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
          });
          
          if (useBullets) {
            // Bullet list format
            const bullets = formattedSentences.map(s => `• ${s}`);
            return `## ${title}\n\n${bullets.join('\n\n')}`;
          } else {
            // Group related sentences into short paragraphs (2-4 sentences each)
            const paragraphs = [];
            let currentParagraph = [];
            
            for (const sentence of formattedSentences) {
              currentParagraph.push(sentence);
              
              // Start new paragraph after 3 sentences or if sentence seems like a topic shift
              if (currentParagraph.length >= 3 || 
                  sentence.includes('outras reações') ||
                  sentence.includes('além das') ||
                  sentence.includes('podem ocorrer') ||
                  sentence.includes('em pacientes')) {
                paragraphs.push(currentParagraph.join(' '));
                currentParagraph = [];
              }
            }
            
            // Don't forget the last paragraph
            if (currentParagraph.length > 0) {
              paragraphs.push(currentParagraph.join(' '));
            }
            
            return `## ${title}\n\n${paragraphs.join('\n\n')}`;
          }
        }).join('\n\n');

        const taggerElapsed = Date.now() - taggerStartTime;
        console.log(`[Tagger] Total: ${taggerElapsed}ms, ${Object.keys(grouped).length} sections, ${allTaggedSentences.length} sentences`);
      }
    }

    // =========================================
    // Step 5: Build prompt via prompt_manager
    // =========================================
    const context = taggedContext || buildContextPrompt(toolResults);

    // Debug: log what sections are in the context
    console.log('[DEBUG] Context sections:', toolResults
      .filter(r => r.tool === 'get_section' && r.found)
      .map(r => r.data.section));

    const systemPrompt = getResponsePrompt(mode, {
      date: new Date().toISOString().split("T")[0],
      question: message,
      documents: context || getNoDataPrompt(),
      topics: plan.topics || [],
      implicitQuestions: plan.implicit_questions || [],
      tags: plan.tags || [],
    });

    const messages = [{ role: "system", content: systemPrompt }];

    for (const m of historyMessages) {
      messages.push({
        role: m.role === "model" ? "assistant" : "user",
        content: m.text,
      });
    }

    messages.push({ role: "user", content: message });

    // Debug: log what's being sent to LLM
    console.log('[DEBUG] LLM prompt documents length:', context?.length || 0);
    if (context) {
      console.log('[DEBUG] LLM prompt preview:', context.substring(0, 500));
    }

    // =========================================
    // Step 5: Call LLM for response
    // =========================================
    const responseStartTime = Date.now();
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
        // Limit tokens to prevent runaway generation
        llmResult = await chat(messages, { temperature: 0.3, maxTokens: 512 });
      }
      
      const responseElapsed = Date.now() - responseStartTime;
      console.log(`[Response LLM] Generated ${llmResult.text?.length || 0} chars in ${responseElapsed}ms`);
    } catch (llmErr) {
      const responseElapsed = Date.now() - responseStartTime;
      console.error(`[Response LLM] Failed after ${responseElapsed}ms:`, llmErr.message);
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
    console.log('[DEBUG] toolResults summary:',
      toolResults.map(r => ({
        tool: r.tool,
        found: r.found,
        hasData: !!r.data,
        usedFallback: !!r._usedFallback,
      }))
    );

    const sources = [];
    const seenNames = new Set();
    const extractedData = {}; // Store extracted section data for popup display

    for (const r of toolResults) {
      console.log('[DEBUG] chat.js processing toolResult:', {
        tool: r.tool,
        found: r.found,
        hasData: !!r.data,
        section: r.data?.section,
        contentLength: (r.data?.content || r.data?.textContent)?.length,
      });

      if ((r.tool === "get_bula_data" || r.tool === "get_section") && r.found && r.data) {
        const drugName = r.data.name;
        const sectionName = r.tool === "get_section" ? r.data.section : "bula_completa";
        const displayName = `Bula ${drugName}`;

        // Get content - normalize field names for frontend
        const content = r.data.content || r.data.textContent || r.data.textContent;

        // Debug: log what section was retrieved
        console.log('[DEBUG] Storing extracted section:', { 
          drugName, 
          section: sectionName, 
          contentLength: content?.length,
          hasContent: !!content,
        });

        // Store extracted data for popup
        if (!extractedData[drugName]) {
          extractedData[drugName] = {
            name: drugName,
            sections: {}
          };
        }
        
        // Ensure content is never undefined/null for frontend
        extractedData[drugName].sections[sectionName] = content || "Conteúdo não disponível.";

        // Add source only once per drug
        if (!seenNames.has(drugName)) {
          seenNames.add(drugName);
          sources.push({
            name: drugName,
            displayName: displayName,
          });
          console.log('[DEBUG] chat.js added source:', { name: drugName });
        }
      }
      if (r.tool === "search_medication" && r.resultsCount > 0) {
        for (const res of r.results) {
          const name = `Bula ${res.name} - ${res.company}`;
          if (!seenNames.has(name)) {
            seenNames.add(name);
            sources.push({
              name: res.name,
              displayName: name,
            });
          }
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

    // Debug: log extracted data before sending
    const extractedDataDebug = Object.keys(extractedData).reduce((acc, drug) => {
      acc[drug] = Object.keys(extractedData[drug].sections).reduce((secAcc, section) => {
        secAcc[section] = {
          length: extractedData[drug].sections[section]?.length || 0,
          hasContent: !!extractedData[drug].sections[section],
        };
        return secAcc;
      }, {});
      return acc;
    }, {});
    
    console.log('[DEBUG] Extracted data to send:', extractedDataDebug);
    console.log('[DEBUG] Full extractedData JSON:', JSON.stringify(extractedData, null, 2));

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
        usedFallback: llmResult?.usedFallback || false,
        plan: plan,
        // Add extracted data for popup display
        extractedData: Object.keys(extractedData).length > 0 ? extractedData : null,
      },
    });
  } catch (err) {
    console.error("Chat handler error:", err);
    return res.status(500).json({ detail: "Erro interno do servidor.", error: err.message });
  } finally {
    const totalTime = Date.now() - totalStartTime;
    console.log(`[API] Total request time: ${totalTime}ms`);
  }
};
