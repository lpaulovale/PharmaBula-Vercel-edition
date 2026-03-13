// Simple manual test for ANVISA integration.
// Usage: node scripts/test-anvisa.js "paracetamol"

const { fetchAnvisaBula } = require("../lib/anvisa");

async function main() {
  const query = process.argv[2] || "paracetamol";
  const bulaType = process.argv[3] || "paciente";

  console.log("[TEST] Querying ANVISA for:", { query, bulaType });

  try {
    const result = await fetchAnvisaBula(query, bulaType);
    if (!result) {
      console.log("[TEST] fetchAnvisaBula returned null");
      process.exit(1);
    }

    console.log("[TEST] Result summary:", {
      id: result.id,
      name: result.name,
      company: result.company,
      bulletinType: result.bulletinType,
      pdfUrl: result.pdfUrl,
      textLength: result.textContent ? result.textContent.length : 0,
      source: result.source,
      message: result.message || null,
    });

    if (!result.pdfUrl) {
      console.log("[TEST] WARNING: pdfUrl is null – ANVISA may be down or not returning IDs.");
      process.exit(1);
    }

    console.log("[TEST] SUCCESS: ANVISA returned a PDF URL.");
    process.exit(0);
  } catch (err) {
    console.error("[TEST] Error calling fetchAnvisaBula:", err);
    process.exit(1);
  }
}

main();

