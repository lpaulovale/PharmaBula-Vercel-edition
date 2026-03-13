const { searchMedication, getBulaData, getSection } = require('./lib/mongodb_tools');

async function test() {
  console.log("=== Testing MongoDB Tools ===\n");
  
  // Test 1: Search medication
  console.log("1. Testing search_medication('Reumon')...");
  const searchResults = await searchMedication("Reumon");
  console.log(`   Found: ${searchResults.length} results`);
  if (searchResults.length > 0) {
    console.log(`   First: ${searchResults[0].name}`);
  }
  
  // Test 2: Get bula data
  console.log("\n2. Testing get_bula_data('Reumon Gel')...");
  const bulaData = await getBulaData("Reumon Gel");
  console.log(`   Found: ${bulaData.found}`);
  console.log(`   Source: ${bulaData.source}`);
  console.log(`   Has sections: ${Object.keys(bulaData.data?.sections || {}).length}`);
  
  // Test 3: Get section
  console.log("\n3. Testing get_section('Reumon Gel', 'contraindicacao')...");
  const section = await getSection("Reumon Gel", "contraindicacao");
  console.log(`   Found: ${section.found}`);
  console.log(`   Content preview: ${section.data?.content?.substring(0, 100) || 'N/A'}...`);
  
  // Test 4: Get section with fallback
  console.log("\n4. Testing get_section('Resfriol', 'contraindicacao') [needs fallback]...");
  const sectionFallback = await getSection("Resfriol", "contraindicacao");
  console.log(`   Found: ${sectionFallback.found}`);
  console.log(`   Message: ${sectionFallback.message || sectionFallback.data?.content?.substring(0, 50) || 'N/A'}`);
  
  console.log("\n=== All tests completed ===");
  process.exit(0);
}

test().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
