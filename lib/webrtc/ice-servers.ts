/**
 * Busca os servidores ICE da videochamada no servidor, com credencial efêmera.
 *
 * POR QUE UM HELPER, E NÃO O ARRAY EM CADA TELA
 * O array de `iceServers` estava escrito em DOIS arquivos — o host do médico e a página do
 * paciente — com o relay gratuito `openrelay.metered.ca` e a credencial pública
 * `openrelayproject`. A duplicação foi o que fez o diagnóstico inicial contar 1 ocorrência
 * quando havia 2 (Item 8 de docs/04-LISTA-DE-AFAZERES.md). Um lugar só para a lista
 * significa um lugar só para trocar de provedor.
 *
 * A credencial nunca é escrita aqui: vem de /api/teleconsulta/ice-servers, que a gera no
 * servidor com validade de 2 horas e só entrega a quem participa da sala.
 */

/** Fallback local: STUN apenas. Descobre o IP externo, NÃO transporta mídia. */
const SOMENTE_STUN: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export interface ConfiguracaoIce {
  iceServers: RTCIceServer[];
  /** `false` significa que conexão que dependa de retransmissão vai falhar. */
  turnDisponivel: boolean;
  motivo?: string;
}

/**
 * Devolve a configuração ICE para a sala. Nunca lança: se a rede ou o endpoint falharem,
 * volta com STUN e `turnDisponivel: false`, para que a tela possa avisar em vez de a
 * conexão morrer sem explicação — que era o modo de falha do relay público quando saturava.
 */
export async function buscarIceServers(roomId: string): Promise<ConfiguracaoIce> {
  try {
    const resposta = await fetch(
      `/api/teleconsulta/ice-servers?roomId=${encodeURIComponent(roomId)}`,
      { cache: 'no-store' },
    );
    if (!resposta.ok) {
      return {
        iceServers: SOMENTE_STUN,
        turnDisponivel: false,
        motivo: 'Falha ao obter servidores',
      };
    }
    const dados = (await resposta.json()) as ConfiguracaoIce;
    if (!Array.isArray(dados.iceServers) || dados.iceServers.length === 0) {
      return { iceServers: SOMENTE_STUN, turnDisponivel: false, motivo: 'Resposta sem servidores' };
    }
    return dados;
  } catch {
    return { iceServers: SOMENTE_STUN, turnDisponivel: false, motivo: 'Rede indisponível' };
  }
}
