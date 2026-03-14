/**
 * MCP Resource Manager for BulaIA
 *
 * Manages all data sources following MCP protocol.
 * Resources are identified by URIs following the pattern:
 *   bula://{drug_name}/{mode}     → Local sample data
 *
 * All data comes from MongoDB - no external scraping.
 */

const { searchDrugs, getDrugByName, listDrugNames } = require("./sample_data");

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

  return { found: false, message: `Resource URI '${uri}' não reconhecida.` };
}

module.exports = { listResources, readResource, listDrugNames };
