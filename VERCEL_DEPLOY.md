# Vercel Deployment Guide - BulaIA MongoDB Edition

## Quick Deploy

### 1. Set MongoDB Environment Variable

**Option A: Vercel Dashboard**
1. Go to your project on Vercel
2. Settings → Environment Variables
3. Add `MONGODB_URI` with your connection string:
   ```
   mongodb+srv://p:YOUR_PASSWORD@cluster0.vecl95h.mongodb.net/?appName=Cluster0
   ```

**Option B: Vercel CLI**
```bash
vercel env add MONGODB_URI
# Paste your MongoDB connection string
vercel --prod
```

### 2. Deploy
```bash
cd /mnt/c/Users/Paulo/Documents/amostra/pharmabula-vercel
vercel --prod
```

## What Changed

### MongoDB Integration
- **1,526 bulas** pre-processed with extracted sections
- **No PDF downloads** - instant section access
- **94%+ coverage** for contraindications, posology, indications

### Tools (6 total)
1. `search_medication` - Find by name
2. `get_bula_data` - Full bula content
3. `get_section` - Specific section (contraindications, dosage, etc.)
4. `search_by_ingredient` - Find by active ingredient
5. `search_text` - Full-text search
6. `check_interactions` - Drug interactions

### Files Modified
- `lib/mongodb_tools.js` - New MongoDB layer
- `lib/tool_registry.js` - Uses MongoDB (removed redundant tools)
- `lib/prompt_manager.js` - Updated for 6 tools
- `lib/planner.js` - Fixed prompt call signature

## Environment Variables Required

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` |
| `PRIMARY_API_KEY` | LLM API key (HuggingFace/OpenAI) | `hf_xxx` |
| `PRIMARY_MODEL` | LLM model for planning | `meta-llama/Llama-3.1-8B-Instruct:cerebras` |

## Testing Locally

```bash
# Install dependencies
npm install

# Set environment
export MONGODB_URI="mongodb+srv://..."

# Test MongoDB connection
node test-mongodb.js

# Run dev server
npm run dev
```

## MongoDB Data

- **Database**: `bulas`
- **Collection**: `documentos`
- **Documents**: 1,564 (1,526 bulas + 38 artigos)
- **Indexes**: `nome_medicamento`, `tipo`, text index on content

## Section Coverage

| Section | Coverage |
|---------|----------|
| posologia | 98% |
| indicacao | 97.8% |
| contraindicacao | 94.4% |
| reacoes | 91.6% |
| advertencias | 91.9% |

## Troubleshooting

### "Unknown prompt: patient" Error
Fixed in `lib/planner.js` - the call was `getSystemPrompt(mode)` but should be `getSystemPrompt("planner", { mode })`.

### MongoDB Connection Fails
1. Check your connection string has correct password
2. Ensure IP is whitelisted in MongoDB Atlas (use 0.0.0.0/0 for Vercel)
3. Verify database name is `bulas`

### No Sections Found
Some bulas don't have all sections. The system falls back to full-text search automatically. Check `has_section` flags in the data.
