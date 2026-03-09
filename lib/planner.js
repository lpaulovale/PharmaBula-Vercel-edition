/**
 * PharmaBula Planner
 *
 * Analyzes user questions and returns a JSON execution plan.
 * The LLM decides which tools to call and with what parameters.
 *
 * Flow:
 *   1. User question + conversation history → LLM
 *   2. LLM returns JSON plan: { drugs, tools, needs_clarification }
 *   3. Server executes tools from plan (can be parallel!)
 *   4. Tool results → LLM generates final response
 */

const { chat } = require("./llm_client");
const { localFallbackExtract } = require("./tools");
const { getSystemPrompt } = require("./prompt_manager");

// ============================================================
// Planner API
// ============================================================

/**
 * Analyze user question and return execution plan.
 * @param {string} question - User's question
 * @param {string} mode - "patient" or "professional"
 * @param {Array} history - Previous conversation messages
 * @returns {Promise<Object>} JSON plan: { drugs, tools, needs_clarification, mode }
 */
async function planQuery(question, mode = "patient", history = []) {
  const prompt = getSystemPrompt(mode, {
    date: new Date().toISOString().split("T")[0],
    question,
    documents: "(nenhum documento recuperado ainda)",
  });

  try {
    const result = await chat([
      { role: "system", content: "You are a query analyzer. Return ONLY valid JSON." },
      { role: "user", content: prompt },
    ], { maxTokens: 500, temperature: 0.1 });

    const jsonText = result.text.trim();

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[Planner] No JSON found in response:", jsonText);
      return createFallbackPlan(question, mode);
    }

    let plan;
    try {
      plan = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.warn("[Planner] JSON parse failed:", parseErr.message);
      return createFallbackPlan(question, mode);
    }

    // Validate plan structure
    if (!plan.drugs || !Array.isArray(plan.drugs)) {
      plan.drugs = [];
    }
    if (!plan.tools || !Array.isArray(plan.tools)) {
      plan.tools = [];
    }

    // Ensure mode is set
    plan.mode = mode;

    console.log("[Planner] Plan:", JSON.stringify(plan, null, 2));
    return plan;
  } catch (err) {
    console.error("[Planner] Error:", err.message);
    return createFallbackPlan(question, mode);
  }
}

/**
 * Create fallback plan when LLM fails.
 * @param {string} question
 * @param {string} mode
 * @returns {Object} Fallback plan
 */
function createFallbackPlan(question, mode) {
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
    };
  }

  return {
    drugs: [],
    tools: [],
    needs_clarification: "Não entendi sua pergunta. Você poderia reformular mencionando o nome do medicamento?",
    mode,
  };
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  planQuery,
};
