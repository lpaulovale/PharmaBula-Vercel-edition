# Prompt para Revisão do Artigo FarmaIA

**Instruções para o LLM:** Você é um assistente especializado em escrita acadêmica na área de ciência da computação e sistemas de IA para saúde. Sua tarefa é revisar e atualizar um artigo LaTeX sobre o sistema FarmaIA.

---

## 📁 ARQUIVOS EM ANEXO

Você receberá os seguintes arquivos:

1. **artigo.tex** - Artigo acadêmico completo (formato LaTeX, classe sbc-template)
2. **lib/tagger.js** - Novo módulo de sentence tagging (implementado hoje)
3. **lib/question_classifier.js** - Classificador de perguntas atualizado
4. **api/chat.js** - Pipeline principal de processamento de consultas
5. **lib/section_router.js** - Mapeamento determinístico tag→seção
6. **lib/planner.js** - Planejador determinístico (opcional, se couber)

---

## 🎯 CONTEXTO DO SISTEMA

O **FarmaIA** é um assistente inteligente baseado no Model Context Protocol (MCP) que responde perguntas sobre medicamentos usando uma base MongoDB com 1.526 bulas da ANVISA.

### Arquitetura Atual (5 Fases)

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 0: Classificação LLM (~400-600ms)                         │
│  - question_classifier.js                                       │
│  - Entrada: pergunta do usuário + histórico                     │
│  - Saída: { tags: string[], drug: string, confidence: float,    │
│             isYesNo: boolean }                                  │
│  - 60 tags semânticas em vocabulário controlado                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  FASE 1: Planejamento Determinístico (<50ms)                    │
│  - planner.js + section_router.js                               │
│  - TAG_TO_SECTION[tag] → lookup O(1)                            │
│  - SEM LLM - puro código                                        │
│  - Saída: { tools: [{name, args}], fallbacks: [] }              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  FASE 2: Execução de Tools (~30-80ms)                           │
│  - tool_registry.js                                             │
│  - MongoDB queries em paralelo (Promise.all)                    │
│  - get_section() ou get_bula_data()                             │
│  - Fallback automático se seção não encontrada                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  FASE 2b: Tagging e Filtragem (~1000-1500ms) ⭐ NOVO           │
│  - tagger.js                                                    │
│  - Para cada seção recuperada:                                  │
│    1. Taggeia cada frase com tags semânticas                    │
│    2. Filtra apenas frases relevantes para as tags da pergunta  │
│    3. Agrupa frases similares por categoria                     │
│    4. Divide textos longos em chunks ≤250 caracteres            │
│  - Saída: contexto estruturado por seções temáticas             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  FASE 3: Geração da Resposta (~1500-3000ms)                     │
│  - prompt_manager.js + LLM principal                            │
│  - Recebe contexto JÁ ESTRUTURADO do tagger                     │
│  - Formatação: bullets para dosagens, parágrafos curtos p/ outros│
│  - Cada frase começa com letra maiúscula                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ENTREGA AO USUÁRIO (~3000-5000ms total)                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (assíncrono)
┌─────────────────────────────────────────────────────────────────┐
│  VALIDAÇÃO: Pipeline de Juízes (~1700ms, não bloqueia)          │
│  - 4 juízes gerais: segurança, qualidade, fonte, formato        │
│  - Juízes de tópico condicionais (posologia, reações, etc.)     │
│  - Classificação ternária: covered | missing | not_in_bula      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 MUDANÇAS IMPLEMENTADAS (HOJE)

### 1. Novo Módulo: Sentence Tagger (`lib/tagger.js`)

**Função:** `tagAndFilter(text, section, questionTags)`

**O que faz:**
- Recebe texto bruto de uma seção da bula (ex: posologia, reacoes)
- Para CADA frase/sentença:
  - Atribui tag semântica específica (ex: `dosage_adult`, `side_effects_hematologic`)
  - Marca como relevante ou irrelevante baseado nas `questionTags`
- Retorna APENAS frases relevantes
- Agrupa frases similares para reduzir fragmentação

**Exemplo de output:**
```javascript
// Entrada: texto bruto de "reacoes" (2953 caracteres)
// Saída:
[
  { tag: "side_effects_hypersensitivity", 
    text: "Raramente a dipirona pode causar reações anafiláticas..." },
  { tag: "side_effects_hematologic", 
    text: "Podem desenvolver-se raramente leucopenia e agranulocitose..." }
]
```

**Agrupamento por seção:**
- **posologia**: agrupa em `dosage_adult`, `dosage_pediatric`, `dosage_special`, `administration`
- **reacoes**: agrupa em `side_effects_hypersensitivity`, `side_effects_dermatologic`, `side_effects_hematologic`, `side_effects_cardiovascular`, `side_effects_other`

**Divisão de textos longos:**
- Textos >200 caracteres são divididos por limites de frase (`.`, `!`, `?`)
- Chunks resultantes ≤250 caracteres
- Se não houver limites de frase, divide por vírgula ou espaço

---

### 2. Classificador Atualizado (`lib/question_classifier.js`)

**Mudanças:**
- Antes: retornava `{ tag: string, drug: string, confidence: float }`
- Agora: retorna `{ tags: string[], drug: string, confidence: float, isYesNo: boolean }`

**Detecção de perguntas Yes/No:**
```javascript
const yesNoPatterns = [
  /\bpode\b.*\?/,           // "pode tomar?"
  /\btem\b.*\?/,            // "tem efeito colateral?"
  /\bfaz\b.*\bmal\b.*\?/,   // "faz mal?"
  /\bcausa\b.*\?/,          // "causa sonolência?"
];
```

**Histórico de conversa:**
- Últimas 4 mensagens são injetadas no prompt do classificador
- Permite follow-ups como "E para crianças?" após perguntar sobre dose adulta
- LLM pode extrair drug name do contexto se não estiver na pergunta atual

---

### 3. Pipeline de Formatação (`api/chat.js`)

**Função:** `formatTagAsTitle(tag)` + lógica de formatação

**Regras:**
- Tags com `dosage`, `contraindication`, `administration`, `max_dose` → **bullet points**
- Tags com `side_effects`, `warnings` → **parágrafos curtos** (2-4 frases por parágrafo)
- Cada frase começa com letra **maiúscula** (capitalização automática)
- Separação entre seções: `## Título da Seção`

**Exemplo de output formatado:**
```markdown
## Posologia para Adultos

• 10 a 20 ml em administração única, até 4 vezes ao dia.

• Dose máxima diária: 80 ml.

## Posologia para Crianças

• 5 a 8 kg (3 a 11 meses): 1,25 a 2,5 ml por dose.

• 9 a 15 kg (1 a 3 anos): 2,5 a 5 ml por dose.

## Reações de Hipersensibilidade

Raramente a dipirona monoidratada pode causar reações anafiláticas/anafilactoides que, em casos muito raros, podem se tornar graves e com risco de vida.

Tipicamente, reações anafiláticas/anafilactoides leves manifestam-se na forma de sintomas na pele ou nas mucosas (como: prurido, ardor, rubor, urticária, inchaço), dispneia e, menos frequentemente, sintomas gastrintestinais.

## Reações Hematológicas

Podem desenvolver-se raramente leucopenia e, em casos muito raros, agranulocitose ou trombocitopenia. Estas reações são consideradas imunológicas.
```

---

### 4. Latência Atualizada

| Componente | Latência Antiga | Latência Nova |
|------------|-----------------|---------------|
| Classificação LLM | ~400-600ms | ~400-600ms |
| Planejamento | <50ms | <50ms |
| Execução tools | ~30-80ms | ~30-80ms |
| **Tagging (NOVO)** | — | **~1000-1500ms** |
| Geração final | ~1500-3000ms | ~1500-3000ms |
| **Total até entrega** | **~2000-3700ms** | **~3000-5000ms** |
| Validação (assínc.) | ~1700ms | ~1700ms |

---

## 📝 SEÇÕES DO ARTIGO PARA ATUALIZAR

### 1. Abstract (linha ~36 do .tex)

**Adicionar após "deterministic pipeline":**
```
...a lightweight LLM classifier maps user questions to multiple semantic tags, 
a sentence-level tagger filters and groups relevant content by thematic category, 
which are then resolved to bula sections via deterministic lookup table...
```

### 2. Resumo (linha ~48 do .tex)

**Traduzir/adicionar:**
```
...um classificador LLM leve mapeia perguntas para múltiplas tags semânticas, 
um taggeador em nível de sentença filtra e agrupa conteúdo relevante por 
categoria temática, resolvidos deterministicamente para seções de bula...
```

### 3. Contribuições (linha ~95 do .tex)

**Adicionar item (vi):**
```latex
(vi) sistema de tagging em nível de sentença que filtra e agrupa conteúdo 
por relevância, produzindo respostas estruturadas com bullets para dosagens 
e parágrafos curtos para descrições narrativas.
```

### 4. Algoritmo 1 (linha ~245 do .tex)

**Adicionar após linha 10 (após Promise.all):**
```latex
\BlankLine
\tcp*[l]{FASE 2b - NOVO}
\ForEach{$result \in results$}{
  $sentences \gets$ tagAndFilter($result.content$, $result.section$, $tags$)\;
  $grouped \gets$ groupByCategory($sentences$)\;
  $formatted \gets$ formatWithBulletsOrParagraphs($grouped$)\;
}
$context \gets$ formatted\;
```

### 5. Nova Subseção 5.4.1 (inserir após linha ~260)

```latex
\subsection{Fase 2b: Tagging e Filtragem em Nível de Sentença}

O módulo \texttt{tagger.js} implementa uma camada intermediária de 
processamento entre recuperação e geração. Para cada seção recuperada 
(posologia, reações, etc.), o tagger executa quatro operações:

\textbf{(1) Taggeamento semântico:} Cada frase recebe uma tag específica 
(ex: \texttt{dosage\_pediatric\_weight\_5\_8kg}, 
\texttt{side\_effects\_hematologic}) baseada em seu conteúdo.

\textbf{(2) Filtragem por relevância:} Apenas frases cujas tags correspondem 
às tags da pergunta original são mantidas. Perguntas sobre dosagem não 
recebem informações sobre efeitos colaterais, e vice-versa.

\textbf{(3) Agrupamento temático:} Frases com tags similares são consolidadas 
para reduzir fragmentação. Exemplo: todas as faixas de peso pediátricas são 
agrupadas sob ``Posologia para Crianças'' em vez de criar 6 seções separadas.

\textbf{(4) Divisão de textos longos:} Frases com mais de 200 caracteres 
são divididas em chunks de no máximo 250 caracteres, preservando limites 
naturais (pontos, vírgulas). Esta etapa evita parágrafos densos e melhora 
a legibilidade da resposta final.

O output do tagger é um contexto estruturado onde:
\begin{itemize}
  \item Dosagens e contraindicações são formatadas como \textbf{bullet points}
  \item Efeitos colaterais e advertências são formatados como 
        \textbf{parágrafos curtos} (2-4 frases por parágrafo)
  \item Cada frase inicia com letra maiúscula (capitalização automática)
  \item Seções são separadas por títulos Markdown (\texttt{\#\# Título})
\end{itemize}

Esta abordagem reduz a carga cognitiva do LLM de geração: ao invés de 
raciocinar sobre estrutura e formatação, o modelo recebe dados já 
organizados e foca apenas em produzir linguagem natural coerente.
```

### 6. Tabela de Latência (linha ~340 do .tex)

**Substituir tabela inteira:**
```latex
\begin{table}[H]
\centering
\small
\caption{Componentes de latência do pipeline FarmaIA (atualizado com tagging)}
\label{tab:latency}
\begin{tabularx}{\textwidth}{| l | l | >{\raggedright\arraybackslash}X |}
\hline
\textbf{Componente} & \textbf{Latência} & \textbf{Observações} \\
\hline
Classificação LLM (Fase 0)  & $\sim$400--600ms  & max\_tokens: 150, temp: 0.1, múltiplas tags \\
\hline
Planejamento determinístico & $<$50ms           & Lookup $O(1)$; sem LLM \\
\hline
Execução tools (MongoDB)    & $\sim$30--80ms    & $\max(t_i)$ via Promise.all \\
\hline
\textbf{Tagging (Fase 2b)}  & $\sim$1.000--1.500ms & Filtra e agrupa por relevância \\
\hline
Geração final (LLM)         & $\sim$1.500--3.000ms & Contexto já estruturado \\
\hline
\textbf{Total até entrega}  & $\sim$3.000--5.000ms & Usuário recebe resposta aqui \\
\hline
Validação (juízes, assínc.) & $\sim$1.700ms     & \textbf{Não bloqueia entrega} \\
\hline
\end{tabularx}
\end{table}
```

### 7. Discussão - Limitações (linha ~365 do .tex)

**Atualizar limitação (iii):**
```latex
As principais limitações são: 
(i) defasagem de atualização do MongoDB pré-processado; 
(ii) cobertura limitada às 1.526 bulas disponíveis; 
(iii) tagging depende de heurísticas manuais por seção (ex: regras para 
agrupar reações por categoria); 
(iv) suporte a perguntas multi-tópico ainda limitado; 
e (v) avaliação empírica com usuários externos planejada como trabalho futuro.
```

### 8. Discussão - Benefícios (linha ~355 do .tex)

**Adicionar parágrafo:**
```latex
A separação entre \textbf{recuperação} (tools), \textbf{estruturação} 
(tagger) e \textbf{geração} (LLM) traz benefícios adicionais: 
\textbf{redução de alucinações} (o LLM não precisa ``inventar'' estrutura); 
\textbf{respostas mais consistentes} (mesma entrada → mesma estrutura); 
e \textbf{menor custo computacional} (LLM de geração processa apenas 
conteúdo relevante, não texto bruto completo).
```

### 9. Conclusão (linha ~385 do .tex)

**Adicionar após "Terceiro":**
```latex
Quarto, o sistema de tagging em nível de sentença demonstra que 
pré-processamento estruturado do contexto permite que modelos menores 
(8B parâmetros) produzam respostas organizadas e legíveis sem necessidade 
de raciocínio estrutural complexo.
```

---

## ✅ CHECKLIST DE VALIDAÇÃO

Após revisar, verifique:

- [ ] Abstract e Resumo estão coerentes (mesmas informações em EN/PT)
- [ ] Algoritmo 1 inclui Fase 2b
- [ ] Tabela de latência soma ~3000-5000ms
- [ ] Seção 5.4.1 descreve tagger.js em detalhe
- [ ] Contribuições listam 6 itens (não 5)
- [ ] Limitações mencionam heurísticas de tagging
- [ ] Conclusão menciona tagging como 4ª contribuição
- [ ] Nomes de arquivos reais do código estão no texto
- [ ] Nenhuma informação foi removida, apenas atualizada/adicionada

---

## 🚫 O QUE NÃO MUDAR

- **Não remover** conteúdo existente
- **Não alterar** citações/bibliografia
- **Não mudar** formato LaTeX ou classe sbc-template
- **Não modificar** figuras/imagens (arquivos .png referenciados)
- **Não reescrever** seções não mencionadas acima

---

## 📤 OUTPUT ESPERADO

Retorne **APENAS** o arquivo `artigo.tex` completo e atualizado, pronto para compilar com `pdflatex`.

**Não inclua:**
- Explicações sobre o que mudou (eu já sei)
- Código dos arquivos .js (já os tenho)
- Sugestões adicionais (foco apenas no solicitado)

**Formato:**
```latex
\documentclass[12pt]{article}
...
\end{document}
```

(Artigo completo, do início ao fim, sem truncar)

---

## 🆘 DÚVIDAS COMUNS

**P: Posso reordenar parágrafos?**
R: Não, mantenha a estrutura original. Apenas atualize conteúdo.

**P: Posso adicionar novas citações?**
R: Não, use apenas a bibliografia existente.

**P: E se alguma seção não fizer sentido com as mudanças?**
R: Atualize para refletir o código real. O código é a fonte da verdade.

**P: Quantos caracteres deve ter o artigo?**
R: Mantenha aproximadamente o mesmo tamanho (+10-15% para novas seções).

---

**Boa revisão! Se tiver dúvidas sobre alguma parte do código, consulte os arquivos .js em anexo.**
