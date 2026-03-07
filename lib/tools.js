/**
 * MCP Intent Detection & Drug Extraction for PharmaBula
 * 
 * This module handles:
 * 1. LLM-based drug name extraction from user messages
 * 2. Local fallback extraction when LLM fails
 * 3. Intent detection (what the user is asking about)
 * 
 * The router logic lives in chat.js and uses these functions
 * to decide which tools to call via the tool_registry.
 */

const { listDrugNames } = require("./sample_data");

const HF_API_URL = "https://router.huggingface.co/v1/chat/completions";
const HF_MODEL = "meta-llama/Llama-3.1-8B-Instruct:cerebras";

// ============================================================
// Drug Name Extraction (LLM-based)
// ============================================================

/**
 * Use the LLM to extract drug/medication names from the user's message.
 * @param {string} message - User's chat message (may include conversation context)
 * @param {string} apiKey - HuggingFace API key
 * @returns {Promise<string[]>} Detected drug names
 */
async function extractDrugNames(message, apiKey) {
  try {
    const res = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: [
          {
            role: "system",
            content: `Você é um extrator de nomes de medicamentos. Dada uma mensagem do usuário (que pode incluir contexto de conversa anterior), extraia APENAS os nomes de medicamentos ou princípios ativos mencionados ou referenciados. Responda SOMENTE com um array JSON de strings, sem explicação. Se nenhum medicamento for mencionado ou referenciado, responda com [].

REGRAS:
- Se a mensagem atual faz referência a um medicamento mencionado no contexto anterior (ex: "me dê os genéricos", "me fale mais sobre ele"), extraia o nome do medicamento do contexto.
- Extraia APENAS nomes de medicamentos reais, nunca palavras genéricas.

Exemplos:
- "Quais os efeitos do paracetamol?" → ["paracetamol"]
- "Posso tomar dipirona com ibuprofeno?" → ["dipirona", "ibuprofeno"]
- "Estou com dor de cabeça" → []
- "Me fale sobre losartana potássica" → ["losartana"]
- Contexto: "perguntou sobre paracetamol" + Mensagem: "me dê as versões genéricas" → ["paracetamol"]
- Contexto: "perguntou sobre ibuprofeno" + Mensagem: "e os efeitos colaterais?" → ["ibuprofeno"]`,
          },
          { role: "user", content: message },
        ],
        max_tokens: 100,
        temperature: 0,
      }),
    });

    if (!res.ok) {
      console.warn("Drug extraction LLM call failed:", res.status);
      return [];
    }

    const data = await res.json();
    const text = (data.choices?.[0]?.message?.content || "[]").trim();

    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      const names = JSON.parse(match[0]);
      return names
        .filter((n) => typeof n === "string" && n.length > 1)
        .map((n) => n.toLowerCase().trim());
    }

    return [];
  } catch (err) {
    console.warn("Drug name extraction error:", err.message);
    return [];
  }
}

// ============================================================
// Local Fallback Extraction
// ============================================================

/**
 * Local fallback: extract drug names using sample data + keyword matching.
 * Used when the LLM extraction call fails.
 * @param {string} message
 * @returns {string[]}
 */
function localFallbackExtract(message) {
  const msgLower = message.toLowerCase();
  const found = [];

  const sampleNames = listDrugNames();
  for (const name of sampleNames) {
    if (msgLower.includes(name.toLowerCase())) {
      found.push(name.toLowerCase());
    }
  }

  const aliases = {
    "acetaminofeno": "paracetamol",
    "metamizol": "dipirona",
    "ácido acetilsalicílico": "aspirina",
    "acido acetilsalicilico": "aspirina",
  };
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (msgLower.includes(alias) && !found.includes(canonical)) {
      found.push(canonical);
    }
  }

  return found;
}

// ============================================================
// Intent Detection
// ============================================================

/** Section-specific intent patterns */
const SECTION_INTENTS = [
  { keywords: /(contraindica|contra.indica)/i, section: "contraindicações" },
  { keywords: /(efeito.*(colateral|adverso)|rea(ç|c)(ã|a)o.*(adversa|colateral)|colateral|adverso)/i, section: "efeitos_colaterais" },
  { keywords: /(posologia|dosagem|dose|como (tomar|usar)|quanto tomar)/i, section: "posologia" },
  { keywords: /(intera(ç|c)(ã|a)o|junto com|mistur)/i, section: "interacoes" },
  { keywords: /(indica(ç|c)(ã|a)o|para que serve|pra que serve|serve para)/i, section: "indicacoes" },
  { keywords: /(composi(ç|c)(ã|a)o|ingrediente|princ(í|i)pio ativo|formula)/i, section: "composicao" },
  { keywords: /(armazen|conserva(ç|c)|guardar|estoc)/i, section: "armazenamento" },
  { keywords: /(superdos|overdose|excesso|tomei.*(mais|demais))/i, section: "superdosagem" },
  { keywords: /(farmacocin|absorção|metaboli|meia.vida)/i, section: "farmacocinetica" },
  { keywords: /(mecanismo.*a(ç|c)(ã|a)o|como (funciona|age|atua))/i, section: "mecanismo_acao" },
];

/** Generics intent pattern */
const GENERICS_PATTERN = /(genéric|generic|vers(ão|ões|ao|oes)|compara|similar|referência|referencia|fabricante|laborat(ó|o)rio|registr|marca)/i;

/**
 * Detect the user's intent from their message.
 * @param {string} message - User's message
 * @returns {Object} Intent detection result
 */
function detectIntent(message) {
  const msgLower = message.toLowerCase();

  // Check for generics intent
  if (GENERICS_PATTERN.test(msgLower)) {
    return { type: "generics", section: null };
  }

  // Check for section-specific intent
  const sectionMatch = SECTION_INTENTS.find(s => s.keywords.test(msgLower));
  if (sectionMatch) {
    return { type: "section", section: sectionMatch.section };
  }

  // Default: general query
  return { type: "general", section: null };
}

module.exports = { extractDrugNames, localFallbackExtract, detectIntent };
