# Bug Report: PDF URL Not Being Passed to Frontend

## Problem Summary

The backend successfully:
1. ✅ Calls ANVISA API
2. ✅ Downloads PDF
3. ✅ Extracts text for LLM context
4. ✅ Generates response with LLM

But **FAILS** to:
- ❌ Pass `pdfUrl` to frontend (always `null`)

## Console Output

Frontend receives:
```json
{
  "sources": [
    {
      "name": "Paracetamol 500mg",
      "displayName": "Bula Paracetamol 500mg - ANVISA (efeitos colaterais)",
      "pdfUrl": null  // ← THIS IS THE BUG
    }
  ]
}
```

## Code Flow

### 1. Backend Gets PDF from ANVISA (`lib/anvisa.js`)

```javascript
// Line ~121 in getBulaDetails()
const data = await res.json();
return {
  // ... other fields
  pdfUrl: data.urlBula || null  // ← data.urlBula is NULL from ANVISA
};
```

**Problem:** ANVISA API response doesn't include `urlBula` field anymore.

### 2. Tool Returns PDF URL (`lib/tool_registry.js`)

```javascript
// Line ~164 in get_section handler
return {
  tool: "get_section",
  pdfUrl: anvisa.data.pdfUrl,  // ← This is null from step 1
  data: { ... }
};
```

### 3. API Sends to Frontend (`api/chat.js`)

```javascript
// Line ~190-195
sources.push({
  name: r.data.name,
  pdfUrl: r.data.pdfUrl || null  // ← Still null
});
```

### 4. Frontend Receives Null (`public/index.html`)

```javascript
console.log('[DEBUG] Sources received:', sources);
// Shows: pdfUrl: null
```

## Attempted Fix (May Not Work)

In `lib/anvisa.js` line ~117, tried to construct URL from product ID:

```javascript
const pdfUrl = data.urlBula || 
  `https://consultas.anvisa.gov.br/api/consulta/bulario/${productId}/bula`;
```

**Issue:** Not sure if this URL format is correct for ANVISA API.

## What Needs to Be Fixed

1. **Find the correct ANVISA PDF URL format**
   - Does ANVISA still return `urlBula` in API response?
   - If not, what's the correct URL pattern?
   - Example: `https://consultas.anvisa.gov.br/api/.../{id}/bula.pdf`?

2. **Ensure `pdfUrl` flows through entire chain:**
   ```
   ANVISA API → getBulaDetails() → fetchAnvisaBula() 
   → get_section tool → chat.js API → Frontend
   ```

3. **Frontend should receive:**
   ```json
   {
     "sources": [{
       "name": "Paracetamol 500mg",
       "pdfUrl": "https://consultas.anvisa.gov.br/.../bula.pdf"  // ← Real URL
     }]
   }
   ```

## Files Involved

| File | Line | Issue |
|------|------|-------|
| `lib/anvisa.js` | ~121 | `data.urlBula` is null from ANVISA |
| `lib/tool_registry.js` | ~164 | Passes null pdfUrl |
| `api/chat.js` | ~190-195 | Sends null to frontend |
| `public/index.html` | ~1005+ | Receives null, can't make clickable link |

## Debug Logs Added

Check Vercel/server logs for:
```
[ANVISA] getBulaDetails: { 
  id: "12345", 
  name: "Paracetamol",
  hasUrlBula: false,  // ← Check this
  pdfUrl: "..."       // ← Check if constructed URL works
}
```

## Expected Behavior

1. User asks: "Quais são os efeitos colaterais do paracetamol?"
2. Backend fetches from ANVISA, gets PDF URL
3. Frontend receives `pdfUrl: "https://..."`
4. Source shows as clickable link: `[📄 Paracetamol]`
5. Click → Opens ANVISA PDF in new tab

## Actual Behavior

1. User asks question
2. Backend fetches from ANVISA but `pdfUrl` is null
3. Frontend receives `pdfUrl: null`
4. Source shows but NOT clickable (or links to search)
5. No PDF opens

## Request

Please fix the PDF URL extraction from ANVISA API so frontend receives actual PDF URLs instead of null.
