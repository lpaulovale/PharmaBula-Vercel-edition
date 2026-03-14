/**
 * BulaIA Planner
 *
 * Analyzes user questions and returns a JSON execution plan.
 * The LLM decides which tools to call and with what parameters.
 *
 * Flow:
 *   1. User question + conversation history → LLM
 *   2. LLM returns JSON plan: { drugs, tools, needs_clarification, topics, implicit_questions }
 *   3. Server executes tools from plan (can be parallel!)
 *   4. Tool results → LLM generates final response
 */

const { chat } = require("./llm_client");
const { localFallbackExtract } = require("./tools");
const { getSystemPrompt } = require("./prompt_manager");
const { classifyQuestion, getImplicitQuestions } = require("./question_classifier");

// ============================================================
// Planner API
// ============================================================

/**
 * Analyze user question and return execution plan.
 * @param {string} question - User's question
 * @param {string} mode - "patient" or "professional"
 * @param {Array} history - Previous conversation messages
 * @returns {Promise<Object>} JSON plan: { drugs, tools, needs_clarification, needs_history, topics, implicit_questions, mode }
 */
async function planQuery(question, mode = "patient", history = []) {
  // Step 1: Classify question into topics
  const classification = await classifyQuestion(question);
  const topics = classification.topics.length > 0 ? classification.topics : [];
  const implicitQuestions = getImplicitQuestions(topics);

  const prompt = getSystemPrompt("planner", { mode, 
    date: new Date().toISOString().split("T")[0],
    question,
    documents: "(nenhum documento recuperado ainda)",
  });

  try {
    const jsonSchema = `You are an MCP query planner. Return ONLY valid JSON matching this schema:
{
  "drugs": ["extracted drug names"],
  "topics": ["identified topics"],
  "needs_history": true|false,
  "tools": [
    {
      "name": "get_bula_data",
      "args": { "drug_name": "name", "mode": "patient|professional" }
    }
  ]
}
Available tools: search_medication (args: query, bula_type), get_bula_data (args: drug_name, mode), get_section (args: drug_name, section, mode), search_by_ingredient (args: ingredient), search_text (args: term), check_interactions (args: drugs, mode).

IMPORTANT RULES:
1. Set needs_history=true ONLY if the question contains pronouns or references to previous context (e.g., "ele", "ela", "isso", "esse medicamento", "a dose anterior", "continuar tomando"). For standalone questions about a medication, set needs_history=false.
2. CRITICAL: If the user asks about ONE specific topic (like "efeitos colaterais", "posologia", "contraindicações"), use EXACTLY ONE get_section call for that specific section ONLY.
3. DO NOT fetch multiple sections - fetch ONLY the section that directly answers the question.
4. Section mapping - use EXACTLY these values:
   - "efeitos colaterais" / "reações" / "reações adversas" → section: "reacoes"
   - "posologia" / "dose" / "como tomar" → section: "posologia"
   - "contraindicações" / "quem não pode tomar" → section: "contraindicacao"
   - "indicações" / "para que serve" → section: "indicacao"
   - "advertências" / "precauções" → section: "advertencias"
5. Only use get_bula_data if the user asks for "informações completas" or "tudo sobre" o medicamento.
6. Minimize tool calls - use EXACTLY ONE tool for simple questions.`;

    const result = await chat([
      { role: "system", content: jsonSchema },
      { role: "user", content: prompt },
    ], { maxTokens: 500, temperature: 0.1 });

    const jsonText = result.text.trim();

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[Planner] No JSON found in response:", jsonText);
      return createFallbackPlan(question, mode, topics, implicitQuestions, false);
    }

    let plan;
    try {
      plan = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.warn("[Planner] JSON parse failed:", parseErr.message);
      return createFallbackPlan(question, mode, topics, implicitQuestions, false);
    }

    // Validate plan structure and enforce fallback if LLM returns empty tools
    if (!plan.drugs || !Array.isArray(plan.drugs)) {
      plan.drugs = [];
    }
    if (!plan.tools || !Array.isArray(plan.tools)) {
      plan.tools = [];
    }

    // Hotfix for Llama-3 hallucination: if it successfully parsed JSON but 
    // returned 0 tools for a user query (like {"response": "Não sei"}), 
    // it failed to use the tools. We must fallback to keyword search.
    if (plan.tools.length === 0) {
      console.warn("[Planner] LLM returned valid JSON but 0 tools. Forcing fallback extraction.");
      return createFallbackPlan(question, mode, topics, implicitQuestions, needsHistory);
    }

    // Ensure mode is set
    plan.mode = mode;

    // Add topic classification and implicit questions
    plan.topics = topics;
    plan.implicit_questions = implicitQuestions;
    
    // Use LLM's needs_history flag (override if provided)
    plan.needs_history = plan.needs_history || false;
    plan.classification_confidence = classification.confidence;
    plan.classification_method = classification.method;

    console.log("[Planner] Plan:", JSON.stringify(plan, null, 2));
    return plan;
  } catch (err) {
    console.error("[Planner] Error:", err.message);
    return createFallbackPlan(question, mode, topics, implicitQuestions, false);
  }
}

/**
 * Create fallback plan when LLM fails.
 * @param {string} question
 * @param {string} mode
 * @param {string[]} topics - Detected topics
 * @param {string[]} implicitQuestions - Implicit questions for detected topics
 * @returns {Object} Fallback plan
 */
function createFallbackPlan(question, mode, topics = [], implicitQuestions = []) {
  // Try local fallback extraction
  const drugs = localFallbackExtract(question);

  if (drugs.length > 0) {
    return {
      drugs,
      tools: [{
        name: "get_bula_data",
        args: { drug_name: drugs[0], mode },
      }],
      needs_clarification: null,
      mode,
      topics,
      implicit_questions: implicitQuestions,
      needs_history: false,
    };
  }

  return {
    drugs: [],
    tools: [],
    needs_clarification: "Não entendi sua pergunta. Você poderia reformular mencionando o nome do medicamento?",
    mode,
    topics,
    implicit_questions: implicitQuestions,
    needs_history: false,
  };
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  planQuery,
};
