/**
 * MCP Tool Registry for PharmaBula
 * 
 * Registers all tools with JSON Schema definitions and handlers.
 * Mirrors @server.list_tools() and @server.call_tool() from the
 * original tcc-final MCP server (server.py).
 * 
 * Each tool has:
 *   - name: unique identifier
 *   - description: what the tool does
 *   - inputSchema: JSON Schema for parameters
 *   - handler: async function that executes the tool
 */

const { readResource, searchLocalDrugs } = require("./resource_manager");

// ============================================================
// Section extraction patterns (Portuguese bula headers)
// ============================================================
const SECTION_PATTERNS = {
  "contraindicações":  /CONTRAINDICA[ÇC][ÕO]ES[^\n]*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n*$)/i,
  "contraindicacoes":  /CONTRAINDICA[ÇC][ÕO]ES[^\n]*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n*$)/i,
  "efeitos_colaterais": /REA[ÇC][ÕO]ES ADVERSAS[^\n]*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n*$)/i,
  "reacoes_adversas":  /REA[ÇC][ÕO]ES ADVERSAS[^\n]*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n*$)/i,
  "posologia":         /POSOLOGIA[^\n]*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n*$)/i,
  "dosagem":           /POSOLOGIA[^\n]*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n*$)/i,
  "interacoes":        /INTERA[ÇC][ÕO]ES MEDICAMENTOSAS[^\n]*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n*$)/i,
  "indicacoes":        /INDICA[ÇC][ÕO]ES[^\n]*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n*$)/i,
  "composicao":        /COMPOSI[ÇC][ÃA]O[^\n]*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n*$)/i,
  "armazenamento":     /(?:ARMAZENAMENTO|CONSERVA[ÇC][ÃA]O|CUIDADOS DE CONSERVA)[^\n]*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n*$)/i,
  "superdosagem":      /SUPERDOS(AGEM|E)[^\n]*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n*$)/i,
  "farmacocinetica":   /FARMACOCIN[ÉE]TICA[^\n]*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n*$)/i,
  "mecanismo_acao":    /MECANISMO DE A[ÇC][ÃA]O[^\n]*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n*$)/i,
};

// ============================================================
// Tool Definitions
// ============================================================
const TOOLS = [
  {
    name: "search_medication",
    description: "Pesquisa medicamentos por nome ou princípio ativo na base local e API ANVISA.",
    inputSchema: {
      type: "object",
      properties: {
        query:     { type: "string", description: "Nome do medicamento ou princípio ativo" },
        bula_type: { type: "string", enum: ["paciente", "profissional"], description: "Tipo de bula" },
      },
      required: ["query"],
    },
    handler: async ({ query, bula_type = "paciente" }) => {
      // Try local first
      let results = searchLocalDrugs(query, bula_type);

      if (results.length === 0) {
        // Fallback to ANVISA API
        const anvisa = await readResource("anvisa://search", { query, pageSize: 5 });
        if (anvisa.found) {
          results = anvisa.results.map(r => ({ ...r, source: "ANVISA API" }));
        }
      } else {
        results = results.map(r => ({ ...r, source: "Base de dados local" }));
      }

      return {
        tool: "search_medication",
        query,
        bula_type,
        resultsCount: results.length,
        results: results.map(r => ({
          id: r.id, name: r.name, activeIngredient: r.activeIngredient,
          company: r.company, bulletinType: r.bulletinType, source: r.source,
        })),
      };
    },
  },

  {
    name: "get_bula_data",
    description: "Obtém o conteúdo completo da bula de um medicamento, filtrado pelo papel do usuário.",
    inputSchema: {
      type: "object",
      properties: {
        drug_name: { type: "string", description: "Nome do medicamento" },
        mode:      { type: "string", enum: ["patient", "professional"], description: "Modo do usuário" },
      },
      required: ["drug_name"],
    },
    handler: async ({ drug_name, mode = "patient" }) => {
      const bulaType = mode === "professional" ? "profissional" : "paciente";
      const resource = await readResource(`bula://${encodeURIComponent(drug_name)}/${bulaType}`);

      if (!resource.found) {
        return { tool: "get_bula_data", drug_name, mode, found: false, message: resource.message };
      }

      return { tool: "get_bula_data", drug_name, mode, found: true, data: resource.data };
    },
  },

  {
    name: "get_section",
    description: "Extrai uma seção específica da bula (contraindicações, efeitos colaterais, posologia, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        drug_name: { type: "string", description: "Nome do medicamento" },
        section:   { type: "string", description: "Seção a extrair", enum: Object.keys(SECTION_PATTERNS) },
        mode:      { type: "string", enum: ["patient", "professional"], description: "Modo do usuário" },
      },
      required: ["drug_name", "section"],
    },
    handler: async ({ drug_name, section, mode = "patient" }) => {
      const bulaType = mode === "professional" ? "profissional" : "paciente";
      const resource = await readResource(`bula://${encodeURIComponent(drug_name)}/${bulaType}`);

      if (!resource.found || !resource.data.textContent) {
        return { tool: "get_section", drug_name, section, found: false, message: `Bula de '${drug_name}' não encontrada.` };
      }

      const text = resource.data.textContent;
      const pattern = SECTION_PATTERNS[section.toLowerCase()];
      let sectionText = null;

      if (pattern) {
        const match = text.match(pattern);
        if (match) {
          sectionText = (match[2] || match[1]).trim();
        }
      }

      // Fallback: generic keyword search
      if (!sectionText) {
        const keyword = section.replace(/_/g, " ").toUpperCase();
        const fallback = new RegExp(keyword + "[^\\n]*\\n([\\s\\S]*?)(?=\\n[A-Z]{3,}|\\n*$)", "i");
        const match = text.match(fallback);
        if (match) sectionText = match[1].trim();
      }

      return {
        tool: "get_section",
        drug_name,
        section,
        found: !!sectionText,
        data: sectionText ? { name: resource.data.name, section, content: sectionText } : null,
        message: sectionText ? null : `Seção '${section}' não encontrada na bula de '${drug_name}'.`,
      };
    },
  },

  {
    name: "check_interactions",
    description: "Verifica interações medicamentosas entre dois ou mais medicamentos.",
    inputSchema: {
      type: "object",
      properties: {
        drugs: { type: "array", items: { type: "string" }, description: "Lista de nomes de medicamentos" },
        mode:  { type: "string", enum: ["patient", "professional"], description: "Modo do usuário" },
      },
      required: ["drugs"],
    },
    handler: async ({ drugs, mode = "patient" }) => {
      const bulaType = mode === "professional" ? "profissional" : "paciente";
      const interactionData = [];

      for (const drugName of drugs) {
        const resource = await readResource(`bula://${encodeURIComponent(drugName)}/${bulaType}`);
        if (resource.found && resource.data.textContent) {
          const match = resource.data.textContent.match(
            /INTERA[ÇC][ÕO]ES MEDICAMENTOSAS[^\n]*\n([\s\S]*?)(?=\n[A-Z]{3,}|\n*$)/i
          );
          interactionData.push({
            drug: drugName,
            name: resource.data.name,
            interactions: match ? match[1].trim() : "Seção de interações não encontrada.",
          });
        } else {
          interactionData.push({
            drug: drugName, name: drugName,
            interactions: "Dados não disponíveis na base local.",
          });
        }
      }

      return { tool: "check_interactions", drugs, mode, data: interactionData };
    },
  },

  {
    name: "find_generic_versions",
    description: "Busca todas as versões registradas (genéricos, similares, referência) de um medicamento na ANVISA.",
    inputSchema: {
      type: "object",
      properties: {
        drug_name: { type: "string", description: "Nome do medicamento ou princípio ativo" },
      },
      required: ["drug_name"],
    },
    handler: async ({ drug_name }) => {
      const resource = await readResource("anvisa://generics", { query: drug_name });

      return {
        tool: "find_generic_versions",
        query: drug_name,
        versionsFound: resource.versionsFound || 0,
        versions: resource.versions || [],
        source: resource.found ? "ANVISA Bulário API" : "Nenhum resultado encontrado na ANVISA",
      };
    },
  },

  {
    name: "fetch_anvisa_bula",
    description: "Busca a bula real de um medicamento específico na ANVISA (baixa o PDF e extrai o texto).",
    inputSchema: {
      type: "object",
      properties: {
        drug_name: { type: "string", description: "Nome exato do produto (ex: 'Paracetamol Richet')" },
        mode:      { type: "string", enum: ["patient", "professional"], description: "Modo do usuário" },
      },
      required: ["drug_name"],
    },
    handler: async ({ drug_name, mode = "patient" }) => {
      const bulaType = mode === "professional" ? "profissional" : "paciente";
      const resource = await readResource("anvisa://bula", { query: drug_name, bulaType });

      if (!resource.found) {
        return { tool: "fetch_anvisa_bula", drug_name, found: false, message: resource.message };
      }

      return {
        tool: "fetch_anvisa_bula",
        drug_name,
        found: true,
        data: resource.data,
        hasPdfText: !!resource.data.textContent,
        message: resource.message,
      };
    },
  },
];

// ============================================================
// Registry API
// ============================================================

/**
 * List all registered tools with their schemas.
 * @returns {Array} Tool definitions (without handlers)
 */
function listTools() {
  return TOOLS.map(({ name, description, inputSchema }) => ({
    name, description, inputSchema,
  }));
}

/**
 * Get a specific tool by name.
 * @param {string} name - Tool name
 * @returns {Object|null} Tool definition
 */
function getToolByName(name) {
  return TOOLS.find(t => t.name === name) || null;
}

/**
 * Execute a tool by name with the given arguments.
 * @param {string} name - Tool name
 * @param {Object} args - Tool arguments
 * @returns {Promise<Object>} Tool result
 */
async function executeTool(name, args) {
  const tool = getToolByName(name);
  if (!tool) {
    return { error: true, message: `Tool '${name}' not found in registry.` };
  }
  console.log(`[MCP] Executing tool: ${name}`, JSON.stringify(args));
  const result = await tool.handler(args);
  console.log(`[MCP] Tool ${name} completed.`);
  return result;
}

module.exports = { listTools, getToolByName, executeTool, SECTION_PATTERNS };
