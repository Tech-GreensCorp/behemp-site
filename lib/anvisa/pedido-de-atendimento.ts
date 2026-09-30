/**
 * A regra do pedido de atendimento assistido da ANVISA — ADR-0029 D-03 e D-04 (`DO-71`, `DO-72`).
 *
 * Helper de domínio PURO: sem `db`, sem `auth`, sem `next/*`. Quem grava é a action; quem decide
 * se pode é esta função, e é por isso que o guarda a EXECUTA em vez de ler.
 *
 *   aguardando_ativacao ──ativar──▶ pendente_autorizacao ──(ANVISA aprova)──▶ concluido
 *            ▲                              │
 *            └──────────desativar───────────┘   (só antes de o paciente assinar a procuração)
 */

export type StatusDoPedido = 'aguardando_ativacao' | 'pendente_autorizacao' | 'concluido';
export type AcaoNoPedido = 'ativar' | 'desativar' | 'concluir';
export type MotivoDaRecusa =
  | 'pedido_concluido'
  | 'ja_ativado'
  | 'nao_ativado'
  | 'procuracao_assinada'
  | 'procuracao_em_assinatura';
export type Transicao = { ok: true; novo: StatusDoPedido } | { ok: false; motivo: MotivoDaRecusa };

/** Os status que contam como pedido ABERTO — os mesmos do índice único parcial da 0050. */
export const STATUS_ABERTOS: readonly StatusDoPedido[] = [
  'aguardando_ativacao',
  'pendente_autorizacao',
];

export function transicionar(
  atual: StatusDoPedido,
  acao: AcaoNoPedido,
  contexto: { procuracaoAssinada: boolean; procuracaoEmAssinatura?: boolean },
): Transicao {
  if (atual === 'concluido') return { ok: false, motivo: 'pedido_concluido' };

  switch (acao) {
    case 'ativar':
      return atual === 'aguardando_ativacao'
        ? { ok: true, novo: 'pendente_autorizacao' }
        : { ok: false, motivo: 'ja_ativado' };
    case 'desativar':
      if (atual !== 'pendente_autorizacao') return { ok: false, motivo: 'nao_ativado' };
      // DO-72: "pode" desativar — enquanto o paciente não assinou. Assinada, a procuração é um
      // documento jurídico que já existe, e desfazê-la por esta tela apagaria o motivo dela.
      if (contexto.procuracaoAssinada) return { ok: false, motivo: 'procuracao_assinada' };
      // Revisão de 30/09/2026: envelope já ENVIADO também trava. O paciente pode assinar pelo
      // e-mail depois da desativação, e o banco ficaria com procuração assinada, pedido
      // aguardando e modalidade `guiada` ao mesmo tempo.
      if (contexto.procuracaoEmAssinatura) return { ok: false, motivo: 'procuracao_em_assinatura' };
      return { ok: true, novo: 'aguardando_ativacao' };
    case 'concluir':
      return { ok: true, novo: 'concluido' };
  }
}

/**
 * Pode o paciente seguir para a procuração ("Be4Hope faz por mim")?
 *
 * ⚠️ Quem JÁ está em `representacao` continua podendo, com ou sem pedido (ADR-0029 D-08): em
 * 30/09/2026 havia 12 autorizações assim em produção, de antes da mudança. A trava vale para
 * ENTRAR na procuração, não para quem já está nela.
 */
export function podeEntrarNaRepresentacao(estado: {
  modalidadeAtual: 'guiada' | 'representacao';
  statusDoPedido: StatusDoPedido | null;
}): boolean {
  return (
    estado.modalidadeAtual === 'representacao' || estado.statusDoPedido === 'pendente_autorizacao'
  );
}

/** O texto que a tela mostra quando a transição é recusada. Sem detalhe interno. */
export const MENSAGEM_DA_RECUSA: Record<MotivoDaRecusa, string> = {
  pedido_concluido: 'Este pedido já foi concluído.',
  ja_ativado: 'A procuração já está ativada para este paciente.',
  nao_ativado: 'A procuração não está ativada.',
  procuracao_assinada: 'O paciente já assinou a procuração. Ela não pode ser desativada por aqui.',
  procuracao_em_assinatura:
    'A procuração já foi enviada ao paciente para assinatura. Ela não pode ser desativada por aqui.',
};
