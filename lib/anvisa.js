/**
 * ANVISA Bulário API Client
 *
 * Lightweight HTTP client for ANVISA's public drug bulletin API.
 * Supports:
 *   - Product search by name
 *   - Search by active ingredient (generics)
 *   - Fetch bula details (PDF URL) for a specific product ID
 *   - Download and extract text from bula PDFs
 *
 * API endpoint: https://consultas.anvisa.gov.br/api/consulta/bulario
 */

const pdfParse = require("pdf-parse");

const ANVISA_BASE_URL = "https://consultas.anvisa.gov.br/api/consulta/bulario";
const ANVISA_MEDICAMENTO_URL = "https://consultas.anvisa.gov.br/api/consulta/medicamento/produtos";
const TIMEOUT_MS = 8000;      // Allow slower ANVISA responses
const PDF_TIMEOUT_MS = 12000; // Allow a bit more time for PDF downloads

function buildAnvisaPdfUrl(idBulaProtegido) {
  if (!idBulaProtegido) return null;
  return `https://consultas.anvisa.gov.br/api/consulta/medicamentos/arquivo/bula/parecer/${idBulaProtegido}/?Authorization=`;
}

function pickProtectedBulaId(payload, bulaType = "paciente") {
  const patientId = payload?.idBulaPacienteProtegido || payload?.idBulaPaciente || payload?.idBulaPacienteProtegida;
  const professionalId = payload?.idBulaProfissionalProtegido || payload?.idBulaProfissional || payload?.idBulaProfissionalProtegida;

  if (String(bulaType).toLowerCase() === "profissional") return professionalId || patientId || null;
  return patientId || professionalId || null;
}

/**
 * Internal fetch helper with timeout and error handling.
 */
async function anvisaFetch(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Authorization": "Guest",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": "https://consultas.anvisa.gov.br/",
        "User-Agent": "BulaIA/1.0",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`ANVISA API returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    const content = data.content || [];

    return content.map(item => ({
      id: String(item.idProduto || ""),
      name: item.nomeProduto || "",
      company: item.razaoSocial || "",
      activeIngredient: item.principioAtivo || "",
      bulletinType: (item.tipoBula || "PACIENTE").toLowerCase() === "profissional"
        ? "profissional" : "paciente",
      expediente: item.numeroExpediente || "",
      registro: item.numeroRegistro || "",
      categoria: item.categoriaNome || "",
      processNumber: item.numProcesso || "",
      idBulaPacienteProtegido: item.idBulaPacienteProtegido || null,
      idBulaProfissionalProtegido: item.idBulaProfissionalProtegido || null,
      pdfUrl: buildAnvisaPdfUrl(pickProtectedBulaId(item, (item.tipoBula || "PACIENTE").toLowerCase())) ||
        (item.idProduto ? `https://consultas.anvisa.gov.br/api/consulta/bulario/${item.idProduto}/bula.pdf` : null),
    }));
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      console.warn("ANVISA API timeout after", TIMEOUT_MS, "ms");
    } else {
      console.warn("ANVISA API error:", err.message);
    }
    return [];
  }
}

/**
 * Search ANVISA by product name.
 */
async function searchAnvisa(query, pageSize = 3) {
  const url = `${ANVISA_BASE_URL}?count=${pageSize}&filter[nomeProduto]=${encodeURIComponent(query)}&page=1`;
  return anvisaFetch(url);
}

/**
 * Search ANVISA by active ingredient to find ALL registered versions.
 */
async function searchAnvisaByIngredient(ingredient, pageSize = 10) {
  const url = `${ANVISA_BASE_URL}?count=${pageSize}&filter[nomeProduto]=${encodeURIComponent(ingredient)}&page=1`;
  return anvisaFetch(url);
}

/**
 * Get detailed bula data for a specific product by its ANVISA ID.
 * Returns the product details including the PDF URL.
 * 
 * @param {string} productId - ANVISA product ID (idProduto)
 * @returns {Promise<Object|null>} Product details with PDF URL
 */
async function getBulaDetails(productId, bulaType = "paciente") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${ANVISA_BASE_URL}/${productId}`;
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "Authorization": "Guest",
        "User-Agent": "BulaIA/1.0",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`ANVISA details API returned ${res.status} for ID ${productId}`);
      return null;
    }

    const data = await res.json();
    console.log('[DEBUG] getBulaDetails raw keys:', Object.keys(data || {}));
    console.log('[DEBUG] getBulaDetails IDs:', {
      idProduto: data.idProduto,
      numProcesso: data.numProcesso,
      idBulaPacienteProtegido: data.idBulaPacienteProtegido,
      idBulaProfissionalProtegido: data.idBulaProfissionalProtegido,
      urlBula: data.urlBula,
    });
    
    const protectedId = pickProtectedBulaId(data, bulaType);
    const pdfUrl = buildAnvisaPdfUrl(protectedId) ||
      data.urlBula ||
      `https://consultas.anvisa.gov.br/api/consulta/bulario/${productId}/bula.pdf`;
    
    console.log('[ANVISA] getBulaDetails:', { 
      id: data.idProduto, 
      name: data.nomeProduto,
      bulaType,
      hasProtectedId: !!protectedId,
      hasUrlBula: !!data.urlBula,
      pdfUrl: pdfUrl?.substring(0, 80) + '...'
    });
    
    return {
      id: String(data.idProduto || productId),
      name: data.nomeProduto || "",
      company: data.razaoSocial || "",
      activeIngredient: data.principioAtivo || "",
      bulletinType: data.tipoBula || "paciente",
      pdfUrl: pdfUrl,
      idBulaPacienteProtegido: data.idBulaPacienteProtegido || null,
      idBulaProfissionalProtegido: data.idBulaProfissionalProtegido || null,
      registro: data.numeroRegistro || "",
      expediente: data.numeroExpediente || "",
    };
  } catch (err) {
    clearTimeout(timeout);
    console.warn("ANVISA details error:", err.message);
    return null;
  }
}

/**
 * Get detailed bula data for a specific product by its process number.
 * Uses the medicamento/produtos endpoint which usually exposes protected bula IDs.
 * 
 * @param {string} processNumber - ANVISA process number (numProcesso)
 * @returns {Promise<Object|null>} Product details with PDF URL
 */
async function getBulaDetailsByProcess(processNumber, bulaType = "paciente") {
  if (!processNumber) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${ANVISA_MEDICAMENTO_URL}/${processNumber}`;
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "Authorization": "Guest",
        "User-Agent": "BulaIA/1.0",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`ANVISA medicamento API returned ${res.status} for process ${processNumber}`);
      return null;
    }

    const data = await res.json();
    console.log('[DEBUG] getBulaDetailsByProcess IDs:', {
      idProduto: data.idProduto,
      numProcesso: data.numProcesso,
      idBulaPacienteProtegido: data.idBulaPacienteProtegido,
      idBulaProfissionalProtegido: data.idBulaProfissionalProtegido,
    });

    const protectedId = pickProtectedBulaId(data, bulaType);
    const pdfUrl = buildAnvisaPdfUrl(protectedId) || null;

    console.log('[ANVISA] getBulaDetailsByProcess:', {
      processNumber,
      name: data.nomeProduto,
      bulaType,
      hasProtectedId: !!protectedId,
      pdfUrl: pdfUrl?.substring(0, 80) + '...',
    });

    return {
      id: String(data.idProduto || ""),
      name: data.nomeProduto || "",
      company: data.razaoSocial || "",
      activeIngredient: data.principioAtivo || "",
      bulletinType: data.tipoBula || "paciente",
      pdfUrl,
      idBulaPacienteProtegido: data.idBulaPacienteProtegido || null,
      idBulaProfissionalProtegido: data.idBulaProfissionalProtegido || null,
      registro: data.numeroRegistro || "",
      expediente: data.numeroExpediente || "",
    };
  } catch (err) {
    clearTimeout(timeout);
    console.warn("ANVISA medicamento details error:", err.message);
    return null;
  }
}

/**
 * Download a PDF from a URL and extract its text content.
 * Optimized for Vercel 10s timeout limit.
 *
 * @param {string} pdfUrl - URL of the PDF to download
 * @returns {Promise<string|null>} Extracted text content, or null on failure
 */
async function fetchBulaText(pdfUrl) {
  if (!pdfUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PDF_TIMEOUT_MS);

  try {
    // Download PDF
    const res = await fetch(pdfUrl, {
      headers: {
        "Accept": "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
        "Authorization": "Guest",
        "Referer": "https://consultas.anvisa.gov.br/",
        "User-Agent": "BulaIA/1.0",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`PDF download failed: ${res.status}`);
      return null;
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType && !contentType.toLowerCase().includes("pdf") && !contentType.toLowerCase().includes("octet-stream")) {
      console.warn(`PDF download returned unexpected content-type: ${contentType}`);
      return null;
    }

    const buffer = await res.arrayBuffer();
    const pdfData = await pdfParse(Buffer.from(buffer));

    // Post-process: clean up common PDF extraction artifacts
    let text = pdfData.text || '';
    
    // Remove excessive whitespace but preserve section breaks
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // Fix common hyphenation issues (words split across lines)
    text = text.replace(/(\w+)-\n(\w+)/g, '$1$2');
    
    console.log(`[ANVISA] Extracted ${text.length} chars from PDF`);
    return text || null;
  } catch (err) {
    clearTimeout(timeout);
    console.warn("PDF extraction error:", err.message);
    return null;
  }
}

/**
 * Full pipeline: search ANVISA → get details → download PDF → extract text.
 * Returns the bula text for a specific product.
 * 
 * Caches extracted text in MongoDB to avoid re-processing same PDF.
 * 
 * @param {string} productName - Name of the product to search
 * @param {string} bulaType - "paciente" or "profissional"
 * @returns {Promise<Object|null>} Product info with extracted bula text
 */
async function fetchAnvisaBula(productName, bulaType = "paciente") {
  // Step 1: Search for the product
  const results = await searchAnvisa(productName, 5);
  if (results.length === 0) return null;

  // Find the best match (matching bula type if possible)
  const match = results.find(r => r.bulletinType === bulaType) || results[0];

  // Step 2: Get details with PDF URL (prefer medicamento/produtos endpoint for protected IDs)
  let details = null;
  if (match.processNumber) {
    details = await getBulaDetailsByProcess(match.processNumber, bulaType);
  }
  if (!details) {
    details = await getBulaDetails(match.id, bulaType);
  }

  if (!details || !details.pdfUrl) {
    console.log('[DEBUG] fetchAnvisaBula no details pdfUrl, using match.pdfUrl if any:', {
      productName,
      bulaType,
      matchId: match.id,
      matchProcess: match.processNumber,
      matchPdfUrl: match.pdfUrl,
    });
    
    // Try to extract text from match.pdfUrl directly
    if (match.pdfUrl) {
      console.log('[ANVISA] Trying to extract text from match.pdfUrl...');
      const textContent = await fetchBulaText(match.pdfUrl);
      return {
        ...match,
        pdfUrl: match.pdfUrl,
        textContent: textContent,
        message: textContent ? null : "PDF da bula não disponível na ANVISA para este produto.",
      };
    }
    
    return {
      ...match,
      pdfUrl: null,
      textContent: null,
      message: "PDF da bula não disponível na ANVISA para este produto.",
    };
  }

  console.log('[DEBUG] fetchAnvisaBula result:', {
    productName,
    bulaType,
    matchId: match.id,
    matchProcess: match.processNumber,
    matchPdfUrl: match.pdfUrl,
    detailsPdfUrl: details.pdfUrl,
  });

  // Step 3: Try to get cached version first
  try {
    const { getEvaluationsCollection } = require("./db");
    const cache = await getEvaluationsCollection();
    if (cache) {
      const cached = await cache.findOne({ 
        _type: 'bula_cache', 
        pdfUrl: details.pdfUrl 
      });
      if (cached && cached.textContent) {
        console.log(`[ANVISA] Cache hit for ${productName}`);
        return {
          ...details,
          textContent: cached.textContent,
          source: "Cache MongoDB",
          cached: true,
        };
      }
    }
  } catch (err) {
    console.warn("[ANVISA] Cache read failed:", err.message);
  }

  // Step 4: Download and extract PDF (no cache)
  console.log(`[ANVISA] Cache miss, downloading ${productName}...`);
  const textContent = await fetchBulaText(details.pdfUrl);

  // Step 5: Save to cache
  if (textContent) {
    try {
      const { getEvaluationsCollection } = require("./db");
      const cache = await getEvaluationsCollection();
      if (cache) {
        await cache.updateOne(
          { _type: 'bula_cache', pdfUrl: details.pdfUrl },
          { 
            $set: { 
              _type: 'bula_cache',
              pdfUrl: details.pdfUrl,
              textContent,
              name: details.name,
              company: details.company,
              cachedAt: new Date()
            } 
          },
          { upsert: true }
        );
        console.log(`[ANVISA] Cached ${productName} (${textContent.length} chars)`);
      }
    } catch (err) {
      console.warn("[ANVISA] Cache write failed:", err.message);
    }
  }

  return {
    ...details,
    textContent,
    source: "ANVISA Bulário Eletrônico (PDF)",
  };
}

module.exports = {
  searchAnvisa,
  searchAnvisaByIngredient,
  getBulaDetails,
  getBulaDetailsByProcess,
  fetchBulaText,
  fetchAnvisaBula,
};
