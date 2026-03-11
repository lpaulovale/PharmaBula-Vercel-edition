/**
 * BulaIA Tools Utilities
 *
 * Provides utility functions for drug name processing.
 * Note: Drug extraction and intent detection are now handled by lib/planner.js
 *
 * Exported functions:
 *   - localFallbackExtract() → Regex-based drug extraction (fallback when LLM fails)
 */

const { listDrugNames } = require("./sample_data");

// ============================================================
// Local Fallback Extraction (used by planner fallback)
// ============================================================

/**
 * Local fallback: extract drug names using sample data + keyword matching.
 * Used when the LLM planner fails.
 * @param {string} message
 * @returns {string[]}
 */
function localFallbackExtract(message) {
  const msgLower = message.toLowerCase();
  const found = [];

  const sampleNames = listDrugNames();
  for (const name of sampleNames) {
    if (msgLower.includes(name.toLowerCase())) {
      found.push(name.toLowerCase());
    }
  }

  const aliases = {
    "acetaminofeno": "paracetamol",
    "metamizol": "dipirona",
    "ácido acetilsalicílico": "aspirina",
    "acido acetilsalicilico": "aspirina",
  };
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (msgLower.includes(alias) && !found.includes(canonical)) {
      found.push(canonical);
    }
  }

  return found;
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  localFallbackExtract,
};
