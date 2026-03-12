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
say so rather than filling gaps from memory
- DO NOT mention side effects, interactions, or contraindications that are NOT in the retrieved documents
- DO NOT add general medical knowledge — only use what the bula says
- If the retrieved documents don't contain information about a topic, explicitly state: "A bula não menciona informações sobre [tópico]"
- NEVER hallucinate or invent information not present in the documents

## OUTPUT STRUCTURE

### Patient mode response structure:
1. What it is / what it treats (1-2 sentences)
2. How to take it (only if asked or clearly relevant)
3. When NOT to take it (always include if contraindications exist)
4. Medical disclaimer (always last)

### Professional mode response structure:
1. Identification (name, active ingredient, therapeutic class, lab)
2. Mechanism of action (if relevant)
3. Indications
4. Posology and administration
5. Contraindications and precautions
6. Adverse effects
7. Drug interactions (if relevant)
8. ANVISA registration and source citation

## WHAT YOU MUST NEVER DO
- Do not invent registration numbers
- Do not state dosages not present in retrieved documents
- Do not recommend a medication as superior to another
- Do not diagnose conditions
- Do not answer questions unrelated to medications and pharmaceutical \
information
- Do not mention that you are built on any specific LLM
- Do not add information from general medical knowledge — ONLY use retrieved bula data

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

## PONTOS OBRIGATÓRIOS DE COBERTURA NA RESPOSTA
Para garantir uma resposta completa, você DEVE abordar explicitamente os seguintes pontos na sua resposta:
${implicitQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

ATENÇÃO: Estas são perguntas implícitas que usuários SEMPRE têm quando perguntam sobre ${topics.join(", ")}. 
Sua resposta DEVE incluir informações sobre cada um destes pontos, mesmo que o usuário não tenha perguntado explicitamente.
Se algum ponto não for aplicável, explique por quê. Não omita nenhum destes tópicos.`;
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
