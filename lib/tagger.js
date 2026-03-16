/**
 * BulaIA Sentence Tagger
 * 
 * Tags each sentence/phrase in bula text with semantic labels.
 * Only sentences with relevant tags are passed to final response generation.
 * 
 * Flow:
 *   1. Input: Raw bula text + user question tags
 *   2. LLM tags each sentence with relevant/irrelevant labels
 *   3. Filter to keep only relevant sentences
 *   4. Output: Filtered, organized text for response generation
 */

const { chat } = require("./llm_client");

const TAGGER_PROMPT = `You are a pharmaceutical text tagging assistant for Brazilian drug labels (bulas ANVISA).

Your task: Tag each sentence/phrase in the bula text and keep ONLY what's relevant to the user's question.

## INPUT
- **Bula text**: Raw text from one bula section
- **Question tags**: What the user is asking about (e.g., dosage_adult, common_side_effects)

## YOUR JOB
1. Read each sentence/phrase in the text
2. Tag it with the most specific tag possible
3. Mark it as **relevant** if it relates to the question tags
4. Mark it as **irrelevant** if it doesn't relate to the question tags
5. Return ONLY the relevant sentences, organized by tag

## TAGS BY TOPIC

### Dosage tags:
- `dosage_adult` - Adult dosage
- `dosage_pediatric` - General pediatric dosage
- `dosage_pediatric_weight_X_Ykg` - Specific weight range (e.g., dosage_pediatric_weight_5_8kg)
- `dosage_elderly` - Elderly dosage
- `dosage_renal` - Renal impairment dosage
- `dosage_hepatic` - Hepatic impairment dosage
- `dosage_diabetic` - Diabetic-specific info
- `administration` - How to administer
- `max_dose` - Maximum daily dose
- `age_restriction` - Age limits

### Side effects tags:
- `side_effects_hypersensitivity` - Allergic reactions
- `side_effects_hematologic` - Blood reactions
- `side_effects_dermatologic` - Skin reactions
- `side_effects_gastrointestinal` - GI reactions
- `side_effects_cardiovascular` - Heart/blood pressure
- `side_effects_hepatic` - Liver reactions
- `side_effects_renal` - Kidney reactions
- `side_effects_neurologic` - Nervous system
- `side_effects_other` - Other

### Warnings tags:
- `warning_pregnancy` - Pregnancy
- `warning_lactation` - Breastfeeding
- `warning_alcohol` - Alcohol
- `warning_driving` - Driving/machinery
- `warning_children` - Children
- `warning_elderly` - Elderly
- `warning_prolonged_use` - Long-term use
- `warning_diabetic` - Diabetics
- `warning_renal` - Renal patients
- `warning_hepatic` - Hepatic patients

### Contraindication tags:
- `contraindication_allergy` - Allergies
- `contraindication_disease` - Diseases
- `contraindication_age` - Age groups
- `contraindication_pregnancy` - Pregnancy

## OUTPUT FORMAT
Return ONLY valid JSON:
\`\`\`json
{
  "relevant_sentences": [
    {
      "tag": "dosage_adult",
      "text": "10 a 20 ml em administração única ou até o máximo de 20 ml, 4 vezes ao dia."
    },
    {
      "tag": "dosage_pediatric_weight_5_8kg",
      "text": "5 a 8 kg (3 a 11 meses) dose única: 1,25 a 2,5 ml dose máxima diária: 10 ml"
    }
  ]
}
\`\`\`

## RULES
1. Be SPECIFIC with tags - use weight ranges when mentioned
2. If sentence matches question tags → mark as relevant
3. If sentence doesn't match question tags → exclude from output
4. Keep original wording from bula
5. Return ONLY relevant sentences in JSON format
6. No explanation, no markdown except JSON

## EXAMPLE

Question tags: ["dosage_adult", "dosage_pediatric"]

Input text: "Adultos: 10 a 20 ml até 4 vezes ao dia. Crianças 5-8kg: 1,25-2,5ml. Crianças 9-15kg: 2,5-5ml. Este medicamento não deve ser usado por grávidas. Guarde em temperatura ambiente."

Output:
\`\`\`json
{
  "relevant_sentences": [
    {"tag": "dosage_adult", "text": "Adultos: 10 a 20 ml até 4 vezes ao dia"},
    {"tag": "dosage_pediatric_weight_5_8kg", "text": "Crianças 5-8kg: 1,25-2,5ml"},
    {"tag": "dosage_pediatric_weight_9_15kg", "text": "Crianças 9-15kg: 2,5-5ml"}
  ]
}
\`\`\`

Return ONLY the JSON object. No markdown. No explanation.`;

/**
 * Tag sentences and filter to keep only what's relevant to user's question.
 * @param {string} text - Raw bula section text
 * @param {string} section - Section name (posologia, reacoes, advertencias, contraindicacao)
 * @param {string[]} questionTags - Tags from user's question (e.g., ["dosage_adult", "common_side_effects"])
 * @returns {Promise<Array>} Array of { tag, text } - only relevant sentences
 */
async function tagAndFilter(text, section = "unknown", questionTags = []) {
  const startTime = Date.now();
  
  if (!text || text.length < 50) {
    return [{
      tag: `${section}_general`,
      text: text
    }];
  }

  // Map question tags to expected sentence tags
  const expectedTags = mapQuestionTagsToSentenceTags(questionTags, section);

  try {
    const result = await chat([
      { role: "system", content: TAGGER_PROMPT },
      { 
        role: "user", 
        content: `Section: ${section}\nQuestion tags: ${JSON.stringify(expectedTags)}\n\nText to tag:\n${text.substring(0, 4000)}` 
      }
    ], { maxTokens: 1500, temperature: 0.1 });

    const elapsed = Date.now() - startTime;
    const jsonText = result.text.trim();
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.warn(`[Tagger] ${section} (${elapsed}ms): No JSON returned`);
      return [{ tag: `${section}_general`, text }];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const sentences = parsed.relevant_sentences || [];

    if (sentences.length === 0) {
      console.warn(`[Tagger] ${section} (${elapsed}ms): No relevant sentences found`);
      return [{ tag: `${section}_general`, text }];
    }

    console.log(`[Tagger] ${section} (${elapsed}ms): ${sentences.length} relevant sentences`);
    return sentences;

  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error(`[Tagger] ${section} (${elapsed}ms):`, err.message);
    return [{ tag: `${section}_general`, text }];
  }
}

/**
 * Map question tags to expected sentence tags.
 * @param {string[]} questionTags - Tags from classifier
 * @param {string} section - Section name
 * @returns {string[]} Expected sentence tags
 */
function mapQuestionTagsToSentenceTags(questionTags, section) {
  const mapping = {
    // Dosage questions
    'dosage_adult': ['dosage_adult'],
    'dosage_pediatric': ['dosage_pediatric', 'dosage_pediatric_weight_\\d+_\\d+kg'],
    'dosage_by_weight': ['dosage_pediatric_weight_\\d+_\\d+kg'],
    'dosage_elderly': ['dosage_elderly'],
    'dosage_renal': ['dosage_renal', 'dosage_hepatic'],
    'dosage_hepatic': ['dosage_hepatic', 'dosage_renal'],
    'administration_route': ['administration'],
    'max_daily_dose': ['max_dose'],
    'contraindication_age': ['age_restriction'],
    
    // Side effects questions
    'common_side_effects': ['side_effects_.*'],
    'adverse_reaction': ['side_effects_.*'],
    'side_effect_frequency': ['side_effects_.*'],
    
    // Contraindication questions
    'who_cannot_use': ['contraindication_.*'],
    'contraindication_pregnancy': ['contraindication_pregnancy'],
    'contraindication_lactation': ['contraindication_lactation'],
    'contraindication_disease': ['contraindication_disease'],
    'contraindication_allergy': ['contraindication_allergy'],
    
    // Warning questions
    'advertencias': ['warning_.*'],
    'alcohol_interaction': ['warning_alcohol'],
    'driving_warning': ['warning_driving'],
    'pregnancy_category': ['warning_pregnancy'],
    'special_population': ['warning_children', 'warning_elderly', 'warning_pregnancy', 'warning_lactation'],
    'long_term_use': ['warning_prolonged_use'],
  };

  const expectedTags = [];
  
  for (const qTag of questionTags) {
    if (mapping[qTag]) {
      expectedTags.push(...mapping[qTag]);
    }
  }

  // If section is known, add section-specific fallback
  if (section === 'posologia' && !expectedTags.some(t => t.includes('dosage'))) {
    expectedTags.push('dosage_.*');
  }
  if (section === 'reacoes' && !expectedTags.some(t => t.includes('side_effects'))) {
    expectedTags.push('side_effects_.*');
  }
  if (section === 'advertencias' && !expectedTags.some(t => t.includes('warning'))) {
    expectedTags.push('warning_.*');
  }
  if (section === 'contraindicacao' && !expectedTags.some(t => t.includes('contraindication'))) {
    expectedTags.push('contraindication_.*');
  }

  return expectedTags;
}

/**
 * Group tagged sentences by tag for organized response generation.
 * @param {Array} sentences - Array of { tag, text }
 * @returns {Object} Sentences grouped by tag
 */
function groupByTag(sentences) {
  const grouped = {};
  
  for (const sentence of sentences) {
    const tag = sentence.tag;
    if (!grouped[tag]) {
      grouped[tag] = [];
    }
    grouped[tag].push(sentence.text);
  }
  
  return grouped;
}

module.exports = {
  tagAndFilter,
  groupByTag,
  mapQuestionTagsToSentenceTags,
};
