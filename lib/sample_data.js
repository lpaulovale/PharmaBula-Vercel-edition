/**
 * Sample Drug Data for BulaIA
 * 
 * Embedded bula data for common Brazilian medications.
 * Each drug has BOTH patient and professional bulas.
 * Mirrors the Python sample_data.py from the original tcc-final project.
 */

const SAMPLE_DRUGS = [
  // ===== PARACETAMOL =====
  {
    id: "paracetamol_001",
    name: "Paracetamol 500mg",
    company: "Laboratório Genérico",
    activeIngredient: "Paracetamol",
    bulletinType: "paciente",
    textContent: `PARACETAMOL 500mg - BULA DO PACIENTE

INDICAÇÕES
O paracetamol é indicado para o alívio temporário de dores leves a moderadas, como dor de cabeça, dor muscular, dor de dente, dor nas costas, cólicas menstruais, e para redução da febre.

POSOLOGIA
Adultos e crianças acima de 12 anos: Tomar 1 a 2 comprimidos a cada 4 a 6 horas, não excedendo 8 comprimidos em 24 horas.
Crianças de 6 a 12 anos: Tomar 1/2 a 1 comprimido a cada 4 a 6 horas.

CONTRAINDICAÇÕES
- Hipersensibilidade ao paracetamol ou a qualquer componente da fórmula
- Doença hepática grave
- Uso concomitante de outros medicamentos contendo paracetamol

EFEITOS COLATERAIS
Reações raras: Reações alérgicas (erupção cutânea, urticária)
Reações muito raras: Alterações nos exames de sangue, reações hepáticas

INTERAÇÕES MEDICAMENTOSAS
- Álcool: aumenta o risco de danos ao fígado
- Varfarina: pode aumentar o efeito anticoagulante
- Medicamentos para epilepsia: podem alterar a eficácia do paracetamol

ADVERTÊNCIAS
- Não exceda a dose recomendada
- Em caso de ingestão acidental de doses maiores, procure atendimento médico
- Não use por mais de 3 dias para febre ou 10 dias para dor sem orientação médica
- Pacientes com problemas hepáticos devem consultar um médico antes de usar`
  },
  {
    id: "paracetamol_002",
    name: "Paracetamol 500mg",
    company: "Laboratório Genérico",
    activeIngredient: "Paracetamol (Acetaminofeno)",
    bulletinType: "profissional",
    textContent: `PARACETAMOL 500mg - BULA DO PROFISSIONAL

IDENTIFICAÇÃO
Nome comercial: Paracetamol
Denominação Comum Brasileira (DCB): Paracetamol
Classificação ATC: N02BE01 (Analgésicos > Outros analgésicos e antipiréticos > Anilidas)

COMPOSIÇÃO
Cada comprimido contém 500mg de paracetamol (acetaminofeno).

MECANISMO DE AÇÃO
O paracetamol exerce ação analgésica por elevação do limiar da dor e antipirética através de ação no centro hipotalâmico que regula a temperatura. Inibe fracamente as ciclooxigenases COX-1 e COX-2 nos tecidos periféricos, o que explica sua fraca atividade anti-inflamatória. A inibição seletiva da COX-3 no SNC é proposta como mecanismo analgésico central. Também atua na via serotoninérgica descendente e no sistema endocanabinoide (via metabolito AM404).

FARMACOCINÉTICA
- Absorção: Rápida e completa por via oral; Tmax = 30-60 minutos. Biodisponibilidade: 70-90% (efeito de primeira passagem hepática).
- Distribuição: Vd = 0,9 L/kg. Ligação proteica: 10-25%. Atravessa barreira hematoencefálica e placentária. Presente no leite materno (< 2% da dose materna).
- Metabolismo: Hepático. ~60% por glicuronidação (UGT1A1, UGT1A6), ~35% por sulfatação (SULT1A1). ~5% por oxidação via CYP2E1 formando NAPQI (N-acetil-p-benzoquinoneimina), metabolito hepatotóxico neutralizado pela glutationa.
- Eliminação: T½ = 1,5–3 horas (adultos), prolongado em hepatopatas (> 4h) e neonatos (3,5h). Excreção renal: 90% em 24h, predominantemente como conjugados glicurônideos (60%) e sulfatos (35%).

POSOLOGIA E MODO DE USAR
Adultos e adolescentes >12 anos (>40kg): 500–1000mg/dose a cada 4–6h. Dose máxima: 4g/24h. Em hepatopatas ou etilistas crônicos: máximo 2g/24h.
Pediatria: 10-15 mg/kg/dose a cada 4-6h. Dose máxima: 75 mg/kg/dia (não exceder 4g/dia).
Ajuste renal: ClCr 10-50 mL/min: intervalo a cada 6h; ClCr <10 mL/min: intervalo a cada 8h.

CONTRAINDICAÇÕES
- Hipersensibilidade ao paracetamol
- Insuficiência hepática grave (Child-Pugh C)
- Hepatite viral aguda
- Deficiência de glicose-6-fosfato desidrogenase (G6PD) — cautela

REAÇÕES ADVERSAS
Raras (<1/1000): Trombocitopenia, leucopenia, neutropenia, agranulocitose
Muito raras (<1/10000): Hepatotoxicidade dose-dependente, síndrome de Stevens-Johnson, necrólise epidérmica tóxica, anafilaxia
Superdosagem: NAPQI acumula-se quando reservas de glutationa hepática caem abaixo de 30%. Antídoto: N-acetilcisteína (NAC).

INTERAÇÕES MEDICAMENTOSAS CLINICAMENTE SIGNIFICATIVAS
- Varfarina: paracetamol crônico (>2g/dia por ≥1 semana) aumenta INR em 1,5–2x
- Indutores de CYP2E1 (isoniazida, etanol crônico): aumentam formação de NAPQI
- Anticonvulsivantes (fenitoína, carbamazepina, fenobarbital): induzem metabolismo, reduzem meia-vida do paracetamol
- Zidovudina: neutropenia aumentada
- Metoclopramida/domperidona: aceleram absorção oral
- Colestiramina: reduz absorção (administrar com intervalo de 1h)`
  },

  // ===== DIPIRONA =====
  {
    id: "dipirona_001",
    name: "Dipirona Sódica 500mg",
    company: "Laboratório Nacional",
    activeIngredient: "Dipirona Sódica (Metamizol)",
    bulletinType: "paciente",
    textContent: `DIPIRONA SÓDICA 500mg - BULA DO PACIENTE

INDICAÇÕES
A dipirona é indicada como analgésico e antipirético para:
- Dor de cabeça
- Dor de dente
- Dor pós-operatória
- Cólicas
- Febre

POSOLOGIA
Adultos e adolescentes acima de 15 anos: 1 a 2 comprimidos até 4 vezes ao dia.
Dose máxima diária: 4g (8 comprimidos).
Crianças: Consultar médico para dose adequada ao peso.

CONTRAINDICAÇÕES
- Alergia à dipirona ou a outros derivados pirazolônicos
- História de reações alérgicas graves a analgésicos
- Função da medula óssea comprometida
- Deficiência de G6PD
- Gravidez (especialmente primeiro e terceiro trimestres)

EFEITOS COLATERAIS
Reações incomuns: Reações alérgicas na pele
Reações raras: Agranulocitose (redução grave dos glóbulos brancos)
Reações muito raras: Choque anafilático, síndrome de Stevens-Johnson

INTERAÇÕES MEDICAMENTOSAS
- Ciclosporina: pode reduzir níveis sanguíneos
- Metotrexato: pode aumentar toxicidade
- Anticoagulantes orais: pode potencializar efeito

ADVERTÊNCIAS
- Não use se tiver histórico de reações graves a analgésicos
- Suspenda o uso e procure médico se apresentar febre, dor de garganta ou lesões na boca
- Evite uso prolongado sem orientação médica`
  },
  {
    id: "dipirona_002",
    name: "Dipirona Sódica 500mg",
    company: "Laboratório Nacional",
    activeIngredient: "Dipirona Sódica (Metamizol Sódico)",
    bulletinType: "profissional",
    textContent: `DIPIRONA SÓDICA 500mg - BULA DO PROFISSIONAL

IDENTIFICAÇÃO
Denominação Comum Brasileira (DCB): Dipirona sódica
Classificação ATC: N02BB02 (Analgésicos > Pirazolinas)

MECANISMO DE AÇÃO
A dipirona (metamizol) é um pró-fármaco que sofre hidrólise no trato gastrointestinal, gerando 4-metilaminoantipirina (4-MAA) como metabólito ativo principal. Atua por inibição da síntese de prostaglandinas via COX-1 e COX-2 centrais, ativação do sistema opioide endógeno (via liberação de β-endorfinas) e do sistema endocanabinoide. Possui efeito espasmolítico por ação direta na musculatura lisa e inibição de Ca2+ intracelular.

FARMACOCINÉTICA
- Absorção: Hidrólise completa no TGI. 4-MAA é absorvido rapidamente; Tmax = 1-1,5h. Biodisponibilidade oral ~90%.
- Distribuição: Vd = 0,2-0,4 L/kg. Ligação proteica: 4-MAA 58%, 4-AA 48%.
- Metabolismo: Hepático. 4-MAA → 4-aminoantipirina (4-AA, ativo) via desmetilação. 4-AA → 4-acetilamino-antipirina (4-AAA, inativo) e 4-formilaminoantipirina (4-FAA).
- Eliminação: T½ 4-MAA = 2,5-4h. Predominantemente renal (96%), <3% in natura. Em insuficiência renal grave, acúmulo de metabólitos ativos.

POSOLOGIA E MODO DE USAR
Adultos (>15 anos, >53kg): 500-1000mg/dose, até 4g/dia, intervalos de 6-8h.
Pediatria (3-11 meses, >5kg): 2,5-5mg/kg/dose, solução gotas.
Ajuste renal/hepático: reduzir dose e aumentar intervalos em IR/IH moderada a grave.

REAÇÕES ADVERSAS GRAVES
- Agranulocitose: incidência ~1:1.500 (dados suecos) a 1:1.000.000 (estudos LATIN). Mecanismo imunomediado (anticorpos IgG/IgM anti-granulócitos). Monitorar leucogramas em uso >7 dias.
- Pancitopenia: rara, mecanismo similar
- Choque anafilactoide/anafilático: incidência ~1:5.000 IV. Maior risco via parenteral.
- Síndrome de Kounis: vasoespasmo coronário alérgico
- Nefrite intersticial aguda: rara

INTERAÇÕES MEDICAMENTOSAS CLINICAMENTE SIGNIFICATIVAS
- Ciclosporina: redução de níveis séricos em 15-40%
- Metotrexato: aumento de toxicidade hematológica
- Clorpromazina: hipotermia aditiva
- Anticoagulantes cumarínicos: deslocamento de ligação proteica
- Bupropiona: redução do limiar convulsivo`
  },

  // ===== IBUPROFENO =====
  {
    id: "ibuprofeno_001",
    name: "Ibuprofeno 400mg",
    company: "Pharma Brasil",
    activeIngredient: "Ibuprofeno",
    bulletinType: "paciente",
    textContent: `IBUPROFENO 400mg - BULA DO PACIENTE

INDICAÇÕES
O ibuprofeno é um anti-inflamatório não esteroidal (AINE) indicado para:
- Dores leves a moderadas
- Dor de cabeça e enxaqueca
- Dor muscular e nas articulações
- Dor de dente
- Cólicas menstruais
- Febre
- Inflamações

POSOLOGIA
Adultos e crianças acima de 12 anos: 200mg a 400mg a cada 4 a 6 horas.
Dose máxima diária: 1200mg (3 comprimidos de 400mg).
Tomar preferencialmente com alimentos para reduzir irritação gástrica.

CONTRAINDICAÇÕES
- Alergia ao ibuprofeno ou outros AINEs
- Úlcera péptica ativa ou sangramento gastrointestinal
- Insuficiência cardíaca grave
- Insuficiência renal ou hepática grave
- Último trimestre da gravidez
- Histórico de asma induzida por AINEs

EFEITOS COLATERAIS
Comuns: Dor de estômago, náuseas, diarreia, gases
Incomuns: Dor de cabeça, tontura, retenção de líquidos
Raros: Úlcera gástrica, sangramento, reações alérgicas

INTERAÇÕES MEDICAMENTOSAS
- Aspirina: reduz efeito cardioprotetor
- Anticoagulantes: aumenta risco de sangramento
- Anti-hipertensivos: pode reduzir eficácia
- Lítio: aumenta níveis no sangue
- Metotrexato: aumenta toxicidade

ADVERTÊNCIAS
- Tomar com alimentos ou leite
- Não usar por períodos prolongados sem orientação médica
- Idosos têm maior risco de efeitos colaterais gastrointestinais
- Evitar em pacientes com problemas cardíacos`
  },
  {
    id: "ibuprofeno_002",
    name: "Ibuprofeno 400mg",
    company: "Pharma Brasil",
    activeIngredient: "Ibuprofeno",
    bulletinType: "profissional",
    textContent: `IBUPROFENO 400mg - BULA DO PROFISSIONAL

IDENTIFICAÇÃO
Denominação Comum Brasileira (DCB): Ibuprofeno
Classificação ATC: M01AE01 (Anti-inflamatórios > Derivados do ácido propiônico)

MECANISMO DE AÇÃO
O ibuprofeno é um derivado do ácido propiônico que inibe de forma não seletiva as isoenzimas COX-1 e COX-2, reduzindo a síntese de prostaglandinas (PGE2, PGI2, TXA2) a partir do ácido araquidônico. A inibição da COX-2 nos tecidos inflamados é responsável pelo efeito anti-inflamatório e analgésico. A inibição da COX-1 gástrica explica o risco de ulceração gastrointestinal. O efeito antipirético ocorre por inibição da PGE2 no hipotálamo anterior.

FARMACOCINÉTICA
- Absorção: Rápida e completa; Tmax = 1-2h (comp.), 0,5h (suspensão). Alimentos retardam Tmax sem alterar AUC. Biodisponibilidade ~80%.
- Distribuição: Vd = 0,12-0,2 L/kg. Ligação proteica: >99% (albumina). Concentrações no líquido sinovial inflamado atingem 30-40% das plasmáticas. Atravessa barreira placentária. Baixa concentração no leite materno (<1 mg/L).
- Metabolismo: Hepático extenso via CYP2C9 (principal) e CYP2C8. Metabólitos inativos: 2-hidroxi-ibuprofeno, 3-carboxi-ibuprofeno. Sem metabólitos ativos clinicamente relevantes. A forma S(+) (eutômero) é 160x mais potente na inibição de COX que a R(-).
- Eliminação: T½ = 2-4h. Excreção renal: >90% como metabólitos conjugados. <1% excretado inalterado.

POSOLOGIA E MODO DE USAR
Anti-inflamatório: 400-800mg 3-4x/dia. Máximo: 3200mg/dia.
Analgésico/antipirético OTC: 200-400mg a cada 4-6h. Máximo: 1200mg/dia.
Pediatria (≥6 meses): 5-10 mg/kg/dose a cada 6-8h. Máximo: 40mg/kg/dia.
Ajuste renal: evitar se ClCr <30 mL/min. Contraindicado em DRC avançada.

REAÇÕES ADVERSAS
- GI (10-30%): dispepsia, náusea, dor abdominal. Úlcera e hemorragia GI: 1-4% (uso crônico)
- Cardiovascular: aumento do risco de eventos tromboembólicos (IAM, AVC) com uso prolongado e em altas doses (>1200mg/dia)
- Renal: redução da TFG, nefrite intersticial, necrose papilar (uso crônico)
- Hematológico: inibição reversível da agregação plaquetária, anemia aplásica (rara)

INTERAÇÕES MEDICAMENTOSAS CLINICAMENTE SIGNIFICATIVAS
- AAS (dose cardioprotetora): ibuprofeno bloqueia o acesso do AAS à COX-1 plaquetária se administrado antes. Intervalo recomendado: AAS 30min antes do ibuprofeno.
- IECA/BRA: redução do efeito anti-hipertensivo e risco de IRA (tríade AINE+IECA+diurético)
- Lítio: aumento de 15-20% nos níveis séricos
- Metotrexato: redução da depuração renal; risco de pancitopenia
- SSRIs: risco sinérgico de sangramento GI (3-15x maior)`
  },

  // ===== OMEPRAZOL =====
  {
    id: "omeprazol_001",
    name: "Omeprazol 20mg",
    company: "MedPharma",
    activeIngredient: "Omeprazol",
    bulletinType: "paciente",
    textContent: `OMEPRAZOL 20mg - BULA DO PACIENTE

INDICAÇÕES
O omeprazol é um inibidor da bomba de prótons indicado para:
- Úlcera gástrica e duodenal
- Doença do refluxo gastroesofágico (azia)
- Síndrome de Zollinger-Ellison
- Prevenção de úlceras causadas por anti-inflamatórios
- Erradicação do H. pylori (em combinação com antibióticos)

POSOLOGIA
Adultos:
- Úlcera duodenal: 20mg uma vez ao dia por 2 a 4 semanas
- Úlcera gástrica: 20mg uma vez ao dia por 4 a 8 semanas
- Refluxo: 20mg uma vez ao dia por 4 a 8 semanas
Tomar em jejum, 30 minutos antes do café da manhã.
Engolir o comprimido inteiro, não mastigar ou triturar.

CONTRAINDICAÇÕES
- Alergia ao omeprazol ou benzimidazóis
- Uso concomitante com nelfinavir (medicamento para HIV)

EFEITOS COLATERAIS
Comuns: Dor de cabeça, diarreia, dor abdominal, náuseas
Incomuns: Tontura, constipação, flatulência
Raros: Alterações nas enzimas hepáticas, reações alérgicas

INTERAÇÕES MEDICAMENTOSAS
- Clopidogrel: pode reduzir eficácia
- Metotrexato: pode aumentar níveis
- Antifúngicos (cetoconazol): absorção reduzida
- Diazepam: metabolismo alterado
- Digoxina: absorção aumentada

ADVERTÊNCIAS
- Uso prolongado pode causar deficiência de vitamina B12 e magnésio
- Pode aumentar risco de fraturas ósseas com uso prolongado
- Antes de iniciar, excluir possibilidade de câncer gástrico`
  },
  {
    id: "omeprazol_002",
    name: "Omeprazol 20mg",
    company: "MedPharma",
    activeIngredient: "Omeprazol",
    bulletinType: "profissional",
    textContent: `OMEPRAZOL 20mg - BULA DO PROFISSIONAL

IDENTIFICAÇÃO
Denominação Comum Brasileira (DCB): Omeprazol
Classificação ATC: A02BC01 (IBP - Inibidores da Bomba de Prótons)

MECANISMO DE AÇÃO
O omeprazol é um benzimidazol substituído que atua como pró-fármaco. Em meio ácido (pH <4) dos canalículos da célula parietal gástrica, sofre conversão à sulfenamida ativa, que se liga covalentemente aos resíduos de cisteína (Cys813 e Cys822) da subunidade α da H+/K+-ATPase (bomba de prótons), inibindo-a de forma irreversível. Uma dose de 20mg suprime ~80% da secreção ácida basal por 24h. A recuperação da secreção ácida requer síntese de novas bombas (T½ de renovação ~54h).

FARMACOCINÉTICA
- Absorção: Formulação gastrorresistente. Tmax = 1-2h. Biodisponibilidade: 35% (dose única) aumentando para 60% no steady-state (induz sua própria biodisponibilidade por redução da degradação ácida).
- Distribuição: Vd = 0,3 L/kg. Ligação proteica: 97% (albumina e α1-glicoproteína ácida).
- Metabolismo: Hepático extensivo via CYP2C19 (polimorfismo genético: metabolizadores lentos têm AUC 5x maior) e CYP3A4. Metabólitos inativos: hidroxiomeprazol e sulfonol de omeprazol.
- Eliminação: T½ plasmática = 0,5-1h (mas efeito dura 24h por ligação covalente). Excreção renal: ~80% como metabólitos. Biliar: ~20%.

POSOLOGIA E MODO DE USAR
DRGE: 20mg/dia por 4-8 semanas. Esofagite erosiva: 20-40mg/dia.
Úlcera duodenal: 20mg/dia por 2-4 semanas. Úlcera gástrica: 20mg/dia por 4-8 semanas.
Erradicação H. pylori (terapia tripla): omeprazol 20mg 2x/dia + claritromicina 500mg 2x/dia + amoxicilina 1g 2x/dia por 7-14 dias.
Zollinger-Ellison: iniciar 60mg/dia, titular conforme secreção ácida.
Ajuste hepático: IH grave: máximo 20mg/dia.

REAÇÕES ADVERSAS
- Uso prolongado (>1 ano): hipergastrinemia (consequência fisiológica), hiperplasia de células ECL (reversível), hipomagnesemia (<1%), deficiência de vitamina B12 e ferro, risco de fraturas osteoporóticas (OR 1,3-1,4), nefrite intersticial aguda (rara), colite microscópica
- Infecciosas: aumento do risco de infecção por C. difficile (OR 1,7), pneumonia comunitária (controverso)

INTERAÇÕES MEDICAMENTOSAS CLINICAMENTE SIGNIFICATIVAS
- Clopidogrel: omeprazol inibe CYP2C19, reduzindo conversão do clopidogrel ao metabólito ativo. Redução de 30-40% na inibição plaquetária. Preferir pantoprazol.
- Metotrexato (altas doses): redução da depuração renal; risco de toxicidade
- Atazanavir/nelfinavir: absorção pH-dependente reduzida. Contraindicado com nelfinavir.
- Tacrolimus: aumento dos níveis séricos via CYP3A4 (monitorar)`
  },

  // ===== AMOXICILINA =====
  {
    id: "amoxicilina_001",
    name: "Amoxicilina 500mg",
    company: "Antibióticos Brasil",
    activeIngredient: "Amoxicilina Triidratada",
    bulletinType: "paciente",
    textContent: `AMOXICILINA 500mg - BULA DO PACIENTE

INDICAÇÕES
A amoxicilina é um antibiótico da classe das penicilinas indicado para:
- Infecções do trato respiratório (sinusite, otite, amigdalite, bronquite)
- Infecções urinárias
- Infecções de pele
- Erradicação do H. pylori (em combinação com outros medicamentos)
- Prevenção de endocardite bacteriana

POSOLOGIA
Adultos e crianças acima de 40kg:
- Infecções leves a moderadas: 500mg a cada 8 horas
- Infecções graves: 500mg a cada 8 horas ou 875mg a cada 12 horas
- Duração: 7 a 14 dias conforme infecção
Crianças: Dose calculada pelo peso (20-40mg/kg/dia divididos em 3 doses)

CONTRAINDICAÇÕES
- Alergia a penicilinas ou cefalosporinas
- Mononucleose infecciosa (alto risco de erupção cutânea)

EFEITOS COLATERAIS
Comuns: Diarreia, náuseas, erupção cutânea
Incomuns: Vômitos, candidíase oral ou vaginal
Raros: Reações alérgicas graves, colite pseudomembranosa

INTERAÇÕES MEDICAMENTOSAS
- Metotrexato: toxicidade aumentada
- Anticoagulantes orais: pode aumentar efeito
- Contraceptivos orais: eficácia pode ser reduzida
- Probenecida: aumenta níveis de amoxicilina

ADVERTÊNCIAS
- Completar todo o tratamento prescrito
- Informar ao médico sobre alergias a antibióticos
- Em caso de diarreia grave, procurar atendimento médico
- Pode causar reações em pessoas alérgicas à penicilina`
  },
  {
    id: "amoxicilina_002",
    name: "Amoxicilina 500mg",
    company: "Antibióticos Brasil",
    activeIngredient: "Amoxicilina Triidratada",
    bulletinType: "profissional",
    textContent: `AMOXICILINA 500mg - BULA DO PROFISSIONAL

IDENTIFICAÇÃO
Denominação Comum Brasileira (DCB): Amoxicilina triidratada
Classificação ATC: J01CA04 (Antibacterianos > Penicilinas de espectro ampliado)

MECANISMO DE AÇÃO
A amoxicilina é uma aminopenicilina bactericida que inibe a transpeptidação, etapa final da síntese do peptidoglicano da parede celular bacteriana. Liga-se às proteínas ligadoras de penicilina (PBPs), principalmente PBP1a, PBP1b e PBP3 de bactérias gram-negativas e PBP1, PBP2 e PBP3 de gram-positivas. A lise celular resulta da ativação de autolisinas (murein hidrolases) endógenas.

ESPECTRO ANTIMICROBIANO
- Sensíveis: S. pneumoniae, S. pyogenes, Enterococcus (não produtores de β-lactamase), H. influenzae (não produtores de β-lactamase), E. coli (sensibilidade variável ~60%), Listeria
- Resistentes: S. aureus MRSA, Enterobacteriaceae produtoras de ESBL, Pseudomonas, Bacteroides fragilis

FARMACOCINÉTICA
- Absorção: Tmax = 1-2h. Biodisponibilidade 70-90% (superior à ampicilina). Não afetada significativamente por alimentos.
- Distribuição: Vd = 0,3-0,4 L/kg. Ligação proteica: 17-20%. Boa penetração em: ouvido médio, seios paranasais, mucosa brônquica, líquido peritoneal, bile. Penetração no LCR: 5-10% (sem inflamação), 15-25% (com meningite).
- Metabolismo: Mínimo. ~30% metabolizado a ácido peniciloico (inativo).
- Eliminação: T½ = 1-1,3h (função renal normal). Excreção renal: 60-75% inalterado. Clearance renal: ~300 mL/min (filtração + secreção tubular).
- Ajuste renal: ClCr 10-30: 500mg q12h; ClCr <10: 500mg q24h. Dialisável: dose suplementar pós-HD.

REAÇÕES ADVERSAS
- Alergia: reação cutânea 4-8% (maculopapular, não IgE-mediada, especialmente na mononucleose ~90%). Anafilaxia: 0,01-0,05%.
- GI: diarreia ~10% (mecanismo osmótico e alteração de flora), C. difficile <1%
- Hepatobiliar: icterícia colestática (1/10.000), hepatite (rara)

INTERAÇÕES MEDICAMENTOSAS CLINICAMENTE SIGNIFICATIVAS
- Alopurinol: aumento da incidência de rash (4x)
- Metotrexato: competição pela secreção tubular renal, aumento da AUC do MTX em 30-40%
- Acenocumarol/varfarina: prolongamento do INR (monitorar)
- Probenecida: bloqueia secreção tubular, aumenta T½ da amoxicilina em 30-50%`
  },

  // ===== LOSARTANA =====
  {
    id: "losartana_001",
    name: "Losartana Potássica 50mg",
    company: "CardioFarma",
    activeIngredient: "Losartana Potássica",
    bulletinType: "paciente",
    textContent: `LOSARTANA POTÁSSICA 50mg - BULA DO PACIENTE

INDICAÇÕES
A losartana é um bloqueador do receptor de angiotensina II indicado para:
- Hipertensão arterial (pressão alta)
- Proteção renal em pacientes diabéticos tipo 2 com proteinúria
- Insuficiência cardíaca quando IECAs não são tolerados
- Redução do risco de AVC em pacientes hipertensos com hipertrofia ventricular

POSOLOGIA
Hipertensão:
- Dose inicial: 50mg uma vez ao dia
- Dose máxima: 100mg uma vez ao dia
- Pode ser tomado com ou sem alimentos
Insuficiência cardíaca:
- Dose inicial: 12,5mg uma vez ao dia
- Aumentar gradualmente conforme tolerância

CONTRAINDICAÇÕES
- Alergia à losartana ou componentes da fórmula
- Gravidez (pode causar danos ao feto)
- Amamentação
- Uso concomitante com alisquireno em diabéticos

EFEITOS COLATERAIS
Comuns: Tontura, infecções respiratórias superiores
Incomuns: Hipotensão, aumento de potássio no sangue
Raros: Angioedema (inchaço da face e garganta)

INTERAÇÕES MEDICAMENTOSAS
- Diuréticos poupadores de potássio: risco de hipercalemia
- AINEs (ibuprofeno): podem reduzir efeito anti-hipertensivo
- Lítio: aumento dos níveis sanguíneos
- Suplementos de potássio: evitar uso conjunto

ADVERTÊNCIAS
- Não usar durante a gravidez
- Monitorar função renal e potássio periodicamente
- Pode causar tontura; cuidado ao dirigir
- Manter hidratação adequada`
  },
  {
    id: "losartana_002",
    name: "Losartana Potássica 50mg",
    company: "CardioFarma",
    activeIngredient: "Losartana Potássica",
    bulletinType: "profissional",
    textContent: `LOSARTANA POTÁSSICA 50mg - BULA DO PROFISSIONAL

IDENTIFICAÇÃO
Denominação Comum Brasileira (DCB): Losartana potássica
Classificação ATC: C09CA01 (Antagonistas dos receptores da angiotensina II > ARBs)

MECANISMO DE AÇÃO
A losartana é um antagonista seletivo do receptor AT1 da angiotensina II. Bloqueia competitivamente a ligação da angiotensina II ao receptor AT1, prevenindo vasoconstrição, secreção de aldosterona, e retenção de sódio e água. Diferente dos IECAs, não inibe a ECA (cininase II), portanto não aumenta os níveis de bradicinina, o que explica a menor incidência de tosse seca. O metabólito ativo E-3174 (ácido carboxílico) é 10-40x mais potente que a losartana com efeito antagonista não-competitivo (pseudo-irreversível) no receptor AT1.

FARMACOCINÉTICA
- Absorção: Tmax losartana = 1h, Tmax E-3174 = 3-4h. Biodisponibilidade: ~33% (extenso efeito de primeira passagem). Alimentos diminuem AUC em ~10%.
- Distribuição: Vd = 34L (losartana), 12L (E-3174). Ligação proteica: >99% (albumina). Não atravessa significativamente a BHE.
- Metabolismo: Hepático. ~14% da dose é convertida ao metabólito ativo E-3174 via CYP2C9 (principal) e CYP3A4. Polimorfismo CYP2C9: metabolizadores lentos (*2/*3) têm redução de 50% na formação de E-3174.
- Eliminação: T½ losartana = 2h; T½ E-3174 = 6-9h. Excreção renal: 35% (4% inalterado). Biliar: 60%.
- Ajuste hepático: IH Child-Pugh B/C: reduzir dose inicial para 25mg/dia. Não necessário ajuste renal.

POSOLOGIA E MODO DE USAR
Hipertensão: 50mg/dia (pode titular até 100mg/dia). Adicionar HCTZ 12,5-25mg se monoterapia insuficiente.
Nefropatia diabética: 50mg/dia, titular para 100mg/dia em 4 semanas. Alvo: redução de albuminúria.
IC (NYHA II-IV): iniciar 12,5mg/dia, titular a cada 1-2 semanas até alvo 50mg/dia (ou 150mg/dia conforme HEAAL trial).

REAÇÕES ADVERSAS
- Hipercalemia: 1,5-9,9% (dose e função renal dependente). K+ >6,0: suspender.
- Hipotensão: especialmente em hipovolêmicos ou uso concomitante de diuréticos (dose inicial 25mg).
- IRA: em estenose bilateral de artéria renal ou rim único.
- Angioedema: 0,1% (menor que IECA, mas possível reação cruzada).

INTERAÇÕES MEDICAMENTOSAS CLINICAMENTE SIGNIFICATIVAS
- Fluconazol/inibidores de CYP2C9: aumento dos níveis de losartana e redução da conversão em E-3174. Efeito clínico net pode ser reduzido.
- Rifampicina (indutor CYP2C9/3A4): redução de 30-40% dos níveis de losartana e E-3174
- Duplo bloqueio SRAA (IECA+ARB ou +alisquireno): contraindicado — aumento de hipotensão, hipercalemia e IRA (estudos ONTARGET, ALTITUDE)
- Trimetoprima: hipercalemia aditiva`
  },
];

/**
 * Search drugs by name or active ingredient.
 * @param {string} query - Search term
 * @param {string} [bulaType] - Filter by bula type: "paciente" or "profissional"
 * @returns {Array} Matching drugs
 */
function searchDrugs(query, bulaType) {
  const q = query.toLowerCase();
  return SAMPLE_DRUGS.filter(drug => {
    const nameMatch = drug.name.toLowerCase().includes(q) ||
      drug.activeIngredient.toLowerCase().includes(q);
    const typeMatch = bulaType ? drug.bulletinType === bulaType : true;
    return nameMatch && typeMatch;
  });
}

/**
 * Get drug by name, preferring the specified bula type.
 * @param {string} name - Drug name (case insensitive, partial match)
 * @param {string} bulaType - "paciente" or "profissional"
 * @returns {Object|null} Drug data
 */
function getDrugByName(name, bulaType = "paciente") {
  const q = name.toLowerCase();

  // First try exact bula type
  let result = SAMPLE_DRUGS.find(d =>
    (d.name.toLowerCase().includes(q) || d.activeIngredient.toLowerCase().includes(q)) &&
    d.bulletinType === bulaType
  );

  // Fallback to any type
  if (!result) {
    result = SAMPLE_DRUGS.find(d =>
      d.name.toLowerCase().includes(q) || d.activeIngredient.toLowerCase().includes(q)
    );
  }

  return result || null;
}

/**
 * List all unique drug names in the database.
 * @returns {Array<string>}
 */
function listDrugNames() {
  const seen = new Set();
  const names = [];
  for (const d of SAMPLE_DRUGS) {
    const base = d.name.split(" ")[0].toLowerCase();
    if (!seen.has(base)) {
      seen.add(base);
      names.push(d.activeIngredient.split("(")[0].trim());
    }
  }
  return names;
}

module.exports = { SAMPLE_DRUGS, searchDrugs, getDrugByName, listDrugNames };
