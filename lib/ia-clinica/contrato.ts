/**
 * CONTRATO DE DADOS DO MOTOR DE IA CLÍNICA — congelado em 20/08/2026.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * [ADR-0002](../../docs/adr/ADR-0002-ui-antes-da-inteligencia.md) decidiu construir a UI antes
 * de ligar o motor, e isso só é seguro se o formato dos dados for **derivado do motor real
 * agora**, não imaginado. Este arquivo é essa derivação.
 *
 * DE ONDE FOI DERIVADO — e o que NÃO foi copiado
 * Fonte: `you-ai-frontend-main/src/types/` (495 linhas) do projeto VidAI, mais a resposta real
 * congelada em `__fixtures__/ia-clinica/`. **Nenhum arquivo do VidAI foi copiado** — a stack é
 * incompatível e a regra do repositório é copiar **lógica**, não arquivo (`09` §1). O que veio
 * é a **forma dos dados**, reescrita aqui, com os nomes de campo preservados porque é o
 * contrato de rede: mudar nome de campo quebraria a integração da Metade 2.
 *
 * 🔴 A REGRA QUE ESTE ARQUIVO IMPÕE
 * Nenhum componente declara tipo próprio para dado do motor. Todos importam daqui. É o que o
 * guarda `contrato-da-ia-versionado` cobra — sem isso, cada tela inventa um formato e a
 * integração vira tradução em N lugares.
 *
 * ⚠️ ADAPTAÇÃO AO CANABIDIOL: **não é feita aqui.** Este arquivo congela o contrato **como o
 * motor o produz hoje**. Os campos específicos de canabidiol (titulação, escalas de desfecho)
 * entram nas Sprints 3 a 5, com as ADR-0004 e ADR-0005 aceitas — antes disso seria presumir
 * regra de negócio, que é a Proibição 4 do `CLAUDE.md`. Os pontos de extensão estão marcados
 * com `CANABIDIOL:` abaixo.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// MARCA DE FRONTEIRA — ADR-0002 D-06
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Marca buscável de todo ponto que **vai** chamar o motor na Metade 2.
 *
 * `rg "FRONTEIRA_MOTOR_IA"` devolve a lista completa de pontos de integração. A Metade 2
 * começa por essa lista **derivada do código**, não por inventário escrito à mão — que é o que
 * a ADR-0002 R-08 aponta como "diverge do código na primeira semana".
 *
 * Use como comentário no ponto exato da chamada futura:
 *   // FRONTEIRA_MOTOR_IA: aqui entra POST /api/analisar-anamnese (Sprint 9)
 */
export const FRONTEIRA_MOTOR_IA = 'FRONTEIRA_MOTOR_IA' as const;

/** Versão do contrato do grafo, como o motor a emite. Bump invalida cache (RM-10 no VidAI). */
export const GRAFO_SCHEMA_VERSION = '1.0.4-s13';

// ═══════════════════════════════════════════════════════════════════════════════
// ESCALAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Domínio que originou a análise.
 *
 * CANABIDIOL: as Sprints 3–5 acrescentam `'titulacao'` e `'acompanhamento'` — o ciclo do
 * canabidiol é longitudinal (baseline → ~2 semanas após titulação → mensal), e o VidAI não
 * tinha esse eixo. Não acrescento agora: depende da ADR-0004, em proposta.
 */
export type DominioAnalise = 'anamnese' | 'exame' | 'teleconsulta' | 'previsao' | 'analise_rapida';

/**
 * Nível de urgência.
 *
 * ⚠️ **INCONSISTÊNCIA DO CONTRATO DE ORIGEM, preservada de propósito.** São **7** valores para
 * o que a interface trata como 3–4 níveis: `verde|amarelo|vermelho` (semáforo) convivem com
 * `ok|normal|atencao|critico` (severidade). O fixture real usa `"vermelho"`. Normalizar aqui
 * quebraria a leitura de respostas reais do motor; a normalização é trabalho da camada de
 * apresentação, e o mapa de tradução visual está em `09-FRONTEND-VIDAI-MEDIDO.md`.
 */
export type UrgenciaAnalise =
  | 'verde'
  | 'amarelo'
  | 'vermelho'
  | 'normal'
  | 'atencao'
  | 'critico'
  | 'ok';

export type StatusNo = 'ok' | 'atencao' | 'critico' | 'pendente' | 'parcial';

/**
 * Confiança em **faixa categórica** — é o que a
 * [ADR-0006](../../docs/adr/ADR-0006-como-a-saida-da-ia-aparece-na-tela.md) exige na tela.
 *
 * 🎯 Note que o motor **já produz** isto (`diagnosticos[].confianca_evidencia`): alta =
 * embasado em RAG · media = paramétrico · baixa = incerteza a sinalizar. Ou seja, a ADR-0006
 * não é divergência do contrato de origem — é escolher, entre dois campos que o motor emite,
 * o que pode ir para a tela.
 */
export type ConfiancaEvidencia = 'alta' | 'media' | 'baixa';

/** De onde veio um achado. É o que permite rotular origem de IA na tela (ADR-0002 D-03). */
export type ProvenienciaAchado =
  | 'episodio_atual'
  | 'historico_validado'
  | 'inferido_ia'
  | 'red_flag'
  | 'exame_lab';

export type DominioAchado = 'subjetivo' | 'objetivo' | 'lab' | 'alarme' | 'contexto' | 'evidencia';

/** Relação entre achado e hipótese. `lacuna` é o que ficou sem explicação — não se esconde. */
export type TipoAresta = 'suporta' | 'contradiz' | 'sindrome' | 'lacuna' | 'historico' | 'auditor';

// ═══════════════════════════════════════════════════════════════════════════════
// GRAFO DE EVIDÊNCIAS
// ═══════════════════════════════════════════════════════════════════════════════

export interface Achado {
  id: string;
  titulo: string;
  resumo: string;
  proveniencia: ProvenienciaAchado;
  dominio?: DominioAchado;
  ancoraSecao?: string;
  /** Rastreio determinístico ao JSON de entrada — permite mostrar o trecho-fonte na tela. */
  fonte_campo?: string;
  fonte_id?: string;
}

/**
 * Uma opção de medicamento sugerida para uma hipótese.
 *
 * 🔴 EXTENSÃO DA BEHEMP — NÃO EXISTE NO VIDAI
 * O VidAI é clínica geral e não emite este campo. Ele entra porque o `DO-29` manda a IA
 * _"recomendar o medicamento mais adequado ao que foi preenchido"_, direcionado ao canabidiol.
 * Quando o motor for ligado (Metade 2), é ele quem preenche — e até então só o fixture traz.
 *
 * 🔴 POR QUE NÃO HÁ DOSE AQUI, E ISSO NÃO É OMISSÃO
 * O IMDRF/SaMD N12:2014 separa duas categorias de risco por uma linha exata:
 *
 * - `IMD-01` — **informar**: _"inform health care providers of **treatment options**"_. Listar
 *   opções ranqueadas, com o porquê, é literalmente esta definição. É o **menor** risco.
 * - `IMD-02` — **dirigir**: _"aid in treatment by providing **enhanced support in the safe and
 *   effective use of drugs**"_ — que é o que descreve dose, frequência, titulação e checagem de
 *   interação.
 *
 * Por isso este tipo **não tem** campo de mg, de frequência nem de esquema de titulação: incluir
 * um faria a tela mudar de categoria regulatória. Dose é ato do médico, na prescrição (Sprint 5).
 * O guarda `medicacao-informa-nao-prescreve` mantém essa ausência.
 *
 * ⚠️ `GAP-03` ABERTO: de onde vem o catálogo de produtos, e quem o valida clinicamente, é
 * decisão de farmacêutico — não está resolvido. `procedencia` existe para que a tela **nunca**
 * apresente sugestão de modelo como se fosse item de catálogo validado.
 */
export interface MedicamentoSugerido {
  id: string;
  /** Ordem de recomendação. O motor ranqueia **no máximo 3** — `MAX_MEDICAMENTOS_POR_HIPOTESE`. */
  rank: 1 | 2 | 3;
  /** Nome do produto ou da classe. Ex.: "CBD isolado — óleo 200 mg/mL". */
  nome: string;
  /** Proporção canabinoide, quando aplicável. Ex.: "CBD:THC 20:1". */
  proporcao?: string | null;
  /** Via de administração, quando o motor a distingue. Ex.: "oral (sublingual)". */
  via?: string | null;
  /** Por que este vem nesta posição. É o conteúdo que faz a tela informar em vez de mandar. */
  porQue: string;
  /** O que pesa contra — aparece com o mesmo peso do que sustenta, como nos achados. */
  ressalvas?: string[];
  /** Faixa categórica da evidência. Nunca percentual — ADR-0006. */
  confianca_evidencia?: ConfiancaEvidencia;
  /**
   * De onde veio a recomendação. Mesma lógica de `Achado.proveniencia`: sem isto, sugestão de
   * modelo e item de catálogo validado ficam idênticos na tela.
   */
  procedencia: 'inferido_ia' | 'catalogo_validado' | 'protocolo_institucional';
  /** Referência citável, quando houver. Ex.: "RDC 1.015/2026" ou um DOI. */
  referencia?: string | null;
}

/** O motor ranqueia no máximo 3 medicamentos por hipótese — decisão do dono em 24/08/2026. */
export const MAX_MEDICAMENTOS_POR_HIPOTESE = 3;

export interface Hipotese {
  id: string;
  /** O motor ranqueia no máximo 3. */
  slot: 1 | 2 | 3;
  titulo: string;
  cid: string | null;
  /**
   * ⚠️ **NÃO EXIBIR COMO PERCENTUAL** — ADR-0006. O fixture real traz `78`, e mostrar "78 %"
   * de confiança a um médico é o que o PAIR Guidebook contraindica. Use
   * `confianca_evidencia`. O campo fica no contrato porque o motor o emite; o que a ADR
   * proíbe é a **exibição**, não a existência.
   */
  probabilidade: number;
  /** Diagnóstico que não se pode deixar passar, mesmo com probabilidade baixa. */
  dont_miss?: boolean;
  gravidade?: string;
  resumo?: string;
  ancoraSecao?: string;
  /** A faixa categórica que PODE ir para a tela. */
  confianca_evidencia?: ConfiancaEvidencia;
  /**
   * As opções de medicamento para esta hipótese — **no máximo 3**, ranqueadas.
   * Extensão da BeHemp; o VidAI não emite. Ausente ou vazio é estado legítimo: significa que o
   * motor não tinha base para sugerir, e a tela precisa dizer isso em vez de esconder.
   */
  medicamentos?: MedicamentoSugerido[];
}

export interface Aresta {
  de: string;
  para: string;
  tipo: TipoAresta;
  rotulo?: string;
  fonte_campo?: string;
  fonte_id?: string;
  /** Racional fisiopatológico — preenchido depois da compilação do grafo. */
  racional?: string;
}

export interface EntradaTimeline {
  ordem: number;
  evento: string;
  fonte_campo?: string;
  fonte_id?: string;
  /** id da hipótese → o que aquele achado fez com ela. */
  impacto_hipoteses: Record<string, 'reforca' | 'enfraquece' | 'lacuna'>;
}

/** Sugestão exploratória — apoio à decisão, **nunca** conduta fechada. */
export interface Exploracao {
  texto: string;
  tipo: 'exploratorio';
  origem?: 'catalogo' | 'rag';
  fonte_id?: string;
}

export interface AchadoInconclusivo {
  texto: string;
  fonte_campo?: string;
  fonte_id?: string;
  hipoteses_afetadas: string[];
  perguntas_medico?: string[];
  exploracao_sugerida?: Exploracao[];
}

/**
 * Completude do grafo — **a incompletude é dado, não defeito**.
 *
 * Existe porque documentação clínica é incompleta e a omissão gera viés: expor a incompletude
 * combate fechamento prematuro. É o principal ativo de P3 (falha parcial) neste contrato.
 */
export interface Completude {
  nivel: 'completo' | 'parcial';
  /** Achados ligados só por `lacuna` — sem suporta nem contradiz. */
  inconclusivos: number;
  /** Sinais de alarme sem hipótese que os explique. */
  red_flags_nao_explicadas: number;
  /** Motivos legíveis. Vazio quando `completo`. */
  motivos: string[];
}

/**
 * O grafo de evidências — a saída principal do motor.
 *
 * ⚠️ **Dois campos dizem "parcial", e podem divergir:** `parcial?: boolean` e
 * `completude.nivel`. No fixture real, `parcial: false` convive com
 * `completude.nivel: 'parcial'`. Preservado como está; use `grafoEstaParcial()` abaixo, que
 * trata os dois — ler só um deles é a origem provável de "a tela disse completo e não era".
 */
export interface GrafoEvidencias {
  dominio: 'anamnese' | 'exame' | 'teleconsulta';
  urgencia: UrgenciaAnalise;
  /** Ver o aviso em `Hipotese.probabilidade`: não exibir como percentual. */
  confianca?: number;
  parcial?: boolean;
  tituloPrincipal?: string;
  sindrome: { titulo: string; resumo?: string };
  achados: Achado[];
  hipoteses: Hipotese[];
  arestas: Aresta[];
  /** Crítica automática do próprio resultado. */
  auditor?: { titulo: string; resumo: string; detalhes?: string[] };
  conduta?: { exames: string[]; proximoPassoHitl: string };
  /** O que o motor decidiu não mostrar em destaque. Existe para poder ser auditado. */
  alertasOcultos: string[];
  schema_version?: string;
  timeline?: EntradaTimeline[];
  achados_inconclusivos?: AchadoInconclusivo[];
  completude?: Completude;
  /**
   * Disparos da rede de segurança **determinística** (regra, não LLM). Sinal auditável e
   * estável, ao contrário do probabilístico — e por isso exibido com peso diferente.
   */
  salvaguardas_deterministicas?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANORAMA — a visão em árvore, com drill-down
// ═══════════════════════════════════════════════════════════════════════════════

export interface NoPanorama {
  id: string;
  titulo: string;
  status: StatusNo;
  resumo: string;
  detalhes?: string[];
  ancoraSecao?: string;
  filhos?: NoPanorama[];
  /** Caminhos JSON cobertos por este nó — é o que permite calcular `alertasOcultos`. */
  camposCobertos?: string[];
}

export interface PanoramaClinico {
  dominio: DominioAnalise;
  urgencia: UrgenciaAnalise;
  /** Rótulo cru do nível, para exibir coerente com o card; a cor vem de `urgencia`. */
  urgenciaLabel?: string;
  confianca?: number;
  tituloPrincipal?: string;
  parcial?: boolean;
  /** P1 — o próximo passo é **do humano**. Sempre presente. */
  proximoPassoHitl: string;
  nos: NoPanorama[];
  alertasOcultos: string[];
  grafoEvidencias?: GrafoEvidencias | null;
  /** Campos da anamnese, para mostrar o trecho-fonte de cada achado. */
  camposAnamnese?: Array<{ label: string; value: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENVELOPE — o que a rota devolve de fato
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ A rota **não** devolve o grafo na raiz. Devolve este envelope de três chaves — medido no
 * fixture real. Quem programar contra o grafo direto quebra na integração.
 */
export interface RespostaAnalise {
  grafo: GrafoEvidencias;
  /** Blocos de conteúdo para render. Forma varia por domínio; não normalizada no motor. */
  blocos: unknown[];
  analiseIA: AnaliseIA;
}

/** O laudo textual, ao lado do grafo. Campos opcionais: o motor omite o que não produziu. */
export interface AnaliseIA {
  nivel_urgencia?: 'normal' | 'atencao' | 'critico';
  sindrome_principal?: string;
  diagnostico_provavel?: string;
  confianca?: number;
  hipoteses_ranqueadas?: unknown[];
  red_flags?: string[];
  avaliacao_seguranca?: unknown;
  encaminhar_para?: string;
  tratamento?: unknown;
  exames_recomendados_detalhados?: unknown[];
  /** O motor acrescenta campos entre versões. Ignorar o que não se consome, não quebrar. */
  [chave: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS — a lógica que não se repete em cada tela
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * O grafo está parcial? Trata os **dois** campos que dizem isso.
 *
 * Existe porque `parcial` e `completude.nivel` podem divergir — e divergem no fixture real.
 * Uma tela que leia só `parcial` mostra "completo" sobre um grafo com 2 red flags não
 * explicadas. P3 (falha parcial) depende disto estar num só lugar.
 */
export function grafoEstaParcial(grafo: Pick<GrafoEvidencias, 'parcial' | 'completude'>): boolean {
  return grafo.parcial === true || grafo.completude?.nivel === 'parcial';
}

/**
 * Achado veio da IA, e não de registro humano validado?
 *
 * É o que permite rotular origem na tela — exigência da ADR-0002 D-03, cobrada pelo guarda
 * `origem-ia-rotulada`. Sem isto, sugestão de modelo e fato registrado aparecem iguais.
 */
export function achadoEhInferidoPelaIa(achado: Pick<Achado, 'proveniencia'>): boolean {
  return achado.proveniencia === 'inferido_ia';
}

/**
 * Faixa de confiança para exibição, **sem percentual** (ADR-0006).
 *
 * Prefere `confianca_evidencia`, que o motor já calibra. Se ausente, devolve `null` — e a tela
 * **não mostra confiança**, em vez de derivar uma faixa do número. Derivar faixa de
 * `probabilidade` reintroduziria pela porta de trás a precisão que a ADR rejeita.
 */
export function faixaDeConfianca(
  hipotese: Pick<Hipotese, 'confianca_evidencia'>,
): ConfiancaEvidencia | null {
  return hipotese.confianca_evidencia ?? null;
}
