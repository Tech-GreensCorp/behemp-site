import { addDays, differenceInDays } from 'date-fns';

/**
 * Cálculos puros de dosagem e recompra.
 *
 * Fórmula base (CLAUDE.md):
 *   gotas_totais = ml_frasco × gotas_por_ml
 *   dias_duracao = gotas_totais / gotas_por_dia
 *   data_termino = data_inicio + dias_duracao
 */

interface CalculoDosagemParams {
  mlFrasco: number;
  gotasPorDia: number;
  gotasPorMl: number; // Padrão: 20, mas configurável por medicamento
  dataInicio: Date;
}

interface CalculoDosagemResult {
  gotasTotais: number;
  diasDuracao: number;
  dataFimPrevista: Date;
  dataNotificacao: Date; // 7 dias antes do fim
}

/**
 * Calcula a duração do frasco e data prevista de término.
 */
export function calcularDosagem(params: CalculoDosagemParams): CalculoDosagemResult {
  const gotasTotais = params.mlFrasco * params.gotasPorMl;
  const diasDuracao = Math.floor(gotasTotais / params.gotasPorDia);
  const dataFimPrevista = addDays(params.dataInicio, diasDuracao);
  const dataNotificacao = addDays(dataFimPrevista, -7); // 7 dias antes

  return {
    gotasTotais,
    diasDuracao,
    dataFimPrevista,
    dataNotificacao,
  };
}

/**
 * Calcula quantos dias restam do frasco atual.
 */
export function calcularDiasRestantes(dataFimPrevista: Date): number {
  return Math.max(0, differenceInDays(dataFimPrevista, new Date()));
}

/**
 * Verifica se o medicamento está próximo de acabar.
 * Padrão: 7 dias de antecedência.
 */
export function medicamentoProximoDeAcabar(
  dataFimPrevista: Date,
  diasAntecedencia: number = 7,
): boolean {
  const diasRestantes = calcularDiasRestantes(dataFimPrevista);
  return diasRestantes <= diasAntecedencia && diasRestantes > 0;
}
