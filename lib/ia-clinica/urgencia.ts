/**
 * O MAPA DE URGÊNCIA — um lugar só, derivado do contrato.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * `UrgenciaAnalise` tem **7 valores** (`contrato.ts:69-76`) que são **dois vocabulários para a
 * mesma coisa** — um de cor, um de estado — e não sete graus. O próprio contrato confirma:
 * `nivel_urgencia?: 'normal' | 'atencao' | 'critico'` tem três.
 *
 * Se cada tela mapeasse por conta própria, elas divergiriam — e as duas continuariam plausíveis,
 * porque nenhuma quebra. É o custo que `LIMIAR_THC_PERCENTUAL` evitou na Sprint 5.
 *
 * 🔴 O QUARTO NÍVEL NÃO VEM DE `urgencia` (`DO-51`, ADR-0013 D-02)
 * Ele é **derivado**: emergência **e** `red_flags_nao_explicadas > 0`. Os dois campos já existem
 * no contrato. Um 4º valor novo em `UrgenciaAnalise` nasceria sempre vazio — e nível que nunca
 * acende é pior que nível nenhum, porque dá falsa sensação de cobertura.
 *
 * ⚠️ RETRATAÇÃO REGISTRADA: eu descrevi este mapa como **7→4** antes de medir. É **7→3**, mais um
 * derivado. O "código roxo" de 4 níveis é do VidAI, não deste contrato — copiei um número em vez
 * de medi-lo, que é exatamente o erro da retratação das contagens de guarda.
 */

import type { UrgenciaAnalise } from './contrato';

/** Os quatro níveis que a TELA conhece. Não confundir com os 7 valores do contrato. */
export type NivelDeUrgencia = 'rotina' | 'atencao' | 'emergencia' | 'critico';

/**
 * O mapa. **Explícito e exaustivo** — `Record<UrgenciaAnalise, ...>` faz o TypeScript recusar o
 * arquivo se `UrgenciaAnalise` ganhar um valor novo que não esteja aqui. É a cobertura garantida
 * pelo compilador, antes mesmo do guarda.
 */
const MAPA: Record<UrgenciaAnalise, Exclude<NivelDeUrgencia, 'critico'>> = {
  verde: 'rotina',
  ok: 'rotina',
  normal: 'rotina',
  amarelo: 'atencao',
  atencao: 'atencao',
  vermelho: 'emergencia',
  critico: 'emergencia',
};

export interface AparenciaDoNivel {
  nivel: NivelDeUrgencia;
  rotulo: string;
  /** O que o médico precisa saber sem abrir nada. */
  explicacao: string;
  /** Token de `--chart-*`. Nenhum hex novo (proibição nº 3). */
  token: string;
  /** `true` só no nível máximo — quem consome decide se pulsa, fixa no topo, etc. */
  ehMaximo: boolean;
}

const APARENCIA: Record<NivelDeUrgencia, Omit<AparenciaDoNivel, 'nivel'>> = {
  rotina: {
    rotulo: 'Rotina',
    explicacao: 'Nada no quadro exige ação imediata.',
    token: 'var(--chart-2)',
    ehMaximo: false,
  },
  atencao: {
    rotulo: 'Atenção',
    explicacao: 'Há achados que pedem avaliação antes de definir a conduta.',
    token: 'var(--chart-4)',
    ehMaximo: false,
  },
  emergencia: {
    rotulo: 'Emergência',
    explicacao: 'O quadro sugere urgência clínica. Avalie antes de prescrever.',
    token: 'var(--chart-5)',
    ehMaximo: false,
  },
  critico: {
    rotulo: 'Crítico — red flag não explicada',
    explicacao:
      'Urgência clínica com achado grave que a análise NÃO conseguiu explicar. Investigue antes de qualquer prescrição.',
    token: 'var(--chart-3)',
    ehMaximo: true,
  },
};

/**
 * O nível que a tela deve mostrar.
 *
 * @param urgencia valor cru do contrato.
 * @param redFlagsNaoExplicadas `completude.red_flags_nao_explicadas`. Ausente = 0.
 * @returns `null` quando o valor de urgência **não está no contrato** — quem chama DENUNCIA em
 *   vez de cair para `rotina`. Afirmar "sem urgência" a partir de um valor que ninguém entendeu
 *   é a pior saída numa tela cuja função é alertar (ADR-0013 D-03, rejeitado R-05).
 */
export function nivelDeUrgencia(
  urgencia: string | null | undefined,
  redFlagsNaoExplicadas?: number | null,
): NivelDeUrgencia | null {
  if (!urgencia) return null;
  const base = MAPA[urgencia as UrgenciaAnalise];
  if (!base) return null;

  const redFlags = Number(redFlagsNaoExplicadas ?? 0);
  const temRedFlagAberta = Number.isFinite(redFlags) && redFlags > 0;

  // A conjunção do `DO-51`: só eleva quando JÁ É emergência. Red flag num quadro de rotina é
  // motivo de investigar, não de alarme máximo — alarme que dispara demais é alarme que se
  // ignora (rejeitado R-04).
  if (base === 'emergencia' && temRedFlagAberta) return 'critico';
  return base;
}

/** A aparência de um nível. Separado do cálculo para que o guarda teste os dois isolados. */
export function aparenciaDoNivel(nivel: NivelDeUrgencia): AparenciaDoNivel {
  return { nivel, ...APARENCIA[nivel] };
}

/**
 * O caminho completo, para quem só quer renderizar.
 *
 * `null` significa **valor fora do contrato** — e quem consome mostra o valor cru com aviso, como
 * a ADR-0009 §4 fez com procedência.
 */
export function urgenciaParaTela(
  urgencia: string | null | undefined,
  redFlagsNaoExplicadas?: number | null,
): AparenciaDoNivel | null {
  const nivel = nivelDeUrgencia(urgencia, redFlagsNaoExplicadas);
  return nivel === null ? null : aparenciaDoNivel(nivel);
}

/** Os valores do contrato que o mapa cobre. O guarda usa isto para provar exaustividade. */
export const VALORES_COBERTOS = Object.keys(MAPA) as UrgenciaAnalise[];
