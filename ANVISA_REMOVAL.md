# 🧹 ANVISA Scraper Removal Summary

## Overview
Removed all web scraping functionality from the PharmaBula AI project. The application now relies **exclusively on MongoDB** for all bula data.

---

## Files Removed

| File | Purpose |
|------|---------|
| `lib/anvisa-scraper.js` | Playwright-based ANVISA scraper |
| `lib/anvisa.js` | ANVISA API client |
| `scripts/test-anvisa.js` | ANVISA testing script |
| `ANVISA_SCRAPER.md` | Scraper documentation |
| `WEB_SHARE_SETUP.md` | Webshare proxy setup guide |

---

## Files Modified

### 1. `package.json`
- ❌ Removed `playwright` dependency
- ❌ Removed `playwright-extra` dependency
- ❌ Removed `puppeteer-extra-plugin-stealth` dependency
- ❌ Removed `test:anvisa` script
- ✅ Updated description to "MongoDB Only"

### 2. `server.js`
- ❌ Removed `/api/pdf` proxy endpoint
- ❌ Removed `/api/medication/:drugName` scraping endpoint
- ❌ Removed `getPdfUrl` import
- ❌ Removed `USER_AGENT` constant
- ✅ Updated server banner to reflect MongoDB-only architecture

### 3. `api/chat.js`
- ❌ Removed PDF download code (pdfBuffer, pdfBase64, arrayBuffer)
- ❌ Removed PDF URL fetching logic
- ❌ Removed `anvisaError` metadata field
- ✅ Changed `anvisaFailure` to `mongoFailure`
- ✅ Updated source names (removed "ANVISA" branding)

### 4. `lib/resource_manager.js`
- ❌ Removed `searchAnvisa`, `searchAnvisaByIngredient`, `fetchAnvisaBula` imports
- ❌ Removed `anvisa://search` resource
- ❌ Removed `anvisa://generics` resource
- ❌ Removed `anvisa://bula` resource
- ❌ Removed `searchLocalDrugs` function
- ✅ Updated header comment to reflect MongoDB-only

### 5. `lib/prompt_manager.js`
- ✅ Updated DATA SOURCE INFORMATION section
- ✅ Changed "No real-time ANVISA API calls" to "No external API calls or web scraping"

### 6. `lib/judges.js`
- ✅ Replaced "retrieved from ANVISA's API" with "retrieved from MongoDB database"
- ✅ Replaced "documentos ANVISA" with "documentos MongoDB"

### 7. `lib/llm_client.js`
- ✅ Added stop sequences to prevent repetition loops
- ✅ Added `frequency_penalty: 0.5` to reduce token repetition
- ✅ Added `presence_penalty: 0.3` to encourage new topics

### 8. `lib/planner.js`
- ✅ Added explicit rules to fetch ONLY ONE section for specific questions
- ✅ Added "Minimize tool calls" directive

### 9. `README.md`
- ❌ Removed ANVISA integration references
- ❌ Removed PDF Viewer feature
- ❌ Removed External API from Tech Stack
- ✅ Updated description to "MongoDB database"
- ✅ Updated Key Features section

### 10. `DEPLOYMENT.md`
- ❌ Removed WEBSHARE_PROXY_URL from required secrets
- ❌ Removed "Get Webshare Proxy" section
- ✅ Changed from "3 secrets" to "2 secrets"
- ✅ Updated Environment Variables table

---

## Architecture Changes

### Before (with scraping):
```
User Query → LLM Planner → Tools → MongoDB + ANVISA Scraper → LLM Response
                                              ↓
                                         Playwright + Webshare Proxy
                                              ↓
                                         ANVISA Website
```

### After (MongoDB only):
```
User Query → LLM Planner → Tools → MongoDB → LLM Response
```

---

## Benefits

✅ **Faster response times** - No web scraping overhead
✅ **More reliable** - No dependency on external website availability
✅ **Simpler deployment** - No proxy configuration needed
✅ **Lower costs** - No Webshare proxy subscription required
✅ **Cleaner codebase** - Removed ~800 lines of scraping code
✅ **Better performance** - Direct MongoDB queries only

---

## Remaining Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "cors": "^2.8.6",
    "dotenv": "^17.3.1",
    "express": "^4.21.2",
    "mongodb": "^6.21.0",
    "pdf-parse": "^1.1.1"
  }
}
```

Note: `pdf-parse` is kept for potential future PDF text extraction from MongoDB-stored PDFs.

---

## Required Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection |
| `PRIMARY_API_KEY` | ✅ | HuggingFace LLM API key |
| `FALLBACK_API_KEY` | ❌ | Backup LLM provider |
| `OPENAI_API_KEY` | ❌ | Alternative LLM provider |
| `ANTHROPIC_API_KEY` | ❌ | Alternative LLM provider |

---

## Migration Notes

If you were using the ANVISA scraping features:

1. **Data is now MongoDB-only** - All bula data must be pre-loaded into MongoDB
2. **No real-time updates** - Data freshness depends on MongoDB population
3. **No PDF URLs** - Removed PDF viewer functionality
4. **Faster queries** - All data is indexed and pre-processed

To populate MongoDB, use the data import scripts or manually insert bula documents with the following structure:

```javascript
{
  nome_medicamento: "Paracetamol",
  tipo: "bula",
  composicao: "Paracetamol 500mg",
  texto_completo: "...",
  secoes: {
    indicacao: "...",
    posologia: "...",
    contraindicacao: "...",
    reacoes: "...",
    advertencias: "..."
  },
  has_section: {
    indicacao: true,
    posologia: true,
    contraindicacao: true,
    reacoes: true,
    advertencias: true
  }
}
```

---

## Date
2026-03-14
