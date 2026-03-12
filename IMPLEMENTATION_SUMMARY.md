# Implementation Summary - Judge System Improvements

## ✅ Completed Changes

### 1. Hierarchical Criteria Numbering (Academic Standard)

All 7 judges now use hierarchical numbering like scientific papers:

| Judge | Criteria IDs | Count |
|-------|--------------|-------|
| Safety | 1.1 - 1.5 | 5 criteria |
| Quality | 2.1 - 2.5 | 5 criteria |
| Source | 3.1 - 3.4 | 4 criteria |
| Format | 4.1 - 4.4 | 4 criteria |
| Posologia | 5.1 - 5.5 | 5 criteria |
| Contraindicacoes | 6.1 - 6.5 | 5 criteria |
| Reacoes Adversas | 7.1 - 7.5 | 5 criteria |

**Benefits:**
- Easy citation in TCC: "Critério 2.4 (grounding)..."
- Professional academic formatting
- Easier to expand (add 2.6, 2.7 without renumbering)

---

### 2. Generic Justification Placeholders

**Before:**
```json
"justificativas": {
  "2.5_clareza": "Modo paciente mas usa termo 'hepatotoxicidade' sem explicar..."
}
```

**After:**
```json
"justificativas": {
  "2.5_clareza": "[explain why this score]"
}
```

The LLM now fills in the actual justification dynamically instead of copying static examples.

---

### 3. Judgment Banner UI (from tcc-final)

Added visual banner showing evaluation results:

```
✅ Resposta Aprovada (Score: 85/100)
📊 Segurança: 100 | Qualidade: 80 | Fonte: 90 | Formato: 70
```

**States:**
- ✅ **Aprovada** (green) - score >= 80
- ⚠️ **Aprovada com Ressalvas** (yellow) - score 60-79
- 🟠 **Precisa de Revisão** (orange) - score 40-59
- ❌ **Rejeitada** (red) - score < 40

**Files Modified:**
- `public/index.html` - Added CSS styles and rendering logic

---

### 4. LLM-Based History Detection (No More Keyword Matching!)

**Before (Weak):**
```javascript
// Keyword matching with regex
const patterns = [/\bele\b|\bela\b|\bisso\b/i, ...];
if (pattern.test(question)) hasContextReference = true;
```

**After (LLM Flag):**
```javascript
// LLM returns needs_history flag in planning JSON
{
  "drugs": ["paracetamol"],
  "topics": ["reacoes_adversas"],
  "needs_history": true,  // ← LLM decides!
  "tools": [...]
}
```

**Benefits:**
- No fragile regex patterns
- Context-aware decision making
- Single LLM call (no separate `detectNeedsHistory` function)

**Files Modified:**
- `lib/planner.js` - Added `needs_history` to JSON schema, removed old function

---

### 5. Anti-Hallucination Grounding Rules

Added explicit rules to prevent LLM from inventing information:

```
## GROUNDING RULES — NON-NEGOTIABLE
- DO NOT mention side effects NOT in retrieved documents
- DO NOT add general medical knowledge — only use what the bula says
- NEVER list "what the bula doesn't mention" — only state what it DOES say
- Generic disclaimers like "consulte um profissional" are NOT drug-specific claims
```

**Judge Updates:**
- Quality judge `2.4_grounding`: "Generic disclaimers are NOT UNSUPPORTED claims"
- Quality judge `2.5_clareza`: "If term is explained in parentheses, it COUNTS as explained"
- Format judge: "VERIFY formatting before penalizing (don't hallucinate structure)"

---

### 6. Fair Topic Judge Evaluation

All topic judges now include:

```
IMPORTANT: Check EXPECTED_TOPICS but DO NOT penalize if bula doesn't contain info.
Only evaluate based on what the bula ACTUALLY contains.

If bula doesn't mention [topic], this point is N/A (don't penalize)
```

**Output includes:**
```json
{
  "questions_answered": ["efeitos_graves"],
  "questions_missing": ["efeitos_comuns"],
  "questions_not_in_bula": ["efeitos_comuns", "sonolencia_dirigir"],
  "coverage_score": 20,
  "critical_omission": false
}
```

---

## 📁 Files Modified

| File | Changes |
|------|---------|
| `lib/judges.js` | Hierarchical numbering, generic placeholders, fair evaluation rules |
| `lib/planner.js` | LLM-based `needs_history` flag, removed keyword matching |
| `lib/prompt_manager.js` | Stricter grounding, no redundant disclaimers |
| `public/index.html` | Judgment banner UI, fallback notification |
| `api/chat.js` | `usedFallback` flag in metadata |

---

## 🧪 Testing

### Test Hierarchical Numbering:
```bash
npm run dev
# Ask: "Quais são os efeitos colaterais do paracetamol?"
# Check console for judge output with 1.1, 2.4, etc.
```

### Test History Detection:
```javascript
// Should trigger needs_history=true
"Ele funciona para dor de cabeça?"  // pronoun "ele"
"Continuar tomando se passar mal?"  // context-dependent

// Should trigger needs_history=false
"Quais são os efeitos do paracetamol?"  // standalone
```

### Test Judgment Banner:
- Banner appears at top of response
- Color changes based on score (green/yellow/orange/red)
- Shows breakdown: Segurança | Qualidade | Fonte | Formato

---

## 🎯 Expected Results

### Before:
```
grounding: 0/10 ❌ (flagged generic disclaimer)
clareza: 0/10 ❌ (claimed term not explained when it was)
apropriacao: 0/10 ❌ (claimed "3 headers" when none existed)
```

### After:
```
grounding: 10/10 ✅ (generic disclaimers ignored)
clareza: 10/10 ✅ (parenthetical explanations count)
apropriacao: 8/10 ✅ (verified actual formatting)
```

---

## 📚 For Your TCC

You can now cite specific criteria:

> "O critério **2.4 (grounding)** avalia se todas as afirmações específicas sobre o medicamento são rastreáveis aos documentos recuperados. Afirmações genéricas como 'consulte um profissional' não são penalizadas, pois não são claims específicos do medicamento."

> "O critério **7.2 (efeitos_graves)** verifica se a resposta menciona efeitos colaterais graves que exigem interrupção do uso. Se a bula não menciona efeitos graves, o critério é marcado como 'not_in_bula' e não penaliza a pontuação."

---

## 🚀 Next Steps (Optional)

1. **Synchronous Evaluation** - Run judges in `/api/chat` for immediate banner display
2. **Criteria Weighting** - Some criteria more important than others (e.g., safety > format)
3. **Explanation Improvements** - Show users WHY a response was flagged
4. **Appeal Mechanism** - Let users request re-evaluation if they disagree

---

**Author:** Paulo - PharmaBula AI Project  
**Date:** March 2026
