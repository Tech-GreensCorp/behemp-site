import { NextResponse } from 'next/server';

import { EnviadorDeAvisos } from '@/lib/parceiros/enviador';
import { segredosConferem } from '@/lib/chatpro/segredo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * ENTREGA OS AVISOS PENDENTES AO PARCEIRO. Chamada por cron.
 *
 * Falha FECHADA, como `/api/chatpro/processar`: sem `CRON_SECRET`, responde 503. Um cron
 * que não roda aparece no monitoramento; um endpoint público que qualquer um dispara, não.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo) {
    console.error('[parceiros] CRON_SECRET ausente — enviador indisponível');
    return NextResponse.json({ sucesso: false, erro: 'Não configurado' }, { status: 503 });
  }

  const recebido = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!segredosConferem(recebido, segredo)) {
    return NextResponse.json({ sucesso: false, erro: 'Não autorizado' }, { status: 401 });
  }

  try {
    const resultado = await new EnviadorDeAvisos().enviarLote();
    return NextResponse.json({ sucesso: true, dados: resultado });
  } catch (erro) {
    console.error('[parceiros] enviador: falha inesperada', {
      erro: erro instanceof Error ? erro.name : 'desconhecido',
    });
    return NextResponse.json({ sucesso: false, erro: 'Falha ao enviar' }, { status: 500 });
  }
}
