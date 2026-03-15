/**
 * BulaIA Evaluation API
 *
 * Runs the two-tier judge evaluation pipeline on a given response.
 * POST /api/evaluate with:
 *   { question, response, documents, mode, topics?, sessionId? }
 *
 * Returns aggregated scores from general judges + topic coverage scores.
 * Topic judges run conditionally based on detected topics.
 */

const { runAllJudges, runJudge, listJudges } = require("../lib/judges");
const { getEvaluationsCollection } = require("../lib/db");
const { classifyQuestion, getImplicitQuestions } = require("../lib/question_classifier");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // GET → list available judges
  if (req.method === "GET") {
    return res.status(200).json({
      judges: listJudges(),
      description: "POST with { question, response, documents, mode, topics? } to run evaluation",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ detail: "Método não permitido." });
  }

  const { question, response, documents, mode, judges, sessionId, topics: providedTopics } = req.body || {};

  if (!response) {
    return res.status(400).json({ detail: "Campo 'response' é obrigatório." });
  }

  // Classify question if topics not provided
  let topics = providedTopics || [];
  let classificationMethod = "provided";

  if (topics.length === 0 && question) {
    const classification = await classifyQuestion(question);
    topics = classification.topics || [];
    classificationMethod = classification.method || "llm";
    console.log(`[EVALUATE] Classified question into topics: ${topics.join(", ")} (method: ${classificationMethod})`);
  }

  const implicitQuestions = getImplicitQuestions(topics);

  const context = {
    question: question || "",
    response,
    documents: documents || "",
    mode: mode || "patient",
    topics,
    implicit_questions: implicitQuestions,
  };

  try {
    let results;

    if (judges && Array.isArray(judges) && judges.length > 0) {
      // Run specific judges only
      results = { judges: {}, judges_run: 0, timestamp: new Date().toISOString() };
      const scores = [];

      for (const judgeName of judges) {
        console.log(`[EVALUATE] Running judge: ${judgeName}`);
        const result = await runJudge(judgeName, context);
        results.judges[judgeName] = result;
        if (result.score !== undefined && !result.error) {
          scores.push(result.score);
        }
      }

      results.judges_run = scores.length;
      results.aggregate_score = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;
    } else {
      // Run all judges
      results = await runAllJudges(context);
      // Frontend expects "judges" key, not "general_judges"
      results.judges = results.general_judges || {};
      // Frontend expects "aggregate_score", not "general_score"
      results.aggregate_score = results.general_score;
    }

    // =========================================
    // Save evaluation results to MongoDB
    // =========================================
    try {
      const evaluations = await getEvaluationsCollection();
      if (evaluations) {
        await evaluations.insertOne({
          sessionId: sessionId || null,
          question: question || "",
          response,
          mode: mode || "patient",
          documents: documents ? documents.substring(0, 2000) : null, // Truncate to save space
          
          // Topic classification
          topics_detected: topics,
          classification_method: classificationMethod,
          implicit_questions: implicitQuestions,
          
          // General judges results
          general_judges: results.general_judges || results.judges,
          general_score: results.general_score || results.aggregate_score,
          
          // Topic judges results (observability)
          topic_judges: results.topic_judges || {},
          topic_coverage_score: results.topic_coverage_score || null,
          
          // Gate results
          topic_gates_passed: results.topic_gates_passed !== undefined ? results.topic_gates_passed : null,
          safety_gate_passed: results.safety_gate_passed !== undefined ? results.safety_gate_passed : null,
          rejected: results.rejected !== undefined ? results.rejected : false,
          
          // Metadata
          judges_run: results.judges_run || 0,
          timestamp: new Date(),
        });
        console.log("[EVALUATE] Results saved to MongoDB.");
        results.saved = true;
      } else {
        console.warn("[EVALUATE] MongoDB not available, results not saved.");
        results.saved = false;
      }
    } catch (dbErr) {
      console.warn("[EVALUATE] MongoDB save failed:", dbErr.message);
      results.saved = false;
    }

    // Debug: log response structure
    console.log("[EVALUATE] Returning:", JSON.stringify({
      hasJudges: !!results.judges,
      judgesKeys: results.judges ? Object.keys(results.judges) : [],
      hasGeneralJudges: !!results.general_judges,
      aggregateScore: results.aggregate_score,
      generalScore: results.general_score,
    }, null, 2));

    return res.status(200).json(results);
  } catch (err) {
    console.error("Evaluation error:", err);
    return res.status(500).json({ detail: "Erro na avaliação.", error: err.message });
  }
};
