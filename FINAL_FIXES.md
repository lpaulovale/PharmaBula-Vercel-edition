# Final Fixes - Remove Planner Explanation from Response

## Problem
The final response was showing the planner's reasoning like:
> "Para responder à sua pergunta, vou usar o get_section com a seção 'reacoes'..."

This should NOT be shown to users.

## Root Cause
The `api/chat.js` was using `getSystemPrompt("planner", ...)` for the **final response generation**, but this prompt is designed for the **planner LLM** (which decides which tools to call), not for the **response generator LLM** (which generates the final answer).

## Solution

### 1. Created New Prompt: `getResponsePrompt()`
**File:** `lib/prompt_manager.js`

A separate prompt specifically for final response generation with explicit rules:
- **NUNCA explique seu raciocínio**
- **NUNCA mencione ferramentas**
- **Responda diretamente**
- **Use apenas os dados recuperados**

### 2. Updated api/chat.js
**Line 20:** Import the new prompt
```javascript
const { getSystemPrompt, buildContextPrompt, getNoDataPrompt, getResponsePrompt } = require("../lib/prompt_manager");
```

**Line 149:** Use response prompt instead of planner prompt
```javascript
// Before:
const systemPrompt = getSystemPrompt("planner", { mode, ... });

// After:
const systemPrompt = getResponsePrompt(mode, { ... });
```

### 3. Enhanced Planner Prompt
Also added explicit rules to the planner prompt to reduce reasoning output:
- "CRITICAL: Do NOT explain your reasoning or tool selection"
- "Do NOT say 'vou usar', 'vou chamar', 'preciso buscar'"

## Files Modified

| File | Change |
|------|--------|
| `lib/prompt_manager.js` | Added `getResponsePrompt()` function + enhanced planner rules |
| `api/chat.js` | Use `getResponsePrompt()` for final response generation |

## Expected Behavior After Fix

### Before (WRONG):
```
Para responder à sua pergunta, vou usar o get_section com a seção "reacoes" da bula do paracetamol.

A bula do paracetamol menciona as seguintes reações adversas:
- Reações raras: hepatotoxicidade, anafilaxia...
```

### After (CORRECT):
```
O paracetamol pode causar as seguintes reações adversas:

**Reações raras:**
- Hepatotoxicidade
- Anafilaxia
- Reações alérgicas graves
- Agranulocitose

Se aparecerem sinais de reação alérgica, suspenda o uso e procure atendimento médico.
```

## Testing

After deploying to Vercel, test with:
```
"Quais são os efeitos colaterais do paracetamol?"
```

Expected: Direct answer without mentioning tools or process.
