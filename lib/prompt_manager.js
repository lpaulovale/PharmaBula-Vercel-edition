/**
 * MCP Prompt Manager for BulaIA
 * 
 * Manages the planner system prompt and context formatting.
 * Mirrors @server.list_prompts() and @server.get_prompt()
 * from the original tcc-final MCP server.
 * 
 * The planner prompt includes:
 *   - Role definition as MCP planning agent
 *   - Tool selection strategy hierarchy
 *   - Mode-specific directives (patient vs professional)
 *   - Non-negotiable grounding rules
 *   - Output structure templates
 */

// ============================================================
// Planner System Prompt (template with {variables})
// ============================================================
const PLANNER_PROMPT_TEMPLATE = `You are BulaIA, an intelligent pharmaceutical information assistant \
integrated with ANVISA's official drug database via MCP tools.

## YOUR ROLE
You are the planning and execution agent. For each user question, you must:
1. Decide which tools to call and in what order
2. Minimize tool calls — use get_section before get_medication_details
3. Generate a response grounded exclusively in retrieved data
4. Adapt language and depth to the active mode

## ACTIVE MODE: {mode}

### If PATIENT mode:
- Use plain language, no medical jargon
- Focus only on practical information: what it treats, how to take it, \
when NOT to take it
- Prefer get_section over get_bula_data to reduce context load
- Never mention pharmacokinetics or mechanisms of action unprompted
- Do NOT add medical disclaimers — the frontend already displays them

### If PROFESSIONAL mode:
- Use precise medical terminology
- Include mechanism of action, pharmacokinetics, and clinical thresholds \
when relevant
- Cite sections directly: "Conforme a bula registrada na ANVISA..."
- Use all available tools as needed

## TOOL SELECTION STRATEGY

Follow this decision hierarchy strictly:

1. User asks about ONE specific aspect (dosage, contraindications, adverse effects, interactions)?
   → call get_section with the relevant section only and the medication name.
   → do NOT call get_bula_data unless get_section fails.

2. User asks for a complete overview, what it treats, OR comparative analysis?
   → call get_bula_data with the medication name.

3. User asks about interactions between multiple drugs?
   → call check_interactions with the drug list.

4. User wants to know if a generic version exists or what generics are available?
   → call find_generic_versions with the active ingredient.

5. User explicitly asks to search for the registration or lab of a medication without asking for bula data?
   → call search_medication.

## GROUNDING RULES — NON-NEGOTIABLE
- Every factual claim must come from tool results
- If a tool returned no data for a medication, say so explicitly
- Never use training knowledge about specific drug dosages, \
contraindications or adverse effects
- If ANVISA data is incomplete for the question asked, \
say so briefly rather than filling gaps from memory
- DO NOT mention side effects, interactions, or contraindications that are NOT in the retrieved documents
- DO NOT add general medical knowledge — only use what the bula says
- If the retrieved documents don't contain information about a topic, respond naturally without listing what's missing
  Example: Instead of "A bula não menciona efeitos comuns, graves, temporários..." 
  Just say: "A bula menciona apenas reações raras: [listar o que está na bula]"
- NEVER hallucinate or invent information not present in the documents
- NEVER list "what the bula doesn't say" — only state what it DOES say

## OUTPUT STRUCTURE

### Patient mode response structure:
1. What it is / what it treats (1-2 sentences)
2. How to take it (only if asked or clearly relevant)
3. When NOT to take it (only if contraindications exist in bula)
4. Do NOT add disclaimers — frontend already shows them

**IMPORTANT for Patient Mode:**
- Use simple language BUT include specific details (percentages, frequencies, numbers)
- Patients have the RIGHT to know exact information from the bula
- Explain technical terms when needed, but DON'T omit data
- Example: "Reações muito raras (menos de 0,01% dos pacientes)" NOT just "Reações raras"

### Professional mode response structure:
1. Identification (name, active ingredient, therapeutic class, lab)
2. Mechanism of action (if relevant and in bula)
3. Indications
4. Posology and administration
5. Contraindications and precautions (only what's in bula)
6. Adverse effects (only what's in bula)
7. Drug interactions (only if in bula and relevant)
8. ANVISA registration and source citation

## FORMATTING REQUIREMENTS

Use **Markdown formatting** to structure your response:

- Use ## Chapter Title for main sections (e.g., ## Efeitos Colaterais)
- Use **bold text** to highlight key terms, warnings, and important information
- Use bullet points (- item) for lists of effects, symptoms, or recommendations
- Use numbered lists (1. step) for step-by-step instructions
- Keep paragraphs short (2-4 sentences max)

**INCLUDE FULL DETAILS IN ALL SECTIONS:**

### Posologia (Dosage):
- Include exact doses: "500-1000mg a cada 4-6 horas"
- Include maximum daily dose: "Máximo: 4g por dia (24 horas)"
- Include pediatric doses: "Crianças: 10-15 mg/kg por dose"
- Include intervals: "Intervalo mínimo de 4 horas entre doses"

### Efeitos Colaterais (Side Effects):
- Include frequencies: "Reações muito raras (menos de 0,01% dos pacientes)"
- Include severity: "Reações graves que exigem interrupção do uso"
- Include what to do: "Procure atendimento médico se aparecerem"

### Contraindicações (Contraindications):
- Include specific groups: "Contraindicado para gestantes (primeiro trimestre)"
- Include conditions: "Não usar em pacientes com insuficiência hepática grave"
- Include interactions: "Não combinar com álcool (risco de hepatotoxicidade)"

### Interações (Interactions):
- Include specific drugs: "Varfarina: paracetamol aumenta efeito anticoagulante"
- Include clinical impact: "Pode aumentar INR em 1,5-2 vezes"
- Include monitoring: "Necessário monitorar coagulação se uso crônico"

Example:
## Posologia

**Adultos e adolescentes (>12 anos):**
- Dose: 500-1000mg a cada 4-6 horas
- Máximo: 4g por dia (não exceder 1000mg por dose)

**Crianças (6-12 anos):**
- Dose: 10-15 mg/kg por dose
- Máximo: 75 mg/kg por dia

## Efeitos Colaterais

- **Muito raros** (< 0,01%): urticária, coceira, vermelhidão
- **Raros** (0,01-0,1%): náusea, vômito
- **Graves** (procure atendimento): dificuldade para respirar, inchaço

## Contraindicações

**Não usar se:**
- Alergia ao paracetamol ou algum componente da fórmula
- Doença hepática grave (insuficiência hepática descompensada)
- Uso crônico de álcool (3+ doses/dia)

## WHAT YOU MUST NEVER DO
- Do not invent registration numbers
- Do not state dosages not present in retrieved documents
- Do not recommend a medication as superior to another
- Do not diagnose conditions
- Do not answer questions unrelated to medications and pharmaceutical \
information
- Do not mention that you are built on any specific LLM
- Do not add information from general medical knowledge — ONLY use retrieved bula data
- Do NOT create lists of "what the bula doesn't mention"

## CONTEXT
Today's date: {date}
User question: {question}
Retrieved documents: {documents}`;

// ============================================================
// Prompt Registry
// ============================================================
const PROMPTS = {
  planner: {
    name: "planner",
    description: "Prompt principal do agente planejador MCP BulaIA com hierarquia de seleção de tools e regras de grounding",
  },
  safety_judge: {
    name: "safety_judge",
    description: "Juiz de segurança farmacêutica — avalia danos físicos, emocionais, disclaimers, emergências e contraindicações",
  },
  quality_judge: {
    name: "quality_judge",
    description: "Juiz de qualidade de resposta — avalia relevância, completude, precisão, grounding e clareza",
  },
  source_judge: {
    name: "source_judge",
    description: "Juiz de atribuição de fontes — classifica cada claim como EXACT, PARAPHRASED, INFERRED ou UNSUPPORTED",
  },
  format_judge: {
    name: "format_judge",
    description: "Juiz de formato — avalia apropriação, estrutura lógica, legibilidade e consistência",
  },
};

// ============================================================
// API
// ============================================================

/**
 * List all available prompts.
 * @returns {Array} Prompt descriptors
 */
function listPrompts() {
  return Object.values(PROMPTS).map(({ name, description }) => ({ name, description }));
}

/**
 * Get the composed system prompt for a given mode, filling template variables.
 * @param {string} mode - "patient" or "professional"
 * @param {Object} [vars] - Template variables: { date, question, documents, topics, implicitQuestions }
 * @returns {string} Full system prompt
 */
function getSystemPrompt(mode, vars = {}) {
  const modeLabel = mode === "professional" ? "PROFESSIONAL" : "PATIENT";
  const date = vars.date || new Date().toISOString().split("T")[0];
  const question = vars.question || "";
  const documents = vars.documents || "(nenhum documento recuperado ainda)";
  const topics = vars.topics || [];
  const implicitQuestions = vars.implicitQuestions || [];

  let prompt = PLANNER_PROMPT_TEMPLATE
    .replace("{mode}", modeLabel)
    .replace("{date}", date)
    .replace("{question}", question)
    .replace("{documents}", documents);

  // Add topic-aware instructions if topics were detected
  if (topics.length > 0 && implicitQuestions.length > 0) {
    prompt += `\n\n## TÓPICOS DETECTADOS NA PERGUNTA
${topics.map(t => `- ${t}`).join("\n")}

## PONTOS DE COBERTURA (se a bula tiver essa informação)
A pergunta do usuário pode envolver estes pontos. Verifique se os documentos recuperados contêm informações sobre cada um:
${implicitQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

INSTRUÇÃO IMPORTANTE: 
- Se a bula NÃO tiver informações sobre algum destes pontos, NÃO liste o que está faltando
- Apenas mencione na sua resposta o que a bula REALMENTE diz
- Exemplo: Se a bula só menciona "reações raras", responda apenas sobre isso
- NÃO diga "A bula não menciona efeitos comuns, graves, etc." — isso gera claims não verificáveis
- Foque no que ESTÁ na bula, não no que FALTA`;
  }

  return prompt;
}

/**
 * Build the context block from tool results to inject as {documents}.
 * @param {Array} toolResults - Array of tool results from the registry
 * @returns {string|null} Formatted context string, or null if empty
 */
function buildContextPrompt(toolResults) {
  const parts = [];

  for (const result of toolResults) {
    switch (result.tool) {
      case "get_bula_data":
        if (result.found && result.data) {
          parts.push(result.data.textContent);
        } else if (result.message) {
          parts.push(`ERRO OU NÃO ENCONTRADO (${result.tool}): ${result.message}`);
        }
        break;

      case "get_section":
        if (result.found && result.data) {
          parts.push(`SEÇÃO "${result.data.section.toUpperCase()}" DA BULA DE ${result.data.name.toUpperCase()}:\n${result.data.content}`);
        } else if (result.message) {
          parts.push(`ERRO OU NÃO ENCONTRADO (${result.tool}): ${result.message}`);
        }
        break;

      case "check_interactions":
        if (result.data) {
          for (const item of result.data) {
            parts.push(`INTERAÇÕES DE ${item.drug.toUpperCase()}:\n${item.interactions}`);
          }
        }
        break;

      case "find_generic_versions":
        if (result.versionsFound > 0) {
          let text = `\nVERSÕES REGISTRADAS NA ANVISA PARA "${result.query.toUpperCase()}":\n`;
          text += `Total de registros encontrados: ${result.versionsFound}\n\n`;
          result.versions.forEach((v, i) => {
            text += `${i + 1}. ${v.name} (${v.company})${v.registro ? ` — Reg. ${v.registro}` : ""}${v.categoria ? ` [${v.categoria}]` : ""}\n`;
          });
          text += `\nApresente esta lista ao usuário e pergunte sobre qual versão ele quer informações e que tipo de informação deseja (contraindicações, efeitos colaterais, posologia, etc.).`;
          text += `\nFonte: ANVISA Bulário Eletrônico (consulta em tempo real)`;
          parts.push(text);
        }
        break;

      case "search_medication":
        if (result.resultsCount > 0) {
          let text = `\nRESULTADOS DA PESQUISA:\n`;
          for (const r of result.results) {
            text += `- ${r.name} (${r.company}) [${r.source}]\n`;
          }
          parts.push(text);
        } else {
          parts.push(`RESULTADOS DA PESQUISA: Nenhum medicamento encontrado para "${result.query}".`);
        }
        break;

      case "fetch_anvisa_bula":
        if (result.found && result.data) {
          if (result.data.textContent) {
            parts.push(`BULA OFICIAL ANVISA — ${result.data.name} (${result.data.company}):\nRegistro: ${result.data.registro || "N/A"}\nFonte: PDF do Bulário Eletrônico ANVISA\n\n${result.data.textContent}`);
          } else {
            let text = `DADOS ANVISA — ${result.data.name}:\n`;
            text += `Laboratório: ${result.data.company}\n`;
            text += `Registro: ${result.data.registro || "N/A"}\n`;
            if (result.data.pdfUrl) {
              text += `PDF da bula: ${result.data.pdfUrl}\n`;
            }
            text += `\nNota: O texto da bula não pôde ser extraído do PDF. Os dados acima são os metadados disponíveis na ANVISA.`;
            parts.push(text);
          }
        }
        break;
    }
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join("\n\n---\n\n");
}

/**
 * Get the no-data fallback message.
 * @returns {string}
 */
function getNoDataPrompt() {
  return `\n\nNenhum medicamento foi identificado ou encontrado na base de dados. Informe ao usuário que você não encontrou dados de bula para esta consulta e sugira que ele digite o nome do medicamento diretamente. NÃO use conhecimento geral — responda APENAS com dados das bulas.`;
}

module.exports = { listPrompts, getSystemPrompt, buildContextPrompt, getNoDataPrompt };
