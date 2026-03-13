/**
 * MCP Tool Registry for BulaIA - MongoDB Version
 * 
 * Uses MongoDB for bula data instead of PDF downloads.
 * Sections are pre-extracted for fast access.
 */

const {
  searchMedication,
  getBulaData,
  getSection,
  searchByIngredient,
  searchText
} = require("./mongodb_tools");

// ============================================================
// Tool Definitions
// ============================================================
const TOOLS = [
  {
    name: "search_medication",
    description: "Pesquisa medicamentos por nome ou princípio ativo no MongoDB.",
    inputSchema: {
      type: "object",
      properties: {
        query:     { type: "string", description: "Nome do medicamento ou princípio ativo" },
        bula_type: { type: "string", enum: ["paciente", "profissional"], description: "Tipo de bula" },
      },
      required: ["query"],
    },
    handler: async ({ query, bula_type = "paciente" }) => {
      const results = await searchMedication(query, bula_type);
      
      return {
        tool: "search_medication",
        query,
        bula_type,
        resultsCount: results.length,
        results: results.map(r => ({
          id: r.id,
          name: r.name,
          activeIngredient: r.activeIngredient,
          company: r.company,
          bulletinType: r.bulletinType,
          source: r.source,
        })),
      };
    },
  },

  {
    name: "get_bula_data",
    description: "Obtém o conteúdo completo da bula de um medicamento do MongoDB.",
    inputSchema: {
      type: "object",
      properties: {
        drug_name: { type: "string", description: "Nome do medicamento" },
        mode:      { type: "string", enum: ["patient", "professional"], description: "Modo do usuário" },
      },
      required: ["drug_name"],
    },
    handler: async ({ drug_name, mode = "patient" }) => {
      const result = await getBulaData(drug_name, mode);
      
      return {
        tool: "get_bula_data",
        drug_name,
        mode,
        ...result,
      };
    },
  },

  {
    name: "get_section",
    description: "Extrai uma seção específica da bula (contraindicações, efeitos colaterais, posologia, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        drug_name: { type: "string", description: "Nome do medicamento" },
        section:   { 
          type: "string", 
          description: "Seção a extrair",
          enum: ["contraindicacao", "posologia", "indicacao", "reacoes", "advertencias", "superdosagem", "armazenamento", "mecanismo", "apresentacao"]
        },
        mode:      { type: "string", enum: ["patient", "professional"], description: "Modo do usuário" },
      },
      required: ["drug_name", "section"],
    },
    handler: async ({ drug_name, section, mode = "patient" }) => {
      const result = await getSection(drug_name, section, mode);
      return result;
    },
  },

  {
    name: "search_by_ingredient",
    description: "Busca medicamentos por princípio ativo.",
    inputSchema: {
      type: "object",
      properties: {
        ingredient: { type: "string", description: "Princípio ativo (ex: diclofenaco, ibuprofeno)" },
      },
      required: ["ingredient"],
    },
    handler: async ({ ingredient }) => {
      const results = await searchByIngredient(ingredient);
      
      return {
        tool: "search_by_ingredient",
        ingredient,
        resultsCount: results.length,
        results,
      };
    },
  },

  {
    name: "search_text",
    description: "Busca full-text em todas as bulas por termo.",
    inputSchema: {
      type: "object",
      properties: {
        term: { type: "string", description: "Termo para buscar (ex: dor de cabeça, gravidez)" },
      },
      required: ["term"],
    },
    handler: async ({ term }) => {
      const results = await searchText(term);
      
      return {
        tool: "search_text",
        term,
        resultsCount: results.length,
        results,
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
      const interactionData = [];
      
      for (const drugName of drugs) {
        const result = await getSection(drugName, "interacoes", mode);
        interactionData.push({
          drug: drugName,
          name: result.data?.name || drugName,
          interactions: result.data?.content || "Seção de interações não encontrada.",
        });
      }
      
      return {
        tool: "check_interactions",
        drugs,
        mode,
        data: interactionData,
      };
    },
  },
];

// ============================================================
// Tool List and Execution
// ============================================================
function listTools() {
  return TOOLS;
}

async function executeTool(name, args) {
  const tool = TOOLS.find(t => t.name === name);
  
  if (!tool) {
    return {
      error: true,
      message: `Tool '${name}' not found`,
    };
  }
  
  try {
    const result = await tool.handler(args);
    return result;
  } catch (error) {
    console.error(`Tool execution error (${name}):`, error);
    return {
      error: true,
      message: error.message,
      tool: name,
    };
  }
}

module.exports = {
  listTools,
  executeTool,
};
