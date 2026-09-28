import { NextResponse } from 'next/server';

import { liberarReservasExpiradas } from '@/lib/agendamento/liberar-reservas-expiradas';
import { segredosConferem } from '@/lib/chatpro/segredo';
import { motivoLegivel } from '@/lib/erros/motivo-legivel';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * LIBERA AS RESERVAS DE AGENDAMENTO EXPIRADAS — respeitando pagamento em curso (Parte 2, Fase 4).
 *
 * Chamada pelo worker das filas (ADR-0027) a cada ~60 s e pelo `filas.yml` a cada 5 min, como
 * rede. Substitui o job do Inngest, que nunca rodou em produção (Item 40). A trava da corrida
 * — PIX ainda pagável, pagamento `em_processamento` — mora em
 * `lib/agendamento/liberar-reservas-expiradas.ts`.
 *
 * 🔴 FALHA FECHADA: sem `CRON_SECRET`, 503 — nunca um endpoint aberto. Mesmo padrão e mesmo
 * comparador em tempo constante de `app/api/mercadopago/processar/route.ts`.
 */
/**
 * Por IP, por minuto. O worker chama uma vez por minuto e o `filas.yml` a cada 5; cada chamada
 * aceita pode cancelar reservas e enviar e-mails, e tempo constante não protege contra tentar
 * o CRON_SECRET um milhão de vezes. Vem ANTES do segredo.
 */
const LIMITE_DO_EXPIRADOR = 10;

export async function GET(request: Request) {
  const limite = consumir(
    identificarChamador(request.headers, 'agendamento-expirar'),
    LIMITE_DO_EXPIRADOR,
    60,
  );
  if (!limite.permitido) {
    return NextResponse.json(
      { sucesso: false, erro: 'Muitas requisições' },
      { status: 429, headers: cabecalhosDoLimite(limite, LIMITE_DO_EXPIRADOR) },
    );
  }

  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo) {
    console.error('[expirar] CRON_SECRET ausente — expirador indisponível');
    return NextResponse.json(
      { sucesso: false, erro: 'Expirador não configurado' },
      { status: 503 },
    );
  }

  const cabecalho = request.headers.get('authorization') ?? '';
  const recebido = cabecalho.replace(/^Bearer\s+/i, '').trim();
  if (!segredosConferem(recebido, segredo)) {
    return NextResponse.json({ sucesso: false, erro: 'Não autorizado' }, { status: 401 });
  }

  try {
    const resultado = await liberarReservasExpiradas();
    return NextResponse.json({ sucesso: true, dados: resultado });
  } catch (erro) {
    console.error('[expirar] falha inesperada', { motivo: motivoLegivel(erro) });
    return NextResponse.json({ sucesso: false, erro: 'Falha ao expirar' }, { status: 500 });
  }
}
