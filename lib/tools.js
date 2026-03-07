/**
 * MCP-Style Tools for PharmaBula
 * 
 * Implements the same tool pattern as the original MCP server (server.py):
 * - search_medication: Search drugs by name/ingredient
 * - get_bula_data: Get bula content for a specific drug and role
 * - check_interactions: Check interactions between multiple drugs
 * 
 * These tools are called by the chat handler to retrieve real drug data
 * before sending it to the LLM as context.
 */

const { searchDrugs, getDrugByName, listDrugNames } = require("./sample_data");
const { searchAnvisa, searchAnvisaByIngredient } = require("./anvisa");

const HF_API_URL = "https://router.huggingface.co/v1/chat/completions";
const HF_MODEL = "meta-llama/Llama-3.1-8B-Instruct:cerebras";

/**
 * Use the LLM to extract drug/medication names from the user's message.
 * Makes a fast, low-token call to identify medications intelligently.
 *
 * @param {string} message - User's chat message
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

    // Parse the JSON array from the response
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

/**
 * MCP Tool: search_medication
 * Searches embedded sample data + ANVISA API fallback.
 * 
 * @param {string} query - Drug name or ingredient
 * @param {string} bulaType - "paciente" or "profissional"
 * @returns {Promise<Object>} Search results
 */
async function toolSearchMedication(query, bulaType = "paciente") {
  // Search embedded data first
  let results = searchDrugs(query, bulaType);

  // If no results in embedded data, try ANVISA API
  if (results.length === 0) {
    const anvisaResults = await searchAnvisa(query);
    if (anvisaResults.length > 0) {
      results = anvisaResults.map(r => ({
        ...r,
        textContent: null, // ANVISA search doesn't return full text
        source: "ANVISA API",
      }));
    }
  } else {
    results = results.map(r => ({
      ...r,
      source: "Base de dados local",
    }));
  }

  return {
    tool: "search_medication",
    query,
    bulaType,
    resultsCount: results.length,
    results: results.map(r => ({
      id: r.id,
      name: r.name,
      activeIngredient: r.activeIngredient,
      company: r.company,
      bulletinType: r.bulletinType,
      source: r.source || "Base de dados local",
    })),
  };
}

/**
 * MCP Tool: get_bula_data
 * Gets the full bula content for a drug, filtered by user role.
 * 
 * @param {string} drugName - Name of the drug
 * @param {string} mode - "patient" or "professional"
 * @returns {Object} Bula data with full text content
 */
function toolGetBulaData(drugName, mode = "patient") {
  const bulaType = mode === "professional" ? "profissional" : "paciente";
  const drug = getDrugByName(drugName, bulaType);

  if (!drug) {
    return {
      tool: "get_bula_data",
      drugName,
      mode,
      found: false,
      message: `Medicamento '${drugName}' não encontrado na base de dados local.`,
    };
  }

  return {
    tool: "get_bula_data",
    drugName,
    mode,
    found: true,
    data: {
      id: drug.id,
      name: drug.name,
      activeIngredient: drug.activeIngredient,
      company: drug.company,
      bulletinType: drug.bulletinType,
      textContent: drug.textContent,
    },
  };
}

/**
 * MCP Tool: check_interactions
 * Checks interactions by retrieving interaction sections from multiple drugs.
 * 
 * @param {string[]} drugs - List of drug names
 * @param {string} mode - "patient" or "professional"
 * @returns {Object} Interaction data
 */
function toolCheckInteractions(drugs, mode = "patient") {
  const bulaType = mode === "professional" ? "profissional" : "paciente";
  const interactionData = [];

  for (const drugName of drugs) {
    const drug = getDrugByName(drugName, bulaType);
    if (drug && drug.textContent) {
      // Extract interaction section from bula text
      const text = drug.textContent;
      const interactionMatch = text.match(
        /INTERA[ÇC][ÕO]ES MEDICAMENTOSAS[^\n]*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n*$)/i
      );
      const interactionText = interactionMatch
        ? interactionMatch[1].trim()
        : "Seção de interações não encontrada na bula.";

      interactionData.push({
        drug: drugName,
        name: drug.name,
        interactions: interactionText,
      });
    } else {
      interactionData.push({
        drug: drugName,
        name: drugName,
        interactions: "Dados não disponíveis na base local.",
      });
    }
  }

  return {
    tool: "check_interactions",
    drugs,
    mode,
    data: interactionData,
  };
}

/**
 * MCP Tool: find_generic_versions
 * Searches ANVISA for all registered versions (generics, similar, reference)
 * of a medication's active ingredient.
 * 
 * @param {string} drugName - Name or active ingredient
 * @returns {Promise<Object>} List of registered versions
 */
async function toolFindGenericVersions(drugName) {
  // Search ANVISA for all versions
  const anvisaResults = await searchAnvisaByIngredient(drugName, 10);

  // Deduplicate by company name
  const seen = new Set();
  const versions = [];

  for (const r of anvisaResults) {
    const key = `${r.name}|${r.company}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      versions.push({
        name: r.name,
        company: r.company,
        activeIngredient: r.activeIngredient,
        registro: r.registro,
        categoria: r.categoria,
      });
    }
  }

  return {
    tool: "find_generic_versions",
    query: drugName,
    versionsFound: versions.length,
    versions,
    source: versions.length > 0 ? "ANVISA Bulário API" : "Nenhum resultado encontrado na ANVISA",
  };
}

/**
 * Execute all relevant tools for a user message and return context.
 * This is the main entry point called by chat.js.
 * 
 * @param {string} message - User's message
 * @param {string} mode - "patient" or "professional"
 * @param {string} apiKey - HuggingFace API key for LLM extraction
 * @returns {Promise<Object>} Tool results and context string
 */
async function executeTools(message, mode, apiKey) {
  const drugNames = await extractDrugNames(message, apiKey);
  console.log("Drugs detected by LLM:", drugNames);
  const toolResults = [];
  let contextParts = [];

  if (drugNames.length === 0) {
    // No specific drug detected — do a general search with the message
    const searchResult = await toolSearchMedication(message, mode === "professional" ? "profissional" : "paciente");
    toolResults.push(searchResult);

    // If we found results, get bula data for the first one
    if (searchResult.results.length > 0) {
      const firstDrug = searchResult.results[0];
      const bulaResult = toolGetBulaData(firstDrug.name, mode);
      toolResults.push(bulaResult);

      if (bulaResult.found) {
        contextParts.push(bulaResult.data.textContent);
      }
    }
  } else if (drugNames.length >= 2) {
    // Multiple drugs — check interactions + get bula data
    const interactionResult = toolCheckInteractions(drugNames, mode);
    toolResults.push(interactionResult);

    for (const name of drugNames) {
      const bulaResult = toolGetBulaData(name, mode);
      toolResults.push(bulaResult);
      if (bulaResult.found) {
        contextParts.push(bulaResult.data.textContent);
      }
    }

    // Add interaction data to context
    for (const item of interactionResult.data) {
      contextParts.push(`INTERAÇÕES DE ${item.drug.toUpperCase()}:\n${item.interactions}`);
    }
  } else {
    // Single drug — get bula data
    for (const name of drugNames) {
      const bulaResult = toolGetBulaData(name, mode);
      toolResults.push(bulaResult);
      if (bulaResult.found) {
        contextParts.push(bulaResult.data.textContent);
      }

      // Only search for generic versions if the user explicitly asks
      const msgLower = message.toLowerCase();
      const wantsGenerics = /(genéric|generic|vers(ão|ões|ao|oes)|compara|similar|referência|referencia|fabricante|laborat(ó|o)rio|registr|marca)/i.test(msgLower);

      if (wantsGenerics) {
        const genericsResult = await toolFindGenericVersions(name);
        toolResults.push(genericsResult);

        if (genericsResult.versionsFound > 0) {
          let genericsText = `\nVERSÕES REGISTRADAS NA ANVISA PARA "${name.toUpperCase()}":\n`;
          genericsText += `Total de registros encontrados: ${genericsResult.versionsFound}\n\n`;
          for (const v of genericsResult.versions) {
            genericsText += `- ${v.name} (${v.company})${v.registro ? ` — Reg. ${v.registro}` : ""}${v.categoria ? ` [${v.categoria}]` : ""}\n`;
          }
          genericsText += `\nFonte: ANVISA Bulário Eletrônico (consulta em tempo real)`;
          contextParts.push(genericsText);
        }
      }
    }
  }

  // Build sources list
  const sources = toolResults
    .filter(r => r.found || (r.results && r.results.length > 0))
    .map(r => {
      if (r.data) return { name: `Bula ${r.data.name} - ANVISA`, drug_id: r.data.id };
      if (r.results?.[0]) return { name: r.results[0].name, drug_id: r.results[0].id };
      return null;
    })
    .filter(Boolean);

  return {
    toolResults,
    context: contextParts.join("\n\n---\n\n"),
    sources,
    drugsDetected: drugNames,
  };
}

module.exports = { executeTools };
