/**
 * Envio em lote do comunicado "Atualização do Programa de Doação" — regras PURAS.
 *
 * Sem `db`, sem `auth`, sem `next/*`: o diálogo (client) e as actions (server) importam daqui.
 *
 * Decisão da Dryelle em 20/10/2026: o lote é permitido (antes o pedido era "um paciente por vez"),
 * com no máximo 25 pacientes por disparo; na triagem, quem não tem cadastro de paciente é
 * listado e ignorado. 🔴 O lote NÃO é um caminho novo de envio: cada paciente passa por
 * `enviarComunicadoAtualizacaoDoacao`, a mesma action do botão individual — mesma autorização,
 * mesma trava de envio duplicado no banco, mesma auditoria por envelope.
 */

/** Teto de pacientes por disparo. Cada um é um envelope no DocuSign e um e-mail no Brevo. */
export const LIMITE_DO_LOTE = 25;

export type SituacaoNoLote =
  | 'elegivel'
  | 'ja_enviado'
  | 'sem_email'
  | 'sem_cpf'
  | 'nao_encontrado'
  | 'sem_cadastro'
  | 'duplicado';

export const ROTULO_DA_SITUACAO: Record<SituacaoNoLote, string> = {
  elegivel: 'Será enviado',
  ja_enviado: 'Já recebeu (pendente ou assinado)',
  sem_email: 'Sem e-mail cadastrado',
  sem_cpf: 'Sem CPF cadastrado (a carta o exibe)',
  nao_encontrado: 'Paciente não encontrado',
  sem_cadastro: 'Sem cadastro de paciente',
  duplicado: 'Repetido na seleção',
};

/** O mesmo critério de `enviarComunicado`, aplicado ANTES de gastar um envelope. */
export function situacaoNoLote(p: {
  existe: boolean;
  email: string | null;
  cpf: string | null;
  temEnvioAtivo: boolean;
}): SituacaoNoLote {
  if (!p.existe) return 'nao_encontrado';
  if (!p.email?.trim()) return 'sem_email';
  if (!p.cpf?.trim()) return 'sem_cpf';
  if (p.temEnvioAtivo) return 'ja_enviado';
  return 'elegivel';
}

export interface AlvoDaPrevia {
  pacienteId: string;
  nome: string | null;
  situacao: SituacaoNoLote;
}

export interface TriagemResolvida {
  triagemId: string;
  /** null quando o e-mail da triagem não bate com nenhuma ficha ativa. */
  pacienteId: string | null;
}
