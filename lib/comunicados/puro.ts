/**
 * Funções puras do fluxo do comunicado — sem banco, sem rede, sem Next.
 *
 * Moram à parte de `assinatura.ts` para que os guardas as executem sem `DATABASE_URL`.
 */

/** Identificador do signatário no envelope. Deriva do id da linha, nunca de dado do cliente. */
export function clientUserIdDoComunicado(id: string): string {
  return `comunicado-${id}`;
}

export type SituacaoNossa = 'pendente' | 'assinado' | 'recusado';

/** Traduz o status do envelope no DocuSign para o nosso. `null` = ainda não mudou nada nosso. */
export function situacaoPeloStatusDoDocusign(statusDocusign: string): SituacaoNossa {
  const s = statusDocusign.toLowerCase();
  if (s === 'completed') return 'assinado';
  if (s === 'declined' || s === 'voided') return 'recusado';
  return 'pendente'; // created, sent, delivered, signed…
}

export function dataPorExtenso(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(data);
}

export function dataEHoraPorExtenso(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(data);
}

/** Violação de índice único (Postgres 23505), com ou sem o embrulho do Drizzle. */
export function ehViolacaoDeUnico(erro: unknown): boolean {
  const e = erro as { code?: string; cause?: { code?: string } } | null;
  return e?.code === '23505' || e?.cause?.code === '23505';
}
