# Task: Rewrite Dissertation Sections to Match Actual Implementation

## Context

I have a dissertation (`"C:\Users\Paulo\Documents\amostra\pharmabula-vercel\a.tex"`) about my system **BulaIA** (formerly PharmaBula). The dissertation describes the architecture using MCP protocol concepts, but some sections don't accurately reflect how the code actually works.

## Your Goal

Read the implementation files listed below, compare them with the dissertation text, and **rewrite the sections that are incomplete or inaccurate**.

---

## Files to Read (Implementation)

Read these files FIRST to understand the actual architecture:

1. **`lib/planner.js`** - Shows the planner LLM that creates JSON execution plans (NOT direct MCP tool invocation by the main model)
2. **`api/chat.js`** - Shows the actual chat flow with PARALLEL tool execution via Promise.all()
3. **`lib/question_classifier.js`** - Shows topic detection via keyword matching + LLM fallback (runs BEFORE judges)
4. **`lib/prompt_manager.js`** - Shows local prompt templates with interpolation (NOT retrieved via MCP prompts/get)
5. **`lib/judges.js`** - Shows the 4 general judges + 3 topic-specific sub-judges with gate logic
6. **`api/evaluate.js`** - Shows judges are a SEPARATE endpoint (/api/evaluate), not integrated in chat flow
7. **`mcp_server.js`** - Shows MCP server exists but is for EXTERNAL clients, not internal chat flow
8. **`lib/tool_registry.js`** - Shows tool definitions and direct function call execution
9. **`lib/resource_manager.js`** - Shows resources accessed via function calls, not MCP protocol

---

## File to Read (Dissertation)

Read this to identify what needs correction:

- **`tcc-final/docs/my_tcc.tex`** - The full dissertation in LaTeX

---

## Key Discrepancies to Fix

### 1. Tool Invocation Flow (Section 5.3)

**What dissertation likely says:**
- Model directly invokes tools via MCP protocol in a sequential loop
- Model sees tool results and decides next step iteratively

**What code actually does:**
- A separate **planner LLM** analyzes the question and returns a JSON plan
- ALL tools from the plan are executed **in parallel** using `Promise.all()`
- Main model only sees results after all tools complete

**Fix:** Rewrite to describe the planner-based architecture with parallel execution

---

### 2. Topic Detection (Section 5.3 or 6.3)

**What dissertation likely says:**
- Topics are detected implicitly during judge execution

**What code actually does:**
- `question_classifier.js` runs BEFORE judges
- Uses **keyword matching first** (confidence ≥ 0.7)
- Falls back to LLM classification if keywords are uncertain
- Topics are passed to judges for routing sub-judges

**Fix:** Add description of hybrid keyword+LLM classification module

---

### 3. Prompt Management (Section 5.3)

**What dissertation likely says:**
- Prompts are retrieved via MCP `prompts/get` primitive
- Mode switching via prompt selection from server

**What code actually does:**
- Prompts are **embedded string templates** in `prompt_manager.js`
- Mode is passed as parameter to `getSystemPrompt(mode, vars)`
- Topic-aware extensions are interpolated into the prompt

**Fix:** Clarify that prompts are local templates, not MCP-retrieved

---

### 4. Judge Pipeline Integration (Section 6.3)

**What dissertation likely says:**
- Judges run as part of the chat flow before response delivery
- Safety gate blocks response if score < 70

**What code actually does:**
- Judges are a **separate API endpoint** (`/api/evaluate`)
- Chat returns response immediately with `metadata.evaluateUrl`
- Judges can be run independently for evaluation

**Fix:** Clarify that judges are decoupled from chat flow (separate endpoint)

---

### 5. MCP Server Role (Section 5.1)

**What dissertation likely says:**
- MCP server is the primary interface for all LLM-to-data communication

**What code actually does:**
- MCP server exists for **external MCP-compatible clients**
- Internal chat flow (`api/chat.js`) bypasses MCP protocol
- Uses direct function calls to `lib/planner.js`, `lib/tool_registry.js`

**Fix:** Clarify that MCP server is for external integration, internal flow uses direct calls

---

## Output Format

For each section that needs rewriting:

1. **Identify the section number** (e.g., Section 5.3, Section 6.1)
2. **Quote the problematic paragraph(s)** from the dissertation
3. **Explain what's wrong** (1-2 sentences)
4. **Provide the rewritten LaTeX text** ready to paste

Example:

```latex
% SECTION 5.3 - REWRITE THIS PARAGRAPH
% OLD: "O modelo invoca ferramentas MCP sequencialmente..."
% ISSUE: Describes sequential MCP tool invocation, but code uses parallel execution

% NEW TEXT:
O pipeline de consulta integra as primitivas do protocolo MCP em um pipeline de três fases:
(1) preparação do contexto via planner LLM, (2) execução paralela de ferramentas, e
(3) geração da resposta final. O Algoritmo~\ref{alg:mcp-query} descreve esse processo.
```

---

## Constraints

- Keep the dissertation in **Portuguese** (except abstract)
- Preserve all LaTeX formatting, citations, and references
- Do NOT change the core contributions — only clarify the architecture
- Keep tables and figures consistent with the new text
- Maintain the academic tone

---

## Deliverables

1. **List of all sections** that need changes (with line numbers if possible)
2. **Rewritten LaTeX text** for each section
3. **Updated Algorithm pseudocode** if the flow changed
4. **Suggestions for figure updates** (e.g., add "Planner LLM" box to architecture diagram)

---

## Start Now

1. Read all the implementation files listed above
2. Read the dissertation file
3. Identify all discrepancies
4. Provide rewritten sections with clear before/after comparisons

Begin by listing which sections need changes, then provide the rewrites one section at a time.
