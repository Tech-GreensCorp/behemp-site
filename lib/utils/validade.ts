import { addMonths, isBefore, differenceInDays } from 'date-fns';
import { documentoTipoEnum } from '@/db/schema/enums';

/**
 * Cálculos puros de validade de documentos.
 *
 * Prazos (CLAUDE.md):
 * - Autorização Anvisa: 24 meses
 * - Receita médica: 6 meses
 * - Demais documentos: sem prazo (nunca expiram)
 */

/**
 * 🔴 DERIVADA DO ENUM, nunca escrita à mão — 23/09/2026, ADR-0026.
 *
 * Era uma união literal com **5 dos 8** valores, e já estava desatualizada quando foi medida:
 * faltavam `documento_pessoal`, `oficio_anvisa` e `procuracao_especifica`. Uma lista paralela
 * não avisa que envelheceu — ela só deixa de cobrir, em silêncio.
 *
 * Derivando, o `Record` abaixo fica **exaustivo**: qualquer valor novo no enum quebra o
 * type-check aqui, e quem o acrescentar é obrigado a dizer se ele vence. É a mesma lição do
 * `type Origem` de `solicitacao.ts`, que o ADR-0022 §27 registrou desatualizado.
 */
type TipoDocumento = (typeof documentoTipoEnum.enumValues)[number];

/** Mapa de prazo de validade por tipo de documento (em meses) */
const PRAZOS_VALIDADE: Record<TipoDocumento, number | null> = {
  autorizacao_anvisa: 24,
  receita_medica: 6,
  rg: null, // Não expira
  rg_responsavel: null,
  comprovante_residencia: null,
  documento_pessoal: null,
  procuracao_especifica: null,
  /** Laudo não vence — e `TIPOS_RENOVAVEIS` do cron também não o inclui. */
  laudo_medico: null,
  /**
   * ⚠️ DIVERGÊNCIA MEDIDA, NÃO RESOLVIDA AQUI. `app/api/cron/verificar-validade-documentos`
   * trata `oficio_anvisa` como **renovável** (`TIPOS_RENOVAVEIS`), e `lib/documentos/validade.ts`
   * lhe dá o `default` de 100 anos. Os três lugares discordam desde antes desta mudança.
   *
   * `null` aqui é "esta função não calcula prazo para ele", e é verdade: o único chamador
   * (`app/(medico)/_actions/documentos.ts:18-24`) tem um `z.enum` de **cinco** tipos, e
   * `oficio_anvisa` não está entre eles — nunca chega aqui. Escolher um número seria presumir
   * regra de negócio, que é decisão do dono com o médico responsável (`DO-17`).
   */
  oficio_anvisa: null,
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
