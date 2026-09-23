import { after, NextResponse, type NextRequest } from 'next/server';

import { verificarAssinaturaWebhook } from '@/lib/mercadopago/assinatura-webhook';
import { enfileirarNotificacao, processarFila } from '@/lib/mercadopago/notificacoes';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';

/**
 * `POST /api/webhooks/mercadopago` — notificações de pagamento (Parte 2, Fase 3).
 *
 * Recebe, confere, enfileira e RESPONDE — o MP espera 200/201 em até 22 s e reentrega a cada
 * 15 min quando não recebe. O processamento (reler o pagamento na API, confirmar a consulta)
 * roda DEPOIS da resposta, em `after()`, e de novo pelo cron do `filas.yml` se falhar. Ver
 * `lib/mercadopago/notificacoes.ts`.
 *
 * ## As decisões desta porta
 *
 *   · o `data.id` usado é o da QUERY STRING — é o que o MP assina. O do corpo não é assinado:
 *     se divergir do da URL, a notificação é ignorada
 *   · assinatura inválida responde 200 e NÃO processa. Dar 401 ensinaria a quem testa
 *     forjaduras o que funciona; o MP legítimo nunca cai aqui, e o motivo vai para o log
 *   · falha ao GRAVAR responde 500, de propósito — é o único caso em que se QUER a reentrega
 *     do MP: a notificação se perderia. (A fila do ChatPro faz o oposto porque lá a
 *     reentrega é o problema; aqui a perda é que custa dinheiro.)
 */

/**
 * Por IP, por minuto. Largo: o MP pode mandar rajadas (criado + atualizado de vários
 * pagamentos) e um 429 aqui adiaria a confirmação em 15 min. Estreito para quem martela.
 */
const LIMITE_DO_WEBHOOK = 120;

const OK = () => NextResponse.json({ ok: true }, { status: 200 });

export async function POST(request: NextRequest) {
  const limite = consumir(
    identificarChamador(request.headers, 'mp-webhook'),
    LIMITE_DO_WEBHOOK,
    60,
  );
  if (!limite.permitido) {
    return NextResponse.json(
      { ok: false },
      { status: 429, headers: cabecalhosDoLimite(limite, LIMITE_DO_WEBHOOK) },
    );
  }

  // O corpo é lido como TEXTO antes do parse — um corpo ilegível não derruba a rota.
  const corpoCru = await request.text();
  let corpo: { type?: unknown; data?: { id?: unknown } } = {};
  try {
    corpo = corpoCru ? JSON.parse(corpoCru) : {};
  } catch {
    corpo = {};
  }

  const params = request.nextUrl.searchParams;
  const dataId = params.get('data.id');

  const conferencia = verificarAssinaturaWebhook(request.headers, dataId);
  if (!conferencia.valida) {
    console.warn('[mercadopago] webhook com assinatura recusada', { motivo: conferencia.motivo });
    return OK();
  }

  // Só pagamentos. Outros tópicos (ex.: `mp-connect`) chegam aqui se ligados no painel.
  const tipo = typeof corpo.type === 'string' ? corpo.type : params.get('type');
  if (tipo !== 'payment') return OK();

  // O id tem de existir, ter formato de id de pagamento, e o do corpo (não assinado) não pode
  // contradizer o da URL (assinado).
  const idDoCorpo = corpo.data?.id;
  if (!dataId || !/^\d{1,20}$/.test(dataId)) {
    console.warn('[mercadopago] webhook sem data.id válido na URL');
    return OK();
  }
  if (idDoCorpo !== undefined && String(idDoCorpo) !== dataId) {
    console.warn('[mercadopago] webhook com data.id do corpo divergente do da URL — ignorado');
    return OK();
  }

  try {
    await enfileirarNotificacao(dataId);
  } catch (erro) {
    console.error('[mercadopago] 🔴 falha ao enfileirar notificação — o MP vai reentregar', {
      mpPaymentId: dataId,
      mensagem: erro instanceof Error ? erro.message : String(erro),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Depois da resposta: confirmação em segundos, em vez de esperar o cron.
  after(async () => {
    try {
      await processarFila(5);
    } catch (erro) {
      console.error('[mercadopago] processamento pós-webhook falhou; o cron tenta de novo', {
        mensagem: erro instanceof Error ? erro.message : String(erro),
      });
    }
  });

  return OK();
}
