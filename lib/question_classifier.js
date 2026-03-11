/**
 * BulaIA Question Classifier
 *
 * Classifies user questions into bula topics and returns implicit questions
 * that should be covered in the response.
 *
 * Topics (MVP):
 *   - posologia: dose, frequência, duração, como tomar, esquecimento
 *   - contraindicacoes: grupos proibidos, condições, interações graves
 *   - reacoes_adversas: efeitos comuns, graves, quando procurar médico
 *
 * Future expansion:
 *   - interacoes, populacoes_especiais, indicacoes, tempo_acao, dependencia
 */

const { chat } = require("./llm_client");

// ============================================================
// Topic Definitions with Implicit Questions
// ============================================================

const TOPIC_DEFINITIONS = {
  posologia: {
    label: "Posologia",
    implicit_questions: [
      "dose padrão para adulto",
      "frequência (vezes ao dia)",
      "duração do tratamento",
      "como tomar (com/sem alimento, horário)",
      "o que fazer se esquecer uma dose",
    ],
  },
  contraindicacoes: {
    label: "Contraindicações",
    implicit_questions: [
      "grupos contraindicados (grávidas, crianças, idosos)",
      "condições de saúde que impedem o uso",
      "interações medicamentosas graves",
      "interação com álcool",
      "consequências se tomar mesmo contraindicado",
    ],
  },
  reacoes_adversas: {
    label: "Reações Adversas",
    implicit_questions: [
      "efeitos colaterais mais comuns (>10%)",
      "efeitos colaterais graves que exigem parar o uso",
      "efeitos que desaparecem com o tempo",
      "o que fazer se aparecerem efeitos adversos",
      "se causa sonolência ou afeta capacidade de dirigir",
    ],
  },
  interacoes: {
    label: "Interações Medicamentosas",
    implicit_questions: [
      "medicamentos que não pode tomar junto",
      "alimentos ou bebidas que interferem",
      "se corta efeito de anticoncepcional",
      "se precisa ajustar dose de outros remédios",
      "quanto tempo esperar entre um e outro",
    ],
  },
  populacoes_especiais: {
    label: "Populações Especiais",
    implicit_questions: [
      "orientações específicas para o grupo mencionado",
      "se há versão pediátrica ou ajuste para idosos",
      "risco na gravidez ou amamentação",
      "se precisa ajustar dose para insuficiência renal/hepática",
    ],
  },
  indicacoes: {
    label: "Indicações",
    implicit_questions: [
      "quais doenças ou transtornos trata",
      "se é curativo ou só alivia sintomas",
      "se serve para o caso específico mencionado",
      "se existem alternativas",
    ],
  },
  tempo_acao: {
    label: "Tempo de Ação",
    implicit_questions: [
      "em quanto tempo começa a fazer efeito",
      "em quanto tempo atinge o pico",
      "quanto tempo fica no organismo",
      "quando esperar melhora dos sintomas",
    ],
  },
  dependencia: {
    label: "Dependência",
    implicit_questions: [
      "se causa dependência física ou psicológica",
      "se precisa de desmame gradual",
      "sintomas de abstinência",
      "se pode parar quando se sentir melhor",
    ],
  },
  superdosagem: {
    label: "Superdosagem",
    implicit_questions: [
      "sintomas de overdose",
      "o que fazer em caso de overdose",
      "dose máxima diária segura",
      "se é necessário buscar emergência",
    ],
  },
  armazenamento: {
    label: "Armazenamento",
    implicit_questions: [
      "temperatura adequada de armazenamento",
      "validade do medicamento",
      "como descartar corretamente",
      "se precisa de condições especiais (geladeira, etc.)",
    ],
  },
};

// ============================================================
// Keyword Patterns for Initial Classification
// ============================================================

const KEYWORD_PATTERNS = {
  posologia: [
    /posologia/i,
    /como tomar/i,
    /dose|dosagem/i,
    /quantos comprimidos|quantas gotas|quantas vezes/i,
    /frequência|frequencia|horário|horario/i,
    /duração do tratamento|tempo de tratamento/i,
    /esqueci de tomar|esqueceu uma dose/i,
    /antes ou depois de comer|com alimento|com comida/i,
  ],
  contraindicacoes: [
    /contraindicado|contraindicações|contraindicacoes/i,
    /não posso tomar|nao posso tomar/i,
    /proibido|impedido/i,
    /quem não pode|quem nao pode/i,
    /faz mal se/i,
    /risco de/i,
  ],
  reacoes_adversas: [
    /efeitos colaterais|reações adversas|reacoes adversas/i,
    /sintomas|sintoma/i,
    /náusea|nausea|vômito|vomito|tontura|dor de cabeça|dor de cabeca/i,
    /sonolência|sonolencia|sono/i,
    /alergia|alérgico|alergico/i,
    /reação|reacao/i,
  ],
  interacoes: [
    /interage|interação|interacao/i,
    /junto com|ao mesmo tempo|simultaneamente/i,
    /álcool|alcool|bebida alcoólica|bebida alcoolica/i,
    /outros remédios|outras medicações|outros medicamentos/i,
    /anticoncepcional|pílula|pula/i,
    /corta efeito|diminui efeito|aumenta efeito/i,
  ],
  populacoes_especiais: [
    /grávida|gravida|gestante|gravidez/i,
    /amamentando|amamentação|amamentacao|leite materno/i,
    /criança|crianca|pediátrico|pediatrico|infantil/i,
    /idoso|idosos|terceira idade/i,
    /renal|rim|rins|insuficiência renal|insuficiencia renal/i,
    /hepático|hepatica|fígado|figado|insuficiência hepática|insuficiencia hepatica/i,
  ],
  indicacoes: [
    /para que serve/i,
    /tratamento de|tratar/i,
    /doença|doenca|transtorno|condição|condicao/i,
    /indicação|indicacoes/i,
    /o que trata|o que cura/i,
  ],
  tempo_acao: [
    /quanto tempo demora|demora para fazer efeito/i,
    /início da ação|inicio da acao|começa a fazer|comeca a fazer/i,
    /duração do efeito|dura quanto tempo/i,
    /pico de ação|pico de acao/i,
    /quando faz efeito|quando começa a funcionar|quando comeca a funcionar/i,
  ],
  dependencia: [
    /vicia|dependência|dependencia/i,
    /dependente|viciado/i,
    /parar de tomar|interromper|descontinuar/i,
    /abstinência|abstinencia|sintomas de parada/i,
    /pode parar|posso parar/i,
  ],
  superdosagem: [
    /overdose|superdosagem|dose excessiva/i,
    /tomei demais|tomou demais/i,
    /dose máxima|dose maxima/i,
    /acidental|acidente/i,
  ],
  armazenamento: [
    /guardar|armazenar|conservar/i,
    /validade|vencimento|vence/i,
    /temperatura|geladeira|refrigerador/i,
    /descartar|descarte|jogar fora/i,
  ],
};

// ============================================================
// Classification Logic
// ============================================================

/**
 * Classify a question into bula topics using keyword matching first.
 * @param {string} question - User's question
 * @returns {Object} { topics: string[], confidence: number, method: 'keyword'|'llm' }
 */
function classifyWithKeywords(question) {
  const topicScores = {};

  for (const [topic, patterns] of Object.entries(KEYWORD_PATTERNS)) {
    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern.test(question)) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      topicScores[topic] = matchCount;
    }
  }

  // Sort by match count
  const sortedTopics = Object.entries(topicScores)
    .sort((a, b) => b[1] - a[1])
    .map(([topic]) => topic);

  if (sortedTopics.length === 0) {
    return { topics: [], confidence: 0, method: "keyword" };
  }

  // Calculate confidence based on match strength
  const maxMatches = Math.max(...Object.values(topicScores));
  const confidence = Math.min(1, maxMatches / 3); // 3+ matches = 100% confidence

  return {
    topics: sortedTopics,
    confidence,
    method: "keyword",
  };
}

/**
 * Classify a question using LLM (fallback when keywords are uncertain).
 * @param {string} question - User's question
 * @returns {Promise<Object>} { topics: string[], confidence: number, method: 'llm' }
 */
async function classifyWithLLM(question) {
  const availableTopics = Object.keys(TOPIC_DEFINITIONS).join(", ");

  const prompt = `Você é um classificador de perguntas farmacêuticas.

Classifique a pergunta abaixo em UM ou MAIS tópicos de bula:
${availableTopics}

Regras:
- Identifique o tópico PRINCIPAL e tópicos SECUNDÁRIOS se houver
- Se a pergunta mencionar grupos específicos (grávida, criança, idoso), inclua "populacoes_especiais"
- Se mencionar efeitos/sintomas, inclua "reacoes_adversas"
- Se mencionar como tomar/dose, inclua "posologia"
- Se mencionar contraindicações/proibições, inclua "contraindicacoes"

Retorne APENAS JSON válido:
{
  "topics": ["topic1", "topic2"],
  "confidence": 0.0-1.0,
  "reasoning": "breve explicação em português"
}

Pergunta: ${question}`;

  try {
    const result = await chat([
      { role: "system", content: "You are a pharmaceutical question classifier. Return ONLY valid JSON." },
      { role: "user", content: prompt },
    ], { maxTokens: 300, temperature: 0.1 });

    const jsonText = result.text.trim();
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.warn("[Classifier] LLM returned no JSON:", jsonText);
      return { topics: [], confidence: 0, method: "llm" };
    }

    const classification = JSON.parse(jsonMatch[0]);

    return {
      topics: classification.topics || [],
      confidence: classification.confidence || 0.5,
      method: "llm",
      reasoning: classification.reasoning,
    };
  } catch (err) {
    console.error("[Classifier] LLM classification failed:", err.message);
    return { topics: [], confidence: 0, method: "llm" };
  }
}

/**
 * Classify a question into bula topics.
 * Uses keyword matching first, falls back to LLM if confidence < 0.7.
 * @param {string} question - User's question
 * @param {boolean} forceLLM - Skip keyword matching and use LLM directly
 * @returns {Promise<Object>} { topics: string[], confidence: number, method: 'keyword'|'llm' }
 */
async function classifyQuestion(question, forceLLM = false) {
  if (!forceLLM) {
    const keywordResult = classifyWithKeywords(question);

    // If keyword confidence >= 0.7, use it
    if (keywordResult.confidence >= 0.7) {
      console.log(`[Classifier] Keyword classification: ${keywordResult.topics.join(", ")} (confidence: ${keywordResult.confidence})`);
      return keywordResult;
    }

    // If low confidence, fall back to LLM
    console.log(`[Classifier] Keyword confidence ${keywordResult.confidence} < 0.7, falling back to LLM`);
  }

  const llmResult = await classifyWithLLM(question);
  console.log(`[Classifier] LLM classification: ${llmResult.topics.join(", ")} (confidence: ${llmResult.confidence})`);
  return llmResult;
}

/**
 * Get implicit questions for a list of topics.
 * @param {string[]} topics - Array of topic names
 * @returns {string[]} Flattened array of implicit questions
 */
function getImplicitQuestions(topics) {
  const questions = [];

  for (const topic of topics) {
    const definition = TOPIC_DEFINITIONS[topic];
    if (definition) {
      questions.push(...definition.implicit_questions);
    }
  }

  return questions;
}

/**
 * Get topic definition with label and implicit questions.
 * @param {string} topic - Topic name
 * @returns {Object|null} Topic definition or null if not found
 */
function getTopicDefinition(topic) {
  return TOPIC_DEFINITIONS[topic] || null;
}

/**
 * List all available topics.
 * @returns {Array} Array of topic names
 */
function listTopics() {
  return Object.keys(TOPIC_DEFINITIONS);
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  classifyQuestion,
  getImplicitQuestions,
  getTopicDefinition,
  listTopics,
  // Export for testing/debugging
  classifyWithKeywords,
  TOPIC_DEFINITIONS,
  KEYWORD_PATTERNS,
};
