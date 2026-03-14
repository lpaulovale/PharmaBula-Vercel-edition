/**
 * BulaIA Planner — Simplified Tag-Based Version
 *
 * Analyzes user questions and returns a JSON execution plan.
 * Uses a two-stage approach:
 *   1. LLM classifies question into a semantic tag (question_classifier.js)
 *   2. Deterministic router maps tag → section (section_router.js)
 *
 * The LLM NEVER chooses section names — it only picks a tag.
 * Section routing is 100% deterministic JavaScript.
 *
 * Flow:
 *   1. classifyQuestion() → { tag, drug, confidence }
 *   2. routeTag(tag) → { tool, section, fallback }
 *   3. Returns plan: { drug, tag, steps: [{ tool, section, fallback }] }
 */

const { localFallbackExtract } = require("./tools");
const { classifyQuestion } = require("./question_classifier");
const { routeTag } = require("./section_router");

// ============================================================
// Planner API
// ============================================================

/**
 * Analyze user question and return execution plan.
 * @param {string} question - User's question
 * @param {string} mode - "patient" or "professional"
 * @param {Array} history - Previous conversation messages (unused for now)
 * @returns {Promise<Object>} JSON plan
 */
async function planQuery(question, mode = "patient", history = []) {
  // Step 1: LLM classifies the question into a semantic tag
  const classification = await classifyQuestion(question);
  const { tag, drug: classifiedDrug, confidence } = classification;

  // Step 2: Deterministic routing — tag → section → tool
  const routing = routeTag(tag);
  const { tool, section, fallback } = routing;

  // Step 3: Extract drug name (from classifier or MongoDB fallback)
  let drugName = classifiedDrug;

  if (!drugName) {
    // Classifier didn't extract drug — try MongoDB extraction
    const drugs = await localFallbackExtract(question);
    drugName = drugs.length > 0 ? drugs[0] : null;
  }

  // Debug: log classification and routing
  console.log(`[Planner] Classification: tag=${tag}, drug=${drugName}, confidence=${confidence}`);
  console.log(`[Planner] Routing: tool=${tool}, section=${section}, fallback=${fallback}`);

  // Step 4: Build plan
  let plan;

  if (!drugName) {
    // No drug detected — ask for clarification
    plan = {
      drugs: [],
      tools: [],
      needs_clarification: "Não entendi sua pergunta. Você poderia reformular mencionando o nome do medicamento?",
      mode,
      tag: tag || null,
      implicit_questions: [],
      needs_history: false,
      classification_confidence: confidence,
      classification_method: classification.method,
    };
  } else {
    // Drug detected — create tool plan (exactly 1 step)
    const toolCall = tool === 'get_bula_data'
      ? { name: "get_bula_data", args: { drug_name: drugName, mode } }
      : { name: "get_section", args: { drug_name: drugName, section, mode } };

    plan = {
      drugs: [drugName],
      tools: [toolCall],
      fallback: fallback ? { name: "get_bula_data", args: { drug_name: drugName, mode } } : null,
      needs_clarification: null,
      mode,
      tag,
      section,
      implicit_questions: [],
      needs_history: false,
      classification_confidence: confidence,
      classification_method: classification.method,
    };
  }

  console.log("[Planner] Plan:", JSON.stringify(plan, null, 2));
  return plan;
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  planQuery,
};
