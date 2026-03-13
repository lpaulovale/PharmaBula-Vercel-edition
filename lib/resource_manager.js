/**
 * MCP Resource Manager for BulaIA
 * 
 * Manages all data sources following MCP protocol.
 * Resources are identified by URIs following the pattern:
 *   bula://{drug_name}/{mode}     → Local sample data
 *   anvisa://search?q={query}     → ANVISA product search
 *   anvisa://generics?q={name}    → ANVISA generic versions
 * 
 * Mirrors @server.list_resources() and @server.read_resource()
 * from the original tcc-final MCP server.
 */

const { searchDrugs, getDrugByName, listDrugNames } = require("./sample_data");
const { searchAnvisa, searchAnvisaByIngredient, fetchAnvisaBula } = require("./anvisa");

/**
 * List all available resources.
 * @returns {Array} Resource descriptors
 */
function listResources() {
  const drugs = listDrugNames();
  const resources = [];

  for (const name of drugs) {
    resources.push({
      uri: `bula://${encodeURIComponent(name.toLowerCase())}/paciente`,
      name: `Bula ${name} (Paciente)`,
      description: `Bula para pacientes do medicamento ${name}`,
      mimeType: "text/plain",
    });
    resources.push({
      uri: `bula://${encodeURIComponent(name.toLowerCase())}/profissional`,
      name: `Bula ${name} (Profissional)`,
      description: `Bula profissional do medicamento ${name}`,
      mimeType: "text/plain",
    });
  }

  resources.push({
    uri: "anvisa://search",
    name: "ANVISA Bulário Search",
    description: "Pesquisa em tempo real no Bulário Eletrônico da ANVISA",
    mimeType: "application/json",
  });

  resources.push({
    uri: "anvisa://generics",
    name: "ANVISA Generic Versions",
    description: "Busca todas as versões registradas (genéricos, similares, referência) na ANVISA",
    mimeType: "application/json",
  });

  return resources;
}

/**
 * Read a resource by URI.
 * @param {string} uri - Resource URI
 * @param {Object} [params] - Additional parameters (query, mode, etc.)
 * @returns {Promise<Object>} Resource content
 */
async function readResource(uri, params = {}) {
  // Parse URI
  if (uri.startsWith("bula://")) {
    const path = uri.replace("bula://", "");
    const parts = path.split("/");
    const drugName = decodeURIComponent(parts[0]);
    const bulaType = parts[1] || "paciente";

    const drug = getDrugByName(drugName, bulaType);
    if (!drug) {
      return { found: false, message: `Bula de '${drugName}' (${bulaType}) não encontrada.` };
    }

    return {
      found: true,
      source: "Base de dados local",
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

  if (uri === "anvisa://search") {
    const query = params.query || params.q || "";
    const pageSize = params.pageSize || 5;
    const results = await searchAnvisa(query, pageSize);
    return {
      found: results.length > 0,
      source: "ANVISA Bulário API",
      results,
    };
  }

  if (uri === "anvisa://generics") {
    const ingredient = params.query || params.q || params.ingredient || "";
    const pageSize = params.pageSize || 10;
    const results = await searchAnvisaByIngredient(ingredient, pageSize);

    // Deduplicate by company name
    const seen = new Set();
    const versions = [];
    for (const r of results) {
      const key = `${r.name}|${r.company}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        versions.push({
          name: r.name,
          company: r.company,
          activeIngredient: r.activeIngredient,
          registro: r.registro,
          categoria: r.categoria,
          pdfUrl: r.pdfUrl,
        });
      }
    }

    return {
      found: versions.length > 0,
      source: "ANVISA Bulário API",
      versionsFound: versions.length,
      versions,
    };
  }

  if (uri === "anvisa://bula") {
    const query = params.query || params.q || "";
    const bulaType = params.bulaType || params.bula_type || "paciente";
    const result = await fetchAnvisaBula(query, bulaType);

    if (!result) {
      return { found: false, message: `Bula de '${query}' não encontrada na ANVISA.` };
    }

    console.log('[DEBUG] resource_manager anvisa://bula pdfUrl:', result.pdfUrl);

    return {
      found: true,
      source: result.source || "ANVISA Bulário API",
      data: {
        id: result.id,
        name: result.name,
        company: result.company,
        activeIngredient: result.activeIngredient,
        registro: result.registro,
        pdfUrl: result.pdfUrl,
        textContent: result.textContent,
      },
      message: result.message || null,
    };
  }

  return { found: false, message: `Resource URI '${uri}' não reconhecida.` };
}

/**
 * Search local sample data by query.
 * @param {string} query - Search query
 * @param {string} bulaType - "paciente" or "profissional"
 * @returns {Array} Matching drugs
 */
function searchLocalDrugs(query, bulaType) {
  return searchDrugs(query, bulaType);
}

module.exports = { listResources, readResource, searchLocalDrugs, listDrugNames };
