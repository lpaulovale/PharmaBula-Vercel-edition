/**
 * BulaIA Planner - Deterministic Version
 *
 * Analyzes user questions and returns a JSON execution plan.
 * Uses keyword-based topic detection and deterministic section mapping.
 * NO LLM is used for planning to avoid hallucination.
 *
 * Flow:
 *   1. Keyword classification → detects topics
 *   2. Topic → Section mapping (deterministic)
 *   3. Drug extraction → from question
 *   4. Returns plan: { drugs, tools, topics, implicit_questions }
 */

const { localFallbackExtract } = require("./tools");
const { classifyQuestion, getImplicitQuestions } = require("./question_classifier");

// ============================================================
// Topic to Section Mapping (deterministic)
// ============================================================
const TOPIC_TO_SECTION = {
  reacoes_adversas: "reacoes",
  posologia: "posologia",
  contraindicacoes: "contraindicacao",
  indicacoes: "indicacao",
  advertencias: "advertencias",
  interacoes: "interacoes",
  superdosagem: "superdosagem",
  armazenamento: "armazenamento",
  populacoes_especiais: "advertencias",
  tempo_acao: "indicacao",
  dependencia: "advertencias",
};

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
  // Step 1: Classify question into topics (uses keyword + LLM fallback)
  const classification = await classifyQuestion(question);
  const topics = classification.topics.length > 0 ? classification.topics : [];
  const implicitQuestions = getImplicitQuestions(topics);

  // Step 2: Map primary topic to section (deterministic lookup)
  const primaryTopic = topics[0];
  const section = primaryTopic ? TOPIC_TO_SECTION[primaryTopic] : null;

  // Step 3: Extract drug name from question
  const drugs = localFallbackExtract(question);

  // Step 4: Build plan
  let plan;
  if (drugs.length === 0) {
    // No drug detected - ask for clarification
    plan = {
      drugs: [],
      tools: [],
      needs_clarification: "Não entendi sua pergunta. Você poderia reformular mencionando o nome do medicamento?",
      mode,
      topics,
      implicit_questions: implicitQuestions,
      needs_history: false,
      classification_confidence: classification.confidence,
      classification_method: classification.method,
    };
  } else {
    // Drug detected - create tool plan
    const drugName = drugs[0];

    // Use get_section if we have a topic, otherwise get_bula_data for general info
    const tools = section
      ? [{
          name: "get_section",
          args: { drug_name: drugName, section, mode },
        }]
      : [{
          name: "get_bula_data",
          args: { drug_name: drugName, mode },
        }];

    plan = {
      drugs,
      tools,
      needs_clarification: null,
      mode,
      topics,
      implicit_questions: implicitQuestions,
      needs_history: false,
      classification_confidence: classification.confidence,
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
