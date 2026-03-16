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
- Bula text: Raw text from one bula section
- Question tags: What the user is asking about (e.g., dosage_adult, common_side_effects)

## YOUR JOB
1. Read each sentence/phrase in the text
2. Tag it with the most specific tag possible
3. Mark it as relevant if it relates to the question tags
4. Mark it as irrelevant if it doesn't relate to the question tags
5. Return ONLY the relevant sentences, organized by tag

## TAGS BY TOPIC

### Dosage tags:
- dosage_adult - Adult dosage
- dosage_pediatric - General pediatric dosage
- dosage_pediatric_weight_X_Ykg - Specific weight range (e.g., dosage_pediatric_weight_5_8kg)
- dosage_elderly - Elderly dosage
- dosage_renal - Renal impairment dosage
- dosage_hepatic - Hepatic impairment dosage
- dosage_diabetic - Diabetic-specific info
- administration - How to administer
- max_dose - Maximum daily dose
- age_restriction - Age limits

### Side effects tags:
- side_effects_hypersensitivity - Allergic reactions
- side_effects_hematologic - Blood reactions
- side_effects_dermatologic - Skin reactions
- side_effects_gastrointestinal - GI reactions
- side_effects_cardiovascular - Heart/blood pressure
- side_effects_hepatic - Liver reactions
- side_effects_renal - Kidney reactions
- side_effects_neurologic - Nervous system
- side_effects_other - Other

### Warnings tags:
- warning_pregnancy - Pregnancy
- warning_lactation - Breastfeeding
- warning_alcohol - Alcohol
- warning_driving - Driving/machinery
- warning_children - Children
- warning_elderly - Elderly
- warning_prolonged_use - Long-term use
- warning_diabetic - Diabetics
- warning_renal - Renal patients
- warning_hepatic - Hepatic patients

### Contraindication tags:
- contraindication_allergy - Allergies
- contraindication_disease - Diseases
- contraindication_age - Age groups
- contraindication_pregnancy - Pregnancy

## OUTPUT FORMAT
Return ONLY valid JSON:
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
{
  "relevant_sentences": [
    {"tag": "dosage_adult", "text": "Adultos: 10 a 20 ml até 4 vezes ao dia"},
    {"tag": "dosage_pediatric_weight_5_8kg", "text": "Crianças 5-8kg: 1,25-2,5ml"},
    {"tag": "dosage_pediatric_weight_9_15kg", "text": "Crianças 9-15kg: 2,5-5ml"}
  ]
}

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

    // GROUP similar tags to reduce fragmentation
    const grouped = groupSimilarTags(sentences, section);
    
    console.log(`[Tagger] ${section} (${elapsed}ms): ${grouped.length} groups (from ${sentences.length} sentences)`);
    return grouped;

  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error(`[Tagger] ${section} (${elapsed}ms):`, err.message);
    return [{ tag: `${section}_general`, text }];
  }
}

/**
 * Group similar tags to reduce fragmentation.
 * @param {Array} sentences - Array of { tag, text }
 * @param {string} section - Section name
 * @returns {Array} Grouped sentences
 */
function groupSimilarTags(sentences, section) {
  // For posologia: group all dosage entries under broader categories
  if (section === 'posologia') {
    const groups = {
      'dosage_adult': { tag: 'dosage_adult', title: 'Posologia para Adultos', texts: [] },
      'dosage_pediatric': { tag: 'dosage_pediatric', title: 'Posologia para Crianças', texts: [] },
      'dosage_special': { tag: 'dosage_special', title: 'Casos Especiais', texts: [] },
      'administration': { tag: 'administration', title: 'Como Administrar', texts: [] },
    };
    
    for (const s of sentences) {
      if (s.tag.includes('weight') || s.tag.includes('pediatric')) {
        groups['dosage_pediatric'].texts.push(s.text);
      } else if (s.tag.includes('diabetic') || s.tag.includes('renal') || s.tag.includes('hepatic')) {
        groups['dosage_special'].texts.push(s.text);
      } else if (s.tag.includes('administration') || s.tag.includes('route')) {
        groups['administration'].texts.push(s.text);
      } else {
        groups['dosage_adult'].texts.push(s.text);
      }
    }
    
    // Return only non-empty groups, combining texts
    return Object.values(groups)
      .filter(g => g.texts.length > 0)
      .map(g => ({
        tag: g.tag,
        text: g.texts.join('\n')
      }));
  }
  
  // For reacoes: group by category AND split long texts into bullet points
  if (section === 'reacoes') {
    const groups = {
      'side_effects_hypersensitivity': { tag: 'side_effects_hypersensitivity', title: 'Reações de Hipersensibilidade', texts: [] },
      'side_effects_dermatologic': { tag: 'side_effects_dermatologic', title: 'Reações da Pele', texts: [] },
      'side_effects_hematologic': { tag: 'side_effects_hematologic', title: 'Reações Hematológicas', texts: [] },
      'side_effects_cardiovascular': { tag: 'side_effects_cardiovascular', title: 'Reações Cardiovasculares', texts: [] },
      'side_effects_other': { tag: 'side_effects_other', title: 'Outras Reações', texts: [] },
    };
    
    for (const s of sentences) {
      const text = s.text.toLowerCase();
      let category = 'side_effects_other';
      
      if (text.includes('anafil') || text.includes('alérg') || text.includes('hipersens')) {
        category = 'side_effects_hypersensitivity';
      } else if (text.includes('pele') || text.includes('mucosa') || text.includes('urtic') || text.includes('erupç') || text.includes('stevens') || text.includes('lyell')) {
        category = 'side_effects_dermatologic';
      } else if (text.includes('sang') || text.includes('hemat') || text.includes('leuco') || text.includes('agranulo') || text.includes('trombo') || text.includes('plaquet')) {
        category = 'side_effects_hematologic';
      } else if (text.includes('pressão') || text.includes('cardíac') || text.includes('bronco')) {
        category = 'side_effects_cardiovascular';
      }
      
      // SPLIT long texts into smaller bullet points
      const splitTexts = splitIntoBulletPoints(s.text, category);
      groups[category].texts.push(...splitTexts);
    }
    
    return Object.values(groups)
      .filter(g => g.texts.length > 0)
      .map(g => ({
        tag: g.tag,
        text: g.texts.join('\n')
      }));
  }
  
  // Default: return original sentences
  return sentences;
}

/**
 * Split long text into smaller bullet points.
 * @param {string} text - Long text to split
 * @param {string} category - Category for context
 * @returns {string[]} Array of shorter bullet points
 */
function splitIntoBulletPoints(text, category) {
  // If text is short enough, return as-is
  if (text.length < 200) {
    return [text];
  }
  
  // Split by sentence endings (. ! ? followed by space or end)
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  
  const result = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    
    // If adding this sentence keeps chunk under limit, add it
    if ((currentChunk + ' ' + trimmed).length < 250) {
      currentChunk = (currentChunk + ' ' + trimmed).trim();
    } else {
      // Otherwise, save current chunk and start new one
      if (currentChunk) {
        result.push(currentChunk);
      }
      currentChunk = trimmed;
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk) {
    result.push(currentChunk);
  }
  
  // If we couldn't split (no sentence boundaries), force split by length
  if (result.length === 1 && result[0].length > 300) {
    const forcedSplit = [];
    let remaining = result[0];
    while (remaining.length > 250) {
      // Find a good break point (comma, semicolon, or space)
      let breakPoint = remaining.lastIndexOf(',', 250);
      if (breakPoint === -1) breakPoint = remaining.lastIndexOf(';', 250);
      if (breakPoint === -1) breakPoint = remaining.lastIndexOf(' ', 250);
      if (breakPoint === -1) breakPoint = 250;
      
      forcedSplit.push(remaining.substring(0, breakPoint + 1).trim());
      remaining = remaining.substring(breakPoint + 1).trim();
    }
    if (remaining) {
      forcedSplit.push(remaining);
    }
    return forcedSplit;
  }
  
  return result;
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
