/**
 * MCP Resource Manager for BulaIA
 *
 * Manages all data sources following MCP protocol.
 * Resources are identified by URIs following the pattern:
 *   bula://{drug_name}/{mode}     → MongoDB data
 *
 * All data comes from MongoDB - no local sample data.
 */

/**
 * List all available resources.
 * @returns {Array} Resource descriptors
 */
function listResources() {
  // No local resources - data comes from MongoDB only
  return [];
}

/**
 * Read a resource by URI.
 * @param {string} uri - Resource URI
 * @param {Object} [params] - Additional parameters (query, mode, etc.)
 * @returns {Promise<Object>} Resource content
 */
async function readResource(uri, params = {}) {
  // Local sample data removed - resources must be fetched from MongoDB
  return { found: false, message: `Local sample data not available. Fetch from MongoDB via API.` };
}

module.exports = { listResources, readResource };
