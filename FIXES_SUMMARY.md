# Fixes Summary - BulaIA MongoDB Migration

## Critical Bug Fixes

### 1. `getSystemPrompt` Call Signature (FIXED ✓)

**Problem:** Multiple files were calling `getSystemPrompt(mode, {...})` but the function signature is `getSystemPrompt(name, variables)`.

**Files Fixed:**
- `lib/planner.js` line 36
- `api/chat.js` line 149

**Before:**
```javascript
const prompt = getSystemPrompt(mode, { date, question, documents })
```

**After:**
```javascript
const prompt = getSystemPrompt("planner", { mode, date, question, documents })
```

### 2. Removed Redundant Tools (FIXED ✓)

**Removed:**
- `get_contraindicacoes` → Use `get_section("contraindicacao")`
- `get_posologia` → Use `get_section("posologia")`
- `get_indicacao` → Use `get_section("indicacao")`

**Remaining 6 tools:**
1. `search_medication`
2. `get_bula_data`
3. `get_section`
4. `search_by_ingredient`
5. `search_text`
6. `check_interactions`

### 3. Updated Planner Tool List (FIXED ✓)

**File:** `lib/planner.js` line 55

**Before:**
```
Available tools: get_bula_data, get_section, check_interactions, find_generic_versions, search_medication
```

**After:**
```
Available tools: search_medication, get_bula_data, get_section, search_by_ingredient, search_text, check_interactions
```

### 4. Updated Prompt Manager (FIXED ✓)

**File:** `lib/prompt_manager.js`

- Updated tool selection strategy for 6 tools
- Added section mapping table
- Updated `buildContextPrompt` for new tool results
- Removed references to PDF download tools

## Files Modified

| File | Status | Changes |
|------|--------|---------|
| `lib/mongodb_tools.js` | ✓ New | MongoDB connection and queries |
| `lib/tool_registry.js` | ✓ Updated | 6 tools (removed 3 redundant) |
| `lib/prompt_manager.js` | ✓ Updated | 6 tools + section mapping |
| `lib/planner.js` | ✓ Fixed | getSystemPrompt call + tool list |
| `api/chat.js` | ✓ Fixed | getSystemPrompt call |
| `test-mongodb.js` | ✓ New | MongoDB test script |

## Testing

```bash
# Test MongoDB connection
node test-mongodb.js

# Expected output:
# ✓ All tests completed
# - search_medication works
# - get_bula_data works
# - get_section works (with fallback)
```

## Deployment Checklist

- [ ] Change MongoDB password (exposed in chat)
- [ ] Update Vercel env var `MONGODB_URI` with new password
- [ ] Update Vercel env var `PRIMARY_API_KEY` (for LLM)
- [ ] Deploy: `vercel --prod`
- [ ] Test in production with a simple query

## Frontend Mode Selector

The frontend already has the patient/professional mode selector working correctly:
- Sends `mode: "patient"` or `mode: "professional"` to API
- UI shows "Paciente" / "Profissional" options
- No changes needed on frontend

## Error That Was Happening

```
Error: Unknown prompt: patient
    at getSystemPrompt (/var/task/lib/prompt_manager.js:130:11)
```

**Root cause:** `getSystemPrompt("patient")` was being called but the function expects `getSystemPrompt("planner", { mode: "patient" })`.

**Fixed:** Updated both `lib/planner.js` and `api/chat.js` to use correct signature.
