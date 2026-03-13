/**
 * MongoDB Tools for BulaIA MCP Server
 * 
 * Replaces PDF download approach with direct MongoDB queries.
 * Uses the pre-processed bula data with sections already extracted.
 */

const { MongoClient } = require('mongodb');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 
  "mongodb+srv://p:5M4S9aJgGJWcyNXc@cluster0.vecl95h.mongodb.net/?appName=Cluster0";

let client = null;
let db = null;
let collection = null;

/**
 * Get MongoDB collection (lazy connection)
 */
async function getCollection() {
  if (!collection) {
    if (!client) {
      client = new MongoClient(MONGODB_URI);
      await client.connect();
    }
    db = client.db("bulas");
    collection = db.collection("documentos");
  }
  return collection;
}

/**
 * Search medications by name or active ingredient
 */
async function searchMedication(query, bulaType = "paciente") {
  try {
    const coll = await getCollection();
    
    // Case-insensitive regex search on name
    const docs = await coll.find({
      nome_medicamento: { $regex: query, $options: "i" },
      tipo: "bula"
    }).limit(20).toArray();
    
    return docs.map(doc => ({
      id: doc._id.toString(),
      name: doc.nome_medicamento,
      activeIngredient: doc.composicao || "",
      company: "",
      bulletinType: bulaType,
      source: "MongoDB Local",
      has_section: doc.has_section || {}
    }));
  } catch (error) {
    console.error("MongoDB search error:", error);
    return [];
  }
}

/**
 * Get full bula data for a medication
 */
async function getBulaData(drugName, mode = "patient") {
  try {
    const coll = await getCollection();
    
    const doc = await coll.findOne({
      nome_medicamento: { $regex: new RegExp(`^${drugName}$`, "i") },
      tipo: "bula"
    });
    
    if (!doc) {
      // Try partial match
      const partialDoc = await coll.findOne({
        nome_medicamento: { $regex: drugName, $options: "i" },
        tipo: "bula"
      });
      
      if (!partialDoc) {
        return { found: false, message: `Bula de '${drugName}' não encontrada.` };
      }
      return formatBulaData(partialDoc, mode);
    }
    
    return formatBulaData(doc, mode);
  } catch (error) {
    console.error("MongoDB getBulaData error:", error);
    return { found: false, error: error.message };
  }
}

/**
 * Format bula data for response
 */
function formatBulaData(doc, mode) {
  const sections = doc.secoes || {};
  const hasSection = doc.has_section || {};
  
  // Build text content from available sections
  let textContent = `MEDICAMENTO: ${doc.nome_medicamento}\n\n`;
  
  if (hasSection.indicacao) {
    textContent += `INDICAÇÕES:\n${sections.indicacao}\n\n`;
  }
  if (hasSection.posologia) {
    textContent += `POSOLOGIA:\n${sections.posologia}\n\n`;
  }
  if (hasSection.contraindicacao) {
    textContent += `CONTRAINDICAÇÕES:\n${sections.contraindicacao}\n\n`;
  }
  if (hasSection.advertencias) {
    textContent += `ADVERTÊNCIAS:\n${sections.advertencias}\n\n`;
  }
  if (hasSection.reacoes) {
    textContent += `REAÇÕES ADVERSAS:\n${sections.reacoes}\n\n`;
  }
  
  return {
    found: true,
    source: "MongoDB Local",
    data: {
      id: doc._id.toString(),
      name: doc.nome_medicamento,
      activeIngredient: doc.composicao || "",
      company: "",
      bulletinType: mode === "professional" ? "profissional" : "paciente",
      textContent: textContent,
      sections: sections,
      has_section: hasSection
    }
  };
}

/**
 * Get specific section from bula
 */
async function getSection(drugName, section, mode = "patient") {
  try {
    const coll = await getCollection();
    
    const doc = await coll.findOne({
      nome_medicamento: { $regex: drugName, $options: "i" },
      tipo: "bula"
    });
    
    if (!doc) {
      return {
        tool: "get_section",
        drug_name: drugName,
        section: section,
        found: false,
        pdfUrl: null,
        data: null,
        error: `Medicamento '${drugName}' não encontrado`
      };
    }
    
    const hasSection = doc.has_section || {};
    const sections = doc.secoes || {};
    
    // Check if section exists
    if (hasSection[section] && sections[section]) {
      return {
        tool: "get_section",
        drug_name: drugName,
        section: section,
        found: true,
        pdfUrl: null,
        data: {
          name: doc.nome_medicamento,
          section: section,
          content: sections[section],
          pdfUrl: null
        },
        message: null
      };
    }
    
    // Fallback: search in full text
    const text = doc.texto_completo || "";
    const sectionKeywords = {
      contraindicacao: ["contraindicado", "não deve", "não use"],
      posologia: ["posologia", "dose", "como usar"],
      indicacao: ["indicação", "indicado para"],
      reacoes: ["reação", "efeito adverso", "efeito colateral"],
      advertencias: ["advertência", "precaução", "cuidado"]
    };
    
    const keywords = sectionKeywords[section] || [section];
    for (const kw of keywords) {
      const regex = new RegExp(`${kw}[^.]*[?.]`, "i");
      const match = text.match(regex);
      if (match) {
        return {
          tool: "get_section",
          drug_name: drugName,
          section: section,
          found: true,
          pdfUrl: null,
          data: {
            name: doc.nome_medicamento,
            section: section,
            content: match[0] + " (Busca no texto completo)",
            pdfUrl: null
          },
          message: `Seção '${section}' encontrada via busca no texto`
        };
      }
    }
    
    return {
      tool: "get_section",
      drug_name: drugName,
      section: section,
      found: false,
      pdfUrl: null,
      data: null,
      message: `Seção '${section}' não encontrada na bula de '${drugName}'`
    };
    
  } catch (error) {
    console.error("MongoDB getSection error:", error);
    return {
      tool: "get_section",
      drug_name: drugName,
      section: section,
      found: false,
      pdfUrl: null,
      data: null,
      error: error.message
    };
  }
}

/**
 * Search by active ingredient
 */
async function searchByIngredient(ingredient) {
  try {
    const coll = await getCollection();
    
    const docs = await coll.find({
      tipo: "bula",
      composicao: { $regex: ingredient, $options: "i" }
    }).limit(20).toArray();
    
    return docs.map(doc => ({
      id: doc._id.toString(),
      name: doc.nome_medicamento,
      activeIngredient: doc.composicao || "",
      source: "MongoDB Local"
    }));
  } catch (error) {
    console.error("MongoDB searchByIngredient error:", error);
    return [];
  }
}

/**
 * Full text search
 */
async function searchText(term) {
  try {
    const coll = await getCollection();
    
    // Try text index first
    try {
      const docs = await coll.find({
        $text: { $search: term },
        tipo: "bula"
      }).limit(20).toArray();
      
      return docs.map(doc => ({
        id: doc._id.toString(),
        name: doc.nome_medicamento,
        source: "MongoDB Text Search"
      }));
    } catch (e) {
      // No text index, fallback to regex
      const docs = await coll.find({
        tipo: "bula",
        texto_completo: { $regex: term, $options: "i" }
      }).limit(20).toArray();
      
      return docs.map(doc => ({
        id: doc._id.toString(),
        name: doc.nome_medicamento,
        source: "MongoDB Regex Search"
      }));
    }
  } catch (error) {
    console.error("MongoDB searchText error:", error);
    return [];
  }
}

module.exports = {
  getCollection,
  searchMedication,
  getBulaData,
  getSection,
  searchByIngredient,
  searchText
};
