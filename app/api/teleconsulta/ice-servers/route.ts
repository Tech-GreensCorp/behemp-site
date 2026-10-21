import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { garantirDonoDaSala } from '@/lib/auth/escopo-sala';

/**
 * Servidores ICE (STUN/TURN) para a videochamada, com credencial EFÊMERA.
 *
 * POR QUE ESTE ENDPOINT EXISTE
 * Até 20/08/2026 a lista de servidores estava escrita em dois arquivos do cliente, com um
 * relay gratuito de terceiro (`openrelay.metered.ca`) e a credencial `openrelayproject` —
 * que é pública na internet. Quando a conexão direta falha, TODA a mídia da consulta médica
 * atravessa esse relay: operador de dado de saúde sem contrato, sem SLA (Item 8 de
 * docs/04-LISTA-DE-AFAZERES.md).
 *
 * Provedor escolhido pelo dono em 20/08/2026 entre 4 opções comparadas com preço:
 * Cloudflare Realtime TURN. A credencial é gerada AQUI, no servidor, com validade curta —
 * credencial permanente no cliente é credencial vazada.
 *
 * ⚠️ SEM AS VARIÁVEIS CONFIGURADAS, DEVOLVE SÓ STUN.
 * Chamada que dependeria de relay falha, em vez de atravessar relay de estranho. É a
 * degradação deliberada registrada em .claude/autorizacoes.txt — e o cliente mostra o aviso.
 *
 * Contrato da API (lido em https://developers.cloudflare.com/realtime/turn/generate-credentials/):
 *   POST https://rtc.live.cloudflare.com/v1/turn/keys/{id}/credentials/generate-ice-servers
 *   Authorization: Bearer {token} · body {"ttl": segundos} · 201 → { iceServers: [...] }
 */

/** STUN público do Google: descobre o IP externo. NÃO transporta mídia — só metadado. */
const STUN_PADRAO = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/** Duas horas: cobre uma consulta longa sem deixar credencial válida por dias. */
const TTL_SEGUNDOS = 7200;

const querySchema = z.object({
  roomId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9-]+$/),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    roomId: request.nextUrl.searchParams.get('roomId') ?? '',
  });
  if (!parsed.success) {
    return NextResponse.json({ erro: 'roomId inválido' }, { status: 400 });
  }

  // Só quem participa da sala pede credencial. Sem isto, qualquer usuário autenticado
  // consumiria a cota da conta — e credencial de TURN é recurso pago.
  const escopo = await garantirDonoDaSala({ roomId: parsed.data.roomId });
  if (!escopo.ok) {
    return NextResponse.json({ erro: escopo.erro }, { status: escopo.status });
  }

  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;

  if (!keyId || !apiToken) {
    // Degradação deliberada e VISÍVEL: o cliente recebe `turnDisponivel: false` e avisa
    // quem está na chamada, em vez de falhar em silêncio na hora da conexão.
    return NextResponse.json({
      iceServers: STUN_PADRAO,
      turnDisponivel: false,
      motivo: 'TURN não configurado neste ambiente',
    });
  }

  try {
    const resposta = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: TTL_SEGUNDOS }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!resposta.ok) {
      // Não repassar o corpo do erro do provedor ao cliente: pode conter identificador da
      // conta. Erro visível ao usuário é seguro e sem detalhe interno (AGENTS.md).
      console.error('[ICE] Cloudflare TURN respondeu', resposta.status);
      return NextResponse.json({
        iceServers: STUN_PADRAO,
        turnDisponivel: false,
        motivo: 'Serviço de retransmissão indisponível',
      });
    }

    const dados = (await resposta.json()) as {
      iceServers?: { urls: string | string[]; username?: string; credential?: string };
    };

    // A doc avisa que URLs na porta 53 podem estourar timeout no navegador sem trickle ICE.
    const bruto = dados.iceServers;
    const urls = Array.isArray(bruto?.urls) ? bruto.urls : bruto?.urls ? [bruto.urls] : [];
    const filtradas = urls.filter((u) => !u.includes(':53'));

    if (filtradas.length === 0) {
      return NextResponse.json({
        iceServers: STUN_PADRAO,
        turnDisponivel: false,
        motivo: 'Nenhum servidor utilizável retornado',
      });
    }

    return NextResponse.json({
      iceServers: [
        ...STUN_PADRAO,
        { urls: filtradas, username: bruto?.username, credential: bruto?.credential },
      ],
      turnDisponivel: true,
    });
  } catch (erro) {
    console.error('[ICE] Falha ao gerar credencial TURN:', erro);
    return NextResponse.json({
      iceServers: STUN_PADRAO,
      turnDisponivel: false,
      motivo: 'Serviço de retransmissão indisponível',
    });
  }
}
