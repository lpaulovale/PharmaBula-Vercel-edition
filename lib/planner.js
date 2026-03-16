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
  // Step 1: LLM classifies the question into semantic tag(s)
  const classification = await classifyQuestion(question);
  const { tags, drug: classifiedDrug, confidence } = classification;

  // Step 2: Deterministic routing — tags → sections → tools
  // Handle multiple tags by creating multiple tool calls
  const toolCalls = [];
  const sections = [];
  
  for (const tag of tags) {
    const routing = routeTag(tag);
    const { tool, section, fallback } = routing;
    
    console.log(`[Planner] Routing tag "${tag}": tool=${tool}, section=${section}, fallback=${fallback}`);
    
    if (tool === 'get_bula_data') {
      toolCalls.push({ name: "get_bula_data", args: { drug_name: classifiedDrug, mode } });
    } else if (section) {
      toolCalls.push({ name: "get_section", args: { drug_name: classifiedDrug, section, mode } });
      sections.push({ section, fallback });
    }
  }

  // Step 3: Extract drug name (from classifier or MongoDB fallback)
  let drugName = classifiedDrug;

  if (!drugName) {
    // Classifier didn't extract drug — try MongoDB extraction
    const drugs = await localFallbackExtract(question);
    drugName = drugs.length > 0 ? drugs[0] : null;
  }

  // Debug: log classification and routing
  console.log(`[Planner] Classification: tags=[${tags.join(', ')}], drug=${drugName}, confidence=${confidence}`);

  // Step 4: Build plan
  let plan;

  if (!drugName || tags.length === 0) {
    // No drug detected or no tags — ask for clarification
    plan = {
      drugs: drugName ? [drugName] : [],
      tools: [],
      needs_clarification: !drugName 
        ? "Não entendi sua pergunta. Você poderia reformular mencionando o nome do medicamento?"
        : "Não entendi sua pergunta. Você poderia reformular?",
      mode,
      tags: tags.length > 0 ? tags : null,
      implicit_questions: [],
      needs_history: false,
      classification_confidence: confidence,
      classification_method: classification.method,
    };
  } else {
    // Drug detected — create tool plan (may have multiple steps)
    // Deduplicate tool calls by section
    const uniqueToolCalls = [];
    const seenSections = new Set();
    const fallbacks = [];
    
    for (const tc of toolCalls) {
      const key = tc.name === 'get_section' ? `section:${tc.args.section}` : 'bula_completa';
      if (!seenSections.has(key)) {
        seenSections.add(key);
        uniqueToolCalls.push(tc);
        // Track fallback for get_section tools
        const sectionInfo = sections.find(s => s.section === tc.args?.section);
        if (sectionInfo?.fallback) {
          fallbacks.push({ section: tc.args.section, fallback: sectionInfo.fallback });
        }
      }
    }

    plan = {
      drugs: [drugName],
      tools: uniqueToolCalls,
      fallbacks, // Per-section fallbacks
      needs_clarification: null,
      mode,
      tags,
      sections: sections.map(s => s.section),
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
