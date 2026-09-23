import { NextResponse } from 'next/server';

import { segredosConferem } from '@/lib/chatpro/segredo';
import { processarFila, reenfileirarPagamentosEmTransito } from '@/lib/mercadopago/notificacoes';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';

export const dynamic = 'force-dynamic';
// Um lote com uma consulta à API do MP por evento cabe folgado; o teto evita que uma
// indisponibilidade do MP segure a função até o limite da plataforma.
export const maxDuration = 60;

/**
 * DISPARA A FILA DE NOTIFICAÇÕES DO MERCADO PAGO — e a CONCILIAÇÃO.
 *
 * Chamada pelo `filas.yml` a cada 5 min. É a rede de segurança do `after()` do webhook: um
 * evento que falhou lá (API do MP fora, banco lento) é retomado aqui. E antes de processar,
 * reenfileira os pagamentos em trânsito cuja notificação nunca chegou — webhook mal
 * configurado no painel não pode deixar consulta paga sem confirmação.
 *
 * O Inngest não é usado: o job de expiração que roda nele não executa em produção (medido em
 * 23/09/2026). Este é o mecanismo que comprovadamente roda — o mesmo das filas do ChatPro e
 * dos parceiros.
 *
 * 🔴 FALHA FECHADA: sem `CRON_SECRET`, 503 — nunca um endpoint aberto. Mesmo padrão e mesmo
 * comparador em tempo constante de `app/api/chatpro/processar/route.ts`.
 */
/**
 * Por IP, por minuto. O cron chama uma vez a cada 5 min (mais o disparo manual); o limite
 * existe porque cada chamada aceita dispara um lote de consultas à API do MP, e porque tempo
 * constante não protege contra tentar o CRON_SECRET um milhão de vezes. Vem ANTES do segredo.
 */
const LIMITE_DO_PROCESSADOR = 10;

export async function GET(request: Request) {
  const limite = consumir(
    identificarChamador(request.headers, 'mp-processar'),
    LIMITE_DO_PROCESSADOR,
    60,
  );
  if (!limite.permitido) {
    return NextResponse.json(
      { sucesso: false, erro: 'Muitas requisições' },
      { status: 429, headers: cabecalhosDoLimite(limite, LIMITE_DO_PROCESSADOR) },
    );
  }

  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo) {
    console.error('[mercadopago] CRON_SECRET ausente — processador indisponível');
    return NextResponse.json(
      { sucesso: false, erro: 'Processador não configurado' },
      { status: 503 },
    );
  }

  const cabecalho = request.headers.get('authorization') ?? '';
  const recebido = cabecalho.replace(/^Bearer\s+/i, '').trim();
  if (!segredosConferem(recebido, segredo)) {
    return NextResponse.json({ sucesso: false, erro: 'Não autorizado' }, { status: 401 });
  }

  try {
    const reenfileirados = await reenfileirarPagamentosEmTransito();
    const resultado = await processarFila(25);
    return NextResponse.json({ sucesso: true, dados: { reenfileirados, ...resultado } });
  } catch (erro) {
    console.error('[mercadopago] processador: falha inesperada', {
      mensagem: erro instanceof Error ? erro.message : 'desconhecida',
    });
    return NextResponse.json({ sucesso: false, erro: 'Falha ao processar' }, { status: 500 });
  }
}
