/**
 * ANVISA Bulário API Client
 * 
 * Lightweight HTTP client for ANVISA's public drug bulletin API.
 * Used as fallback when a drug is not found in embedded sample data.
 * 
 * API endpoint: https://consultas.anvisa.gov.br/api/consulta/bulario
 */

const ANVISA_BASE_URL = "https://consultas.anvisa.gov.br/api/consulta/bulario";
const TIMEOUT_MS = 3000; // 3s timeout to stay within Vercel's 10s limit

/**
 * Search ANVISA for drugs by name.
 * @param {string} query - Drug name to search
 * @param {number} [pageSize=3] - Max results
 * @returns {Promise<Array>} Search results
 */
async function searchAnvisa(query, pageSize = 3) {
  const url = `${ANVISA_BASE_URL}?filter[nomeProduto]=${encodeURIComponent(query)}&page=1&pageSize=${pageSize}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

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
    }));
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("ANVISA API timeout after", TIMEOUT_MS, "ms");
    } else {
      console.warn("ANVISA API error:", err.message);
    }
    return [];
  }
}

module.exports = { searchAnvisa };
