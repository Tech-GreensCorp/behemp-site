/**
 * O nome do canal Pusher da chamada de atendimento — ADR-0029 D-14.
 *
 * Um lugar só, usado pela rota de sinalização, pelas actions e pela tela: prefixo escrito em três
 * lugares é prefixo que um dia diverge, e o `/api/pusher/auth` nega o que não reconhece.
 */
/** Quem está na chamada: o paciente dono do pedido, ou um admin (`DO-70`). */
export type PapelNaChamada = 'admin' | 'paciente';

export const PREFIXO_DO_CANAL = 'presence-atendimento-';

export function canalDoAtendimento(sala: string): string {
  return `${PREFIXO_DO_CANAL}${sala}`;
}
