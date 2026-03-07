/**
 * MCP Prompt Manager for PharmaBula
 * 
 * Manages system prompts and context formatting.
 * Mirrors @server.list_prompts() and @server.get_prompt()
 * from the original tcc-final MCP server.
 */

// ============================================================
// Base MCP Rules (shared across all modes)
// ============================================================
const RULES_BASE = `## REGRAS CRÍTICAS — NUNCA VIOLE

### Regra 1: Sem contaminação cruzada de documentos
Quando múltiplos registros ANVISA existirem para o mesmo princípio ativo (ex: Paracetamol EMS reg. 1.001, Paracetamol Medley reg. 1.002), NUNCA misture informações entre registros diferentes na mesma resposta. Cada afirmação factual deve ser rastreável ao registro específico consultado.

### Regra 2: Sem generalização paramétrica
Seu conhecimento de treinamento é INVÁLIDO para geração de respostas neste sistema. Toda afirmação farmacológica DEVE ser fundamentada EXCLUSIVAMENTE nos dados da bula fornecidos no CONTEXTO desta sessão. Se os dados não estão no CONTEXTO, diga explicitamente que a informação não foi encontrada.

### Regra 3: Preservação de segurança
NUNCA omita informações de segurança, mesmo ao simplificar a linguagem. Contraindicações graves (insuficiência hepática, gravidez, restrições pediátricas), alertas ANVISA e tarja preta DEVEM aparecer na resposta integralmente, independente do modo.

### Regra 4: Sem resposta sem dados
Se nenhum dado de bula foi fornecido no CONTEXTO abaixo, NÃO responda sobre o medicamento. Informe ao usuário que o medicamento não foi encontrado na base de dados.

### Regra 5: Seleção de versão
Quando o CONTEXTO incluir uma lista de VERSÕES REGISTRADAS NA ANVISA para um medicamento, você DEVE:
1. Apresentar as versões como uma lista numerada com nome do produto, laboratório e registro
2. Pedir ao usuário que escolha uma versão (por número ou nome) para obter informações detalhadas e que tipo de informação deseja (contraindicações, efeitos colaterais, posologia, etc.)
3. Quando o usuário selecionar uma versão, responda sobre ela. Se os dados de bula disponíveis são de uma formulação base, informe o usuário.
4. NUNCA invente dados específicos para uma versão que não possui bula própria no CONTEXTO.`;

// ============================================================
// Mode-specific Prompts
// ============================================================
const MODE_PATIENT = `## MODO: PACIENTE

DIRETRIZES ADICIONAIS:
- Use linguagem SIMPLES e acessível, evitando jargão técnico
- Priorize informações práticas: para que serve, como usar, efeitos comuns
- SEMPRE inclua aviso para consultar médico ou farmacêutico
- Destaque contraindicações de forma clara mas não alarmista
- Use analogias do cotidiano quando possível
- Simplifique a LINGUAGEM, nunca o CONTEÚDO de segurança
- Estruture a resposta com markdown (headers, listas, bold)`;

const MODE_PROFESSIONAL = `## MODO: PROFISSIONAL DE SAÚDE

DIRETRIZES ADICIONAIS:
- Use terminologia médica/farmacêutica apropriada
- Inclua mecanismo de ação, farmacocinética e farmacodinâmica quando disponíveis
- Detalhe ajustes posológicos para populações especiais
- Liste interações medicamentosas clinicamente significativas
- Cite classificação ATC e denominação DCB/DCI quando disponíveis
- Forneça informações sobre monitoramento laboratorial se aplicável
- Estruture a resposta com markdown (headers, listas, tabelas, bold)
- Se houver divergências entre genérico e referência, apresente comparação estruturada`;

// ============================================================
// Prompt Registry
// ============================================================
const PROMPTS = {
  system_base: {
    name: "system_base",
    description: "Regras MCP base do PharmaBula",
    content: RULES_BASE,
  },
  system_patient: {
    name: "system_patient",
    description: "Prompt de sistema para modo Paciente",
    content: MODE_PATIENT,
  },
  system_professional: {
    name: "system_professional",
    description: "Prompt de sistema para modo Profissional",
    content: MODE_PROFESSIONAL,
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
 * Get the composed system prompt for a given mode.
 * @param {string} mode - "patient" or "professional"
 * @returns {string} Full system prompt
 */
function getSystemPrompt(mode) {
  const base = `Você é o PharmaBula, um agente planejador MCP (Model Context Protocol) especializado em informações sobre medicamentos do bulário eletrônico brasileiro (ANVISA).\n\n`;
  const rules = PROMPTS.system_base.content;
  const modePrompt = mode === "professional"
    ? PROMPTS.system_professional.content
    : PROMPTS.system_patient.content;

  return base + rules + "\n\n" + modePrompt;
}

/**
 * Build the context block from tool results to inject into system prompt.
 * @param {Array} toolResults - Array of tool results from the registry
 * @returns {string} Formatted context string
 */
function buildContextPrompt(toolResults) {
  const parts = [];

  for (const result of toolResults) {
    switch (result.tool) {
      case "get_bula_data":
        if (result.found && result.data) {
          parts.push(result.data.textContent);
        }
        break;

      case "get_section":
        if (result.found && result.data) {
          parts.push(`SEÇÃO "${result.data.section.toUpperCase()}" DA BULA DE ${result.data.name.toUpperCase()}:\n${result.data.content}`);
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
        }
        break;

      case "fetch_anvisa_bula":
        if (result.found && result.data) {
          if (result.data.textContent) {
            parts.push(`BULA OFICIAL ANVISA — ${result.data.name} (${result.data.company}):\nRegistro: ${result.data.registro || "N/A"}\nFonte: PDF do Bulário Eletrônico ANVISA\n\n${result.data.textContent}`);
          } else {
            // PDF not available, show metadata only
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
 * Get the no-data fallback message to append to system prompt.
 * @returns {string}
 */
function getNoDataPrompt() {
  return `\n\nNenhum medicamento foi identificado ou encontrado na base de dados. Informe ao usuário que você não encontrou dados de bula para esta consulta e sugira que ele digite o nome do medicamento diretamente. NÃO use conhecimento geral — responda APENAS com dados das bulas.`;
}

module.exports = { listPrompts, getSystemPrompt, buildContextPrompt, getNoDataPrompt };
