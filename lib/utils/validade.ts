import { addMonths, isBefore, differenceInDays } from 'date-fns';

/**
 * Cálculos puros de validade de documentos.
 *
 * Prazos (CLAUDE.md):
 * - Autorização Anvisa: 24 meses
 * - Receita médica: 6 meses
 * - Demais documentos: sem prazo (nunca expiram)
 */

type TipoDocumento =
  | 'rg'
  | 'rg_responsavel'
  | 'receita_medica'
  | 'comprovante_residencia'
  | 'autorizacao_anvisa';

/** Mapa de prazo de validade por tipo de documento (em meses) */
const PRAZOS_VALIDADE: Record<TipoDocumento, number | null> = {
  autorizacao_anvisa: 24,
  receita_medica: 6,
  rg: null, // Não expira
  rg_responsavel: null,
  comprovante_residencia: null,
};

/**
 * Calcula a data de validade do documento a partir da data de emissão.
 * Retorna null se o documento não tem prazo de validade.
 */
export function calcularDataValidade(
  tipoDocumento: TipoDocumento,
  dataEmissao: Date,
): Date | null {
  const meses = PRAZOS_VALIDADE[tipoDocumento];
  if (meses === null) return null;
  return addMonths(dataEmissao, meses);
}

/**
 * Verifica se o documento está vencido.
 */
export function documentoVencido(dataValidade: Date): boolean {
  return isBefore(dataValidade, new Date());
}

/**
 * Verifica se o documento está próximo do vencimento.
 * Padrão: 30 dias de antecedência (conforme CLAUDE.md).
 */
export function documentoProximoDoVencimento(
  dataValidade: Date,
  diasAntecedencia: number = 30,
): boolean {
  const diasRestantes = differenceInDays(dataValidade, new Date());
  return diasRestantes <= diasAntecedencia && diasRestantes > 0;
}

/**
 * Calcula quantos dias restam até o vencimento do documento.
 */
export function diasAteVencimento(dataValidade: Date): number {
  return Math.max(0, differenceInDays(dataValidade, new Date()));
}
