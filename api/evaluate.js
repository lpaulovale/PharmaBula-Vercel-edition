/**
 * PharmaBula Evaluation API
 * 
 * Runs the 4-judge evaluation pipeline on a given response.
 * POST /api/evaluate with:
 *   { question, response, documents, mode, judges?, sessionId? }
 * 
 * Returns aggregated scores from all judges and saves to MongoDB.
 */

const { runAllJudges, runJudge, listJudges } = require("../lib/judges");
const { getEvaluationsCollection } = require("../lib/db");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // GET → list available judges
  if (req.method === "GET") {
    return res.status(200).json({
      judges: listJudges(),
      description: "POST with { question, response, documents, mode } to run evaluation",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ detail: "Método não permitido." });
  }

  const { question, response, documents, mode, judges, sessionId } = req.body || {};

  if (!response) {
    return res.status(400).json({ detail: "Campo 'response' é obrigatório." });
  }

  const apiKey = process.env.HF_TOKEN;
  if (!apiKey) {
    return res.status(500).json({ detail: "HF_TOKEN não configurado." });
  }

  const context = {
    question: question || "",
    response,
    documents: documents || "",
    mode: mode || "patient",
  };

  try {
    let results;

    if (judges && Array.isArray(judges) && judges.length > 0) {
      // Run specific judges only
      results = { judges: {}, judges_run: 0, timestamp: new Date().toISOString() };
      const scores = [];

      for (const judgeName of judges) {
        console.log(`[EVALUATE] Running judge: ${judgeName}`);
        const result = await runJudge(judgeName, context, apiKey);
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
      results = await runAllJudges(context, apiKey);
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
          results: results.judges,
          aggregate_score: results.aggregate_score,
          judges_run: results.judges_run,
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

    return res.status(200).json(results);
  } catch (err) {
    console.error("Evaluation error:", err);
    return res.status(500).json({ detail: "Erro na avaliação.", error: err.message });
  }
};
