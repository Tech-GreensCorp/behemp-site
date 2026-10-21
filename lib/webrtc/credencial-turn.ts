/**
 * CREDENCIAL DE TURN DA CLOUDFLARE — a mesma conta e a mesma TTL da teleconsulta (ADR-0008).
 *
 * Usada pela chamada de atendimento (ADR-0029 D-14). ⚠️ É uma cópia DELIBERADA da lógica de
 * `app/api/teleconsulta/ice-servers/route.ts`, e não uma extração: aquela rota é da teleconsulta em
 * produção, travada por guardas, e mexer nela no mesmo deploy de uma funcionalidade nova aumenta o
 * risco sem ganho para o paciente. Unificar as duas fica como limpeza catalogada.
 *
 * SÓ SERVIDOR. Quem chama confere antes o escopo da sala: credencial de TURN é recurso pago, e
 * quem não está na chamada não a recebe.
 */

/** STUN público do Google: descobre o IP externo. NÃO transporta mídia — só metadado. */
const STUN_PADRAO: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/** Duas horas: cobre um atendimento longo sem deixar credencial válida por dias. */
const TTL_SEGUNDOS = 7200;

export interface RespostaDeIce {
  iceServers: RTCIceServer[];
  turnDisponivel: boolean;
  motivo?: string;
}

export async function gerarCredencialTurn(): Promise<RespostaDeIce> {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;

  if (!keyId || !apiToken) {
    // Degradação VISÍVEL: a tela avisa que a conexão pode falhar, em vez de falhar calada.
    return {
      iceServers: STUN_PADRAO,
      turnDisponivel: false,
      motivo: 'TURN não configurado neste ambiente',
    };
  }

  try {
    const resposta = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: TTL_SEGUNDOS }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!resposta.ok) {
      // O corpo do erro do provedor não vai ao cliente: pode conter identificador da conta.
      console.error('[atendimento] Cloudflare TURN respondeu', resposta.status);
      return {
        iceServers: STUN_PADRAO,
        turnDisponivel: false,
        motivo: 'Serviço de retransmissão indisponível',
      };
    }

    const dados = (await resposta.json()) as {
      iceServers?: { urls: string | string[]; username?: string; credential?: string };
    };
    const bruto = dados.iceServers;
    const urls = Array.isArray(bruto?.urls) ? bruto.urls : bruto?.urls ? [bruto.urls] : [];
    // A doc da Cloudflare avisa: URLs na porta 53 podem estourar timeout sem trickle ICE.
    const filtradas = urls.filter((u) => !u.includes(':53'));
    if (filtradas.length === 0) {
      return {
        iceServers: STUN_PADRAO,
        turnDisponivel: false,
        motivo: 'Nenhum servidor utilizável retornado',
      };
    }
    return {
      iceServers: [
        ...STUN_PADRAO,
        { urls: filtradas, username: bruto?.username, credential: bruto?.credential },
      ],
      turnDisponivel: true,
    };
  } catch {
    return {
      iceServers: STUN_PADRAO,
      turnDisponivel: false,
      motivo: 'Serviço de retransmissão indisponível',
    };
  }
}
