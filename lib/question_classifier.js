/**
 * BulaIA Question Classifier (Tag-Based)
 *
 * Classifies user questions into semantic tags using LLM.
 * The LLM only picks a tag from a fixed list — it does NOT choose sections.
 * Section routing is handled deterministically by lib/section_router.js
 *
 * Tags (60 total):
 *   Identification:     drug_identity, drug_form, drug_concentration, generic_vs_reference, registration
 *   Composition:        active_ingredient, excipients, chemical_formula, allergen_components, drug_composition
 *   Indication:         therapeutic_indication, disease_treatment, symptom_relief, approved_use
 *   Dosage:             dosage_adult, dosage_pediatric, dosage_elderly, dosage_by_weight, dosage_renal,
 *                       dosage_hepatic, administration_route, administration_timing, treatment_duration,
 *                       medication_intake, missed_dose, max_daily_dose
 *   Contraindication:   contraindication_pregnancy, contraindication_lactation, contraindication_disease,
 *                       contraindication_allergy, contraindication_age, who_cannot_use
 *   Warnings:           driving_warning, alcohol_interaction, special_population, pregnancy_category,
 *                       doping_alert, precaution_disease, long_term_use, dependency_risk,
 *                       pediatric_warning, elderly_warning
 *   Interactions:       drug_drug_interaction, drug_food_interaction, drug_lab_interaction,
 *                       potentiating_effect, inhibiting_effect, dangerous_combination
 *   Adverse Reactions:  adverse_reaction, side_effect_frequency, serious_adverse_event,
 *                       organ_toxicity, allergic_reaction, common_side_effects
 *   Overdose:           overdose, overdose_symptoms, overdose_treatment, accidental_ingestion, toxic_dose
 *   Pharmacodynamics:   mechanism_of_action, pharmacodynamics, drug_class, receptor_target, therapeutic_effect
 *   Pharmacokinetics:   onset_of_action, drug_absorption, drug_distribution, drug_metabolism,
 *                       drug_elimination, half_life, bioavailability
 *   Storage:            storage_conditions, temperature_storage, light_sensitivity, shelf_life, after_opening
 */

const { chat } = require("./llm_client");

// ============================================================
// LLM System Prompt for Classification
// ============================================================
const CLASSIFICATION_PROMPT = `You are a pharmaceutical question classifier for Brazilian drug labels (bulas ANVISA).

Your job:
1. Extract the drug name from the question (if mentioned)
2. Classify the question into exactly ONE tag from the list below
3. Return ONLY valid JSON: { "tag": "<tag>", "drug": "<drug_name_or_null>", "confidence": <0.0-1.0> }

TAGS (pick exactly ONE):
  Identification:     drug_identity, drug_form, drug_concentration, generic_vs_reference, registration
  Composition:        active_ingredient, excipients, chemical_formula, allergen_components, drug_composition
  Indication:         therapeutic_indication, disease_treatment, symptom_relief, approved_use
  Dosage:             dosage_adult, dosage_pediatric, dosage_elderly, dosage_by_weight, dosage_renal,
                      dosage_hepatic, administration_route, administration_timing, treatment_duration,
                      medication_intake, missed_dose, max_daily_dose
  Contraindication:   contraindication_pregnancy, contraindication_lactation, contraindication_disease,
                      contraindication_allergy, contraindication_age, who_cannot_use
  Warnings:           driving_warning, alcohol_interaction, special_population, pregnancy_category,
                      doping_alert, precaution_disease, long_term_use, dependency_risk,
                      pediatric_warning, elderly_warning
  Interactions:       drug_drug_interaction, drug_food_interaction, drug_lab_interaction,
                      potentiating_effect, inhibiting_effect, dangerous_combination
  Adverse Reactions:  adverse_reaction, side_effect_frequency, serious_adverse_event,
                      organ_toxicity, allergic_reaction, common_side_effects
  Overdose:           overdose, overdose_symptoms, overdose_treatment, accidental_ingestion, toxic_dose
  Pharmacodynamics:   mechanism_of_action, pharmacodynamics, drug_class, receptor_target, therapeutic_effect
  Pharmacokinetics:   onset_of_action, drug_absorption, drug_distribution, drug_metabolism,
                      drug_elimination, half_life, bioavailability
  Storage:            storage_conditions, temperature_storage, light_sensitivity, shelf_life, after_opening

Examples:
  "Qual o princípio ativo do Paracetamol?" → { "tag": "active_ingredient", "drug": "Paracetamol", "confidence": 0.97 }
  "Posso dar para meu filho de 10kg?" → { "tag": "dosage_by_weight", "drug": null, "confidence": 0.91 }
  "Grávida pode tomar?" → { "tag": "contraindication_pregnancy", "drug": null, "confidence": 0.95 }
  "Pode tomar com álcool?" → { "tag": "alcohol_interaction", "drug": null, "confidence": 0.93 }
  "Como o ibuprofeno age no corpo?" → { "tag": "mechanism_of_action", "drug": "Ibuprofeno", "confidence": 0.88 }
  "Qual a dose para adulto?" → { "tag": "dosage_adult", "drug": null, "confidence": 0.92 }
  "Efeitos colaterais comuns?" → { "tag": "common_side_effects", "drug": null, "confidence": 0.94 }
  "Como guardar este medicamento?" → { "tag": "storage_conditions", "drug": null, "confidence": 0.96 }

Return ONLY the JSON object. No explanation. No markdown. No code blocks.`;

/**
 * Classify using LLM.
 * @param {string} question - User's question
 * @returns {Promise<{ tag: string|null, drug: string|null, confidence: number, method: string }>}
 */
async function classifyWithLLM(question) {
  try {
    const result = await chat([
      { role: "system", content: CLASSIFICATION_PROMPT },
      { role: "user", content: question },
    ], { maxTokens: 150, temperature: 0.1 });

    const jsonText = result.text.trim();
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.warn("[Classifier] LLM returned no JSON:", jsonText);
      return { tag: null, drug: null, confidence: 0, method: 'llm' };
    }

    const classification = JSON.parse(jsonMatch[0]);

    return {
      tag: classification.tag || null,
      drug: classification.drug || null,
      confidence: classification.confidence || 0.5,
      method: 'llm',
    };
  } catch (err) {
    console.error("[Classifier] LLM classification failed:", err.message);
    return { tag: null, drug: null, confidence: 0, method: 'llm' };
  }
}

/**
 * Classify a question into a semantic tag.
 * @param {string} question - User's question
 * @returns {Promise<{ tag: string|null, drug: string|null, confidence: number, method: string }>}
 */
async function classifyQuestion(question) {
  const llmResult = await classifyWithLLM(question);
  console.log(`[Classifier] LLM classification: ${llmResult.tag} (confidence: ${llmResult.confidence})`);
  return llmResult;
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  classifyQuestion,
  classifyWithLLM,
};
