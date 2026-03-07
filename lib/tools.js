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
const { searchAnvisa } = require("./anvisa");

// Common drug name patterns to extract from user messages
const KNOWN_DRUGS = [
  "paracetamol", "acetaminofeno", "dipirona", "metamizol", "ibuprofeno",
  "omeprazol", "amoxicilina", "losartana", "metformina", "sinvastatina",
  "captopril", "atenolol", "diclofenaco", "prednisona", "azitromicina",
  "fluoxetina", "pantoprazol", "enalapril", "hidroclorotiazida", "aspirina",
  "ácido acetilsalicílico", "rivotril", "clonazepam", "diazepam", "lorazepam",
];

/**
 * Extract potential drug names from a user message.
 * @param {string} message - User's chat message
 * @returns {string[]} Detected drug names
 */
function extractDrugNames(message) {
  const msgLower = message.toLowerCase();
  const found = [];

  for (const drug of KNOWN_DRUGS) {
    if (msgLower.includes(drug)) {
      found.push(drug);
    }
  }

  // Also check against our sample data names
  const sampleNames = listDrugNames();
  for (const name of sampleNames) {
    if (msgLower.includes(name.toLowerCase()) && !found.includes(name.toLowerCase())) {
      found.push(name.toLowerCase());
    }
  }

  return found;
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
 * Execute all relevant tools for a user message and return context.
 * This is the main entry point called by chat.js.
 * 
 * @param {string} message - User's message
 * @param {string} mode - "patient" or "professional"
 * @returns {Promise<Object>} Tool results and context string
 */
async function executeTools(message, mode) {
  const drugNames = extractDrugNames(message);
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

module.exports = { executeTools, extractDrugNames };
