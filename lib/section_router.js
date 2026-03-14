/**
 * BulaIA Section Router
 *
 * Deterministic routing from semantic tags to MongoDB section names.
 * NO LLM is used here - this is pure JavaScript lookup.
 *
 * The LLM classifies the question into a tag (question_classifier.js),
 * and this router maps that tag to the appropriate section/tool.
 */

// ============================================================
// Tag to Section Mapping (deterministic)
// ============================================================
const TAG_TO_SECTION = {
  // identification
  drug_identity:           'identificacao',
  drug_form:               'identificacao',
  drug_concentration:      'identificacao',
  generic_vs_reference:    'identificacao',
  registration:            'identificacao',

  // composition — section may not exist in all bulas; fallback to get_bula_data
  active_ingredient:       'composicao',
  excipients:              'composicao',
  chemical_formula:        'composicao',
  allergen_components:     'composicao',
  drug_composition:        'composicao',

  // indication
  therapeutic_indication:  'indicacao',
  disease_treatment:       'indicacao',
  symptom_relief:          'indicacao',
  approved_use:            'indicacao',

  // dosage
  dosage_adult:            'posologia',
  dosage_pediatric:        'posologia',
  dosage_elderly:          'posologia',
  dosage_by_weight:        'posologia',
  dosage_renal:            'posologia',
  dosage_hepatic:          'posologia',
  administration_route:    'posologia',
  administration_timing:   'posologia',
  treatment_duration:      'posologia',
  medication_intake:       'posologia',
  missed_dose:             'posologia',
  max_daily_dose:          'posologia',

  // contraindication
  contraindication_pregnancy: 'contraindicacao',
  contraindication_lactation: 'contraindicacao',
  contraindication_disease:   'contraindicacao',
  contraindication_allergy:   'contraindicacao',
  contraindication_age:       'contraindicacao',
  who_cannot_use:             'contraindicacao',

  // warnings
  driving_warning:         'advertencias',
  alcohol_interaction:     'advertencias',
  special_population:      'advertencias',
  pregnancy_category:      'advertencias',
  doping_alert:            'advertencias',
  precaution_disease:      'advertencias',
  long_term_use:           'advertencias',
  dependency_risk:         'advertencias',
  pediatric_warning:       'advertencias',
  elderly_warning:         'advertencias',

  // interactions
  drug_drug_interaction:   'interacoes',
  drug_food_interaction:   'interacoes',
  drug_lab_interaction:    'interacoes',
  potentiating_effect:     'interacoes',
  inhibiting_effect:       'interacoes',
  dangerous_combination:   'interacoes',

  // adverse reactions
  adverse_reaction:        'reacoes',
  side_effect_frequency:   'reacoes',
  serious_adverse_event:   'reacoes',
  organ_toxicity:          'reacoes',
  allergic_reaction:       'reacoes',
  common_side_effects:     'reacoes',

  // overdose
  overdose:                'superdosagem',
  overdose_symptoms:       'superdosagem',
  overdose_treatment:      'superdosagem',
  accidental_ingestion:    'superdosagem',
  toxic_dose:              'superdosagem',

  // pharmacodynamics
  mechanism_of_action:     'farmacodinamica',
  pharmacodynamics:        'farmacodinamica',
  drug_class:              'farmacodinamica',
  receptor_target:         'farmacodinamica',
  therapeutic_effect:      'farmacodinamica',

  // pharmacokinetics
  onset_of_action:         'farmacocinetica',
  drug_absorption:         'farmacocinetica',
  drug_distribution:       'farmacocinetica',
  drug_metabolism:         'farmacocinetica',
  drug_elimination:        'farmacocinetica',
  half_life:               'farmacocinetica',
  bioavailability:         'farmacocinetica',

  // storage
  storage_conditions:      'armazenamento',
  temperature_storage:     'armazenamento',
  light_sensitivity:       'armazenamento',
  shelf_life:              'armazenamento',
  after_opening:           'armazenamento',
};

// Sections that may not exist in all bulas — fall back to full bula fetch
const FULL_BULA_FALLBACK_SECTIONS = new Set([
  'composicao',
  'farmacodinamica',
  'farmacocinetica',
  'identificacao',
]);

/**
 * Route a semantic tag to the appropriate tool and section.
 * @param {string} tag - The semantic tag from the classifier
 * @returns {{ tool: string, section: string|null, fallback: string|null }}
 */
function routeTag(tag) {
  const section = TAG_TO_SECTION[tag];

  if (!section) {
    // Unknown tag — fetch full bula as safe fallback
    console.log(`[SectionRouter] Unknown tag "${tag}", falling back to get_bula_data`);
    return { tool: 'get_bula_data', section: null, fallback: null };
  }

  if (FULL_BULA_FALLBACK_SECTIONS.has(section)) {
    // These sections may not exist in MongoDB for all bulas
    // Try get_section first; if found: false, caller should retry with get_bula_data
    console.log(`[SectionRouter] Tag "${tag}" → section "${section}" (with fallback)`);
    return { tool: 'get_section', section, fallback: 'get_bula_data' };
  }

  console.log(`[SectionRouter] Tag "${tag}" → section "${section}"`);
  return { tool: 'get_section', section, fallback: null };
}

/**
 * Get all available tags.
 * @returns {string[]} Array of tag names
 */
function listTags() {
  return Object.keys(TAG_TO_SECTION);
}

/**
 * Get the section for a given tag (for debugging).
 * @param {string} tag - The semantic tag
 * @returns {string|null} Section name or null
 */
function getSectionForTag(tag) {
  return TAG_TO_SECTION[tag] || null;
}

// ============================================================
// Exports
// ============================================================
module.exports = {
  routeTag,
  listTags,
  getSectionForTag,
  TAG_TO_SECTION,
  FULL_BULA_FALLBACK_SECTIONS,
};
