/**
 * ANVISA Bulário API Client
 * 
 * Lightweight HTTP client for ANVISA's public drug bulletin API.
 * Used as fallback when a drug is not found in embedded sample data,
 * and for finding generic versions / multiple registrations.
 * 
 * API endpoint: https://consultas.anvisa.gov.br/api/consulta/bulario
 */

const ANVISA_BASE_URL = "https://consultas.anvisa.gov.br/api/consulta/bulario";
const TIMEOUT_MS = 4000; // 4s timeout to stay within Vercel's 10s limit

/**
 * Internal fetch helper with timeout and error handling.
 */
async function anvisaFetch(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "Authorization": "Guest",
        "User-Agent": "PharmaBula/1.0",
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
 * @param {string} query - Drug name to search
 * @param {number} [pageSize=3] - Max results
 * @returns {Promise<Array>} Search results
 */
async function searchAnvisa(query, pageSize = 3) {
  const url = `${ANVISA_BASE_URL}?filter[nomeProduto]=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`;
  return anvisaFetch(url);
}

/**
 * Search ANVISA by active ingredient to find ALL registered versions
 * (generics, similar, reference) for the same substance.
 * @param {string} ingredient - Active ingredient name (e.g. "paracetamol")
 * @param {number} [pageSize=10] - Max results
 * @returns {Promise<Array>} All registered versions
 */
async function searchAnvisaByIngredient(ingredient, pageSize = 10) {
  const url = `${ANVISA_BASE_URL}?filter[nomeProduto]=${encodeURIComponent(ingredient)}&page=1&pageSize=${pageSize}`;
  return anvisaFetch(url);
}

module.exports = { searchAnvisa, searchAnvisaByIngredient };

