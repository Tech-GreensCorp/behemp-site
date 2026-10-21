/**
 * QUANDO A TRANSFERÊNCIA DE CADASTRO PODE ACONTECER — a regra, sem banco.
 *
 * Separada de `transferencia-de-cadastro.ts` em 10/09/2026 por um motivo concreto: o guarda
 * não conseguia exercitar a regra. Importar qualquer coisa daquele módulo trazia junto a
 * conexão do Drizzle, e a decisão mais importante do arquivo ficava sem teste por um motivo
 * que nada tem a ver com ela.
 *
 * 🔴 Quando o teste não alcança a decisão, o problema é do DESENHO, não do teste. É também o
 * que o `CLAUDE.md` chama de helper de domínio puro: sem `db`, sem `auth`, sem `next/*`.
 */

import { FINALIDADES, type Finalidade } from './consentimento';

export type MotivoDeRecusa =
  | 'desligada'
  | 'sem_consentimento'
  | 'paciente_nao_encontrado'
  | 'sem_parceiro';

/**
 * Liga o envio. Ausente ou diferente de `1` = nada sai.
 *
 * ⚠️ A comparação é exata de propósito. `Boolean(process.env.X)` aceitaria `'false'`, `'0'` e
 * `'desligado'` como verdadeiro — e aqui o custo de um falso positivo é dado de saúde saindo
 * da empresa antes de haver base legal.
 */
export function transferenciaAtiva(): boolean {
  return process.env.PARCEIRO_TRANSFERENCIA_ATIVA?.trim() === '1';
}

/**
 * A decisão: pode transferir?
 *
 * 🔴 O CONSENTIMENTO É LIDO, NUNCA PRESUMIDO. E a finalidade tem de ser a ESPECÍFICA:
 * consentir com a avaliação médica não é consentir com o compartilhamento. É o art. 11, I —
 * consentimento para dado sensível é específico, e um bloco só destruiria a distinção.
 */
export function podeTransferir(finalidadesConsentidas: Finalidade[]): {
  pode: boolean;
  motivo?: MotivoDeRecusa;
} {
  if (!transferenciaAtiva()) return { pode: false, motivo: 'desligada' };
  if (!finalidadesConsentidas.includes(FINALIDADES.retornoAoParceiro)) {
    return { pode: false, motivo: 'sem_consentimento' };
  }
  return { pode: true };
}

/** Só para o diagnóstico: por que a transferência não aconteceu. */
export function explicarRecusa(motivo: MotivoDeRecusa): string {
  const mapa: Record<MotivoDeRecusa, string> = {
    desligada: 'PARCEIRO_TRANSFERENCIA_ATIVA não está em 1 — aguardando base legal',
    sem_consentimento: 'o paciente não consentiu com a finalidade retorno_ao_parceiro',
    paciente_nao_encontrado: 'solicitação inexistente ou apagada',
    sem_parceiro: 'o paciente não veio de parceiro nenhum',
  };
  return mapa[motivo];
}
