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

  // Step 2: Determine if history is needed (LLM-based decision)
  const needsHistory = await detectNeedsHistory(question, history, topics);

  const prompt = getSystemPrompt(mode, {
    date: new Date().toISOString().split("T")[0],
    question,
    documents: "(nenhum documento recuperado ainda)",
  });

  try {
    const jsonSchema = `You are an MCP query planner. Return ONLY valid JSON matching this schema:
{
  "drugs": ["extracted drug names"],
  "topics": ["identified topics"],
  "tools": [
    {
      "name": "get_bula_data",
      "args": { "drug_name": "name", "mode": "patient|professional" }
    }
  ]
}
Available tools: get_bula_data, get_section (args: drug_name, section, mode), check_interactions (args: drugs), find_generic_versions (args: query), search_medication (args: query).`;

    const result = await chat([
      { role: "system", content: jsonSchema },
      { role: "user", content: prompt },
    ], { maxTokens: 500, temperature: 0.1 });

    const jsonText = result.text.trim();

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[Planner] No JSON found in response:", jsonText);
      return createFallbackPlan(question, mode, topics, implicitQuestions, needsHistory);
    }

    let plan;
    try {
      plan = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.warn("[Planner] JSON parse failed:", parseErr.message);
      return createFallbackPlan(question, mode, topics, implicitQuestions, needsHistory);
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
    plan.needs_history = needsHistory;
    plan.classification_confidence = classification.confidence;
    plan.classification_method = classification.method;

    console.log("[Planner] Plan:", JSON.stringify(plan, null, 2));
    return plan;
  } catch (err) {
    console.error("[Planner] Error:", err.message);
    return createFallbackPlan(question, mode, topics, implicitQuestions, needsHistory);
  }
}

/**
 * Detect if conversation history is needed to answer the question precisely.
 * @param {string} question - User's question
 * @param {Array} history - Previous conversation messages
 * @param {string[]} topics - Detected topics
 * @returns {Promise<boolean>} True if history should be fetched
 */
async function detectNeedsHistory(question, history, topics) {
  // If no history exists, return false
  if (!history || history.length === 0) {
    return false;
  }

  // Check for pronouns or references that suggest context dependency
  const contextDependentPatterns = [
    /\bele\b|\bela\b|\bisso\b|\bdisso\b|\bdaquele\b|\bdaquela\b/i, // he/she/it/that
    /\bo mesmo\b|\ba mesma\b|\bos mesmos\b|\bas mesmas\b/i, // the same
    /\be quanto\b|\be sobre\b|\btambém|tambem/i, // and about / also
    /\bcontinua\b|\bcontinuar\b|\bsegue\b|\bseguir\b/i, // continue/follow
    /\bnaquele\b|\bnaquela\b|\bno anterior\b|\bna anterior\b/i, // in that one / in the previous
  ];

  // Check for topic-specific patterns that may need context
  const topicContextPatterns = {
    posologia: [/\bessa dose\b|\bessa quantidade\b/i], // this dose/quantity
    contraindicacoes: [/\bnesse caso\b|\bpra mim\b|\bpara mim\b/i], // in this case / for me
    reacoes_adversas: [/\besse sintoma\b|\bessa reação\b|\bessa reacao\b/i], // this symptom/reaction
    interacoes: [/\bcom aquele\b|\bcom o outro\b/i], // with that one / with the other
  };

  let hasContextReference = false;

  // Check question for context-dependent language
  for (const pattern of contextDependentPatterns) {
    if (pattern.test(question)) {
      hasContextReference = true;
      break;
    }
  }

  // Check topic-specific patterns
  for (const topic of topics) {
    const patterns = topicContextPatterns[topic];
    if (patterns) {
      for (const pattern of patterns) {
        if (pattern.test(question)) {
          hasContextReference = true;
          break;
        }
      }
    }
    if (hasContextReference) break;
  }

  // If question has context references, check if history might help
  if (hasContextReference && history.length > 0) {
    // Use LLM to decide if history is actually needed
    try {
      const historyPreview = history.slice(-2).map(m => `${m.role}: ${m.text.substring(0, 100)}`).join("\n");

      const result = await chat([
        { role: "system", content: "You are a context analyzer. Return ONLY valid JSON." },
        { role: "user", content: `Pergunta atual: "${question}"

Histórico recente:
${historyPreview}

A pergunta faz referência a algo do histórico anterior? O histórico ajudaria a responder com mais precisão?

Retorne APENAS JSON: {"needs_history": true|false, "reasoning": "breve explicação"}` },
      ], { maxTokens: 200, temperature: 0.1 });

      const jsonText = result.text.trim();
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        console.log(`[Planner] History analysis: needs_history=${analysis.needs_history}`);
        return analysis.needs_history || false;
      }
    } catch (err) {
      console.warn("[Planner] History analysis failed:", err.message);
    }
  }

  return false;
}

/**
 * Create fallback plan when LLM fails.
 * @param {string} question
 * @param {string} mode
 * @param {string[]} topics - Detected topics
 * @param {string[]} implicitQuestions - Implicit questions for detected topics
 * @param {boolean} needsHistory - Whether history is needed
 * @returns {Object} Fallback plan
 */
function createFallbackPlan(question, mode, topics = [], implicitQuestions = [], needsHistory = false) {
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
      needs_history: needsHistory,
    };
  }

  return {
    drugs: [],
    tools: [],
    needs_clarification: "Não entendi sua pergunta. Você poderia reformular mencionando o nome do medicamento?",
    mode,
    topics,
    implicit_questions: implicitQuestions,
    needs_history: needsHistory,
  };
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  planQuery,
};
