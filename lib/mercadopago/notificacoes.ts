/**
 * AS NOTIFICAÇÕES DE PAGAMENTO — fila, processamento e conciliação (Parte 2, Fase 3).
 *
 * O webhook (`app/api/webhooks/mercadopago/route.ts`) só ENFILEIRA e responde. Daqui para
 * frente é o que confirma a consulta de quem pagou — e por isso nada aqui confia na
 * notificação: ela diz QUAL pagamento olhar; o que aconteceu com ele vem de
 * `GET /v1/payments/{id}`, com o token do médico. É a confirmação reversa da fila do ChatPro
 * (`lib/chatpro/processador.ts`).
 *
 * ## 🔴 AS TRÊS REGRAS QUE CUSTAM DINHEIRO SE QUEBRAREM
 *
 *   1. ENFILEIRAR REENFILEIRA. O MP manda mais de uma notificação por pagamento — criado
 *      (pendente) e depois aprovado. `onConflictDoNothing` descartaria a da aprovação e a
 *      consulta nunca seria confirmada. O conflito ZERA `processadoEm`.
 *   2. A RESERVA É ATÔMICA. Um único `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`:
 *      quem perde a corrida não enxerga a linha. Sem `db.transaction` — produção é neon-http.
 *   3. SÓ A API CONFIRMA. Pagamento aprovado cujo id, referência ou valor não batem com a
 *      nossa linha NÃO confirma nada — fica registrado como divergente, para conferência.
 *
 * ## Quem dispara o processamento
 *
 *   · o próprio webhook, logo depois de responder (`after()` do Next) — confirmação em
 *     segundos
 *   · `GET /api/mercadopago/processar`, chamado pelo `filas.yml` a cada 5 min — rede de
 *     segurança, e a CONCILIAÇÃO: reenfileira pagamentos em trânsito cuja notificação nunca
 *     chegou. O Inngest NÃO é usado: o job `liberarReservasExpiradas` dele não roda em
 *     produção (7 reservas vencidas desde 10/09, medido em 23/09/2026).
 */

import { and, eq, gte, isNotNull, isNull, lte, sql } from 'drizzle-orm';

import { consultas, mercadopagoEventosWebhook, pagamentos } from '@/db/schema';
import { confirmarConsultaPaga } from '@/lib/agendamento/confirmar-consulta-paga';
import { db } from '@/lib/db';
import { obterContaConectada } from '@/lib/mercadopago/conta';
import { registrarAuditoria } from '@/lib/utils/audit';

const URL_DE_PAGAMENTOS = 'https://api.mercadopago.com/v1/payments';
const TIMEOUT_DA_CONSULTA_MS = 15_000;

/** Resultado de processar UMA notificação — o que aconteceu, para o log e o teste. */
export type EfeitoDoProcessamento =
  | 'confirmada'
  | 'ja_pago'
  | 'pago_sem_horario'
  | 'recusado'
  | 'cancelado'
  | 'estornado'
  | 'aguardando'
  | 'divergente'
  | 'desconhecido'
  | 'sem_conta';

interface PagamentoNaApi {
  id?: number | string;
  status?: string;
  status_detail?: string | null;
  external_reference?: string | null;
  transaction_amount?: number | string;
}

/** Erro que merece NOVA TENTATIVA (rede, 5xx, 429) — o evento volta para a fila. */
class ErroTransitorio extends Error {}

/**
 * Enfileira (ou REENFILEIRA) um pagamento para processamento.
 *
 * 🔴 `onConflictDoUpdate`, nunca `onConflictDoNothing` — ver a regra 1 no topo.
 */
export async function enfileirarNotificacao(mpPaymentId: string): Promise<void> {
  await db
    .insert(mercadopagoEventosWebhook)
    .values({ mpPaymentId })
    .onConflictDoUpdate({
      target: mercadopagoEventosWebhook.mpPaymentId,
      set: { processadoEm: null, updatedAt: new Date() },
    });
}

/**
 * CONCILIAÇÃO — reenfileira pagamentos em trânsito cuja notificação pode ter se perdido.
 *
 * Um webhook mal configurado no painel, ou uma notificação que nunca chegou, não pode deixar
 * uma consulta paga sem confirmação. A janela é limitada: mais de 2 min (dá tempo ao webhook)
 * e menos de 24 h (um PIX nunca pago fica `pending` no MP por até 30 dias; conferir isso a
 * cada 5 min por um mês seria ruído).
 */
export async function reenfileirarPagamentosEmTransito(): Promise<number> {
  const agora = Date.now();
  const emTransito = await db
    .select({ ref: pagamentos.gatewayReferenciaId })
    .from(pagamentos)
    .where(
      and(
        eq(pagamentos.status, 'em_processamento'),
        eq(pagamentos.gatewayProvider, 'mercadopago'),
        isNotNull(pagamentos.gatewayReferenciaId),
        lte(pagamentos.pagamentoIniciadoEm, new Date(agora - 2 * 60 * 1000)),
        gte(pagamentos.pagamentoIniciadoEm, new Date(agora - 24 * 60 * 60 * 1000)),
        isNull(pagamentos.deletedAt),
      ),
    )
    .limit(50);

  for (const { ref } of emTransito) {
    if (ref) await enfileirarNotificacao(ref);
  }
  return emTransito.length;
}

/** Reivindica até `limite` eventos pendentes, marcando-os no MESMO comando (regra 2). */
async function reivindicar(limite: number): Promise<{ id: string; mpPaymentId: string }[]> {
  const linhas = await db.execute<{ id: string; mp_payment_id: string }>(sql`
    UPDATE mercadopago_eventos_webhook
       SET processado_em = now(),
           updated_at = now()
     WHERE id IN (
           SELECT id
             FROM mercadopago_eventos_webhook
            WHERE processado_em IS NULL
            ORDER BY updated_at
            LIMIT ${limite}
              FOR UPDATE SKIP LOCKED
     )
 RETURNING id, mp_payment_id
  `);
  const registros = Array.isArray(linhas) ? linhas : ((linhas as { rows?: unknown[] }).rows ?? []);
  return (registros as Record<string, unknown>[]).map((l) => ({
    id: String(l.id),
    mpPaymentId: String(l.mp_payment_id),
  }));
}

export interface ResultadoDaFila {
  reivindicados: number;
  efeitos: Record<string, number>;
  falharam: number;
}

/**
 * Processa a fila. Um evento que falha de forma transitória VOLTA para a fila
 * (`processadoEm` nulo) e é tentado no próximo disparo.
 */
export async function processarFila(limite = 10): Promise<ResultadoDaFila> {
  const eventos = await reivindicar(limite);
  const resultado: ResultadoDaFila = { reivindicados: eventos.length, efeitos: {}, falharam: 0 };

  for (const evento of eventos) {
    try {
      const efeito = await processarPagamento(evento.mpPaymentId);
      resultado.efeitos[efeito] = (resultado.efeitos[efeito] ?? 0) + 1;
    } catch (erro) {
      resultado.falharam++;
      await db
        .update(mercadopagoEventosWebhook)
        .set({ processadoEm: null, updatedAt: new Date() })
        .where(eq(mercadopagoEventosWebhook.id, evento.id));
      console.error('[mercadopago] processamento falhou; volta para a fila', {
        mpPaymentId: evento.mpPaymentId,
        mensagem: erro instanceof Error ? erro.message.slice(0, 300) : String(erro),
      });
    }
  }
  return resultado;
}

/** Registra na linha o que o webhook fez — auditável, sem ator (Decisão 6). */
async function auditar(pagamentoId: string, dadosDepois: Record<string, unknown>) {
  await registrarAuditoria({
    userId: null,
    acao: 'atualizar',
    entidade: 'pagamentos',
    entidadeId: pagamentoId,
    dadosDepois: { origem: 'webhook_mercadopago', ...dadosDepois },
  });
}

/**
 * Processa UM pagamento: relê na API e aplica. Lança `ErroTransitorio` (ou qualquer erro)
 * quando vale tentar de novo; devolve o efeito quando o caso está resolvido.
 */
export async function processarPagamento(mpPaymentId: string): Promise<EfeitoDoProcessamento> {
  const [linha] = await db
    .select({
      pagamentoId: pagamentos.id,
      valor: pagamentos.valor,
      statusPagamento: pagamentos.status,
      consultaId: consultas.id,
      medicoId: consultas.medicoId,
      statusConsulta: consultas.status,
    })
    .from(pagamentos)
    .innerJoin(consultas, eq(pagamentos.consultaId, consultas.id))
    .where(and(eq(pagamentos.gatewayReferenciaId, mpPaymentId), isNull(pagamentos.deletedAt)))
    .limit(1);

  if (!linha) {
    // Pagamento que não é nosso, ou cuja gravação falhou na criação (ver o log 🔴 de
    // `criarCobranca`). Sem a linha não há de quem é o token para perguntar à API.
    console.warn('[mercadopago] notificação de pagamento sem linha correspondente', {
      mpPaymentId,
    });
    return 'desconhecido';
  }

  const conta = await obterContaConectada(linha.medicoId, null, 'processar_webhook');
  if (!conta) {
    await db
      .update(pagamentos)
      .set({
        pagamentoErroEm: new Date(),
        erroConfirmacao: 'Webhook: conta do médico desconectada ao confirmar o pagamento',
      })
      .where(eq(pagamentos.id, linha.pagamentoId));
    console.error('[mercadopago] 🔴 pagamento notificado, mas o médico desconectou a conta', {
      mpPaymentId,
      pagamentoId: linha.pagamentoId,
    });
    return 'sem_conta';
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${URL_DE_PAGAMENTOS}/${encodeURIComponent(mpPaymentId)}`, {
      headers: { Authorization: `Bearer ${conta.accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_DA_CONSULTA_MS),
    });
  } catch (erro) {
    throw new ErroTransitorio(
      `falha de comunicação ao consultar o pagamento (${erro instanceof Error ? erro.name : 'erro'})`,
    );
  }
  if (!resposta.ok) {
    const transitorio = resposta.status >= 500 || resposta.status === 429;
    const detalhe = (await resposta.text().catch(() => '')).slice(0, 200);
    if (transitorio) throw new ErroTransitorio(`API respondeu HTTP ${resposta.status}`);
    // 4xx: token recusado, pagamento de outra conta — tentar de novo não muda nada.
    console.error('[mercadopago] consulta do pagamento recusada', {
      mpPaymentId,
      status: resposta.status,
      detalhe,
    });
    await db
      .update(pagamentos)
      .set({
        pagamentoErroEm: new Date(),
        erroConfirmacao: `Webhook: consulta do pagamento recusada (HTTP ${resposta.status})`,
      })
      .where(eq(pagamentos.id, linha.pagamentoId));
    return 'divergente';
  }

  const dados = (await resposta.json().catch(() => ({}))) as PagamentoNaApi;
  const statusMp = dados.status ?? '';

  // ── Regra 3: a API tem de estar falando do NOSSO pagamento ───────────────────────────
  const valorApi = Number(dados.transaction_amount);
  const valorNosso = Number(linha.valor);
  const divergencias = [
    String(dados.id) !== mpPaymentId && 'id',
    dados.external_reference !== linha.pagamentoId && 'external_reference',
    !(Math.abs(valorApi - valorNosso) < 0.005) && 'valor',
  ].filter(Boolean);
  if (divergencias.length > 0) {
    console.error('[mercadopago] 🔴 pagamento da API não bate com a nossa linha — NÃO confirmado', {
      mpPaymentId,
      pagamentoId: linha.pagamentoId,
      divergencias,
      statusMp,
    });
    await db
      .update(pagamentos)
      .set({
        pagamentoErroEm: new Date(),
        erroConfirmacao: `Webhook: pagamento divergente (${divergencias.join(', ')}) — conferir manualmente`,
      })
      .where(eq(pagamentos.id, linha.pagamentoId));
    return 'divergente';
  }

  switch (statusMp) {
    case 'approved': {
      if (linha.statusPagamento === 'pago') return 'ja_pago';

      // Plano 4.2 — o horário já foi liberado: o paciente pagou, mas o horário pode ser de
      // outro. NÃO confirma; registra o dinheiro recebido e deixa o caso visível ao admin
      // (`erroConfirmacao` sem `confirmadoEm` aparece no filtro de falhas de /admin/pagamentos).
      if (linha.statusConsulta === 'cancelada') {
        const agora = new Date();
        await db
          .update(pagamentos)
          .set({
            status: 'pago',
            pagoEm: agora,
            erroConfirmacao:
              'PAGO DEPOIS DE O HORÁRIO SER LIBERADO — reembolso ou reagendamento manual',
          })
          .where(eq(pagamentos.id, linha.pagamentoId));
        await auditar(linha.pagamentoId, { mpPaymentId, statusMp, efeito: 'pago_sem_horario' });
        console.error('[mercadopago] 🔴 pagamento aprovado para reserva JÁ LIBERADA', {
          mpPaymentId,
          pagamentoId: linha.pagamentoId,
        });
        return 'pago_sem_horario';
      }

      if (linha.statusConsulta === 'reservada') {
        const res = await confirmarConsultaPaga(linha.consultaId, {
          atorUserId: null,
          ignorarPrazo: true,
        });
        if (!res.sucesso) throw new Error(`confirmação falhou: ${res.erro ?? 'sem mensagem'}`);
        await auditar(linha.pagamentoId, { mpPaymentId, statusMp, efeito: 'confirmada' });
        return 'confirmada';
      }

      // Já agendada/confirmada/realizada por outro caminho: só registra que foi paga.
      const agora = new Date();
      await db
        .update(pagamentos)
        .set({ status: 'pago', pagoEm: agora, erroConfirmacao: null })
        .where(eq(pagamentos.id, linha.pagamentoId));
      await auditar(linha.pagamentoId, { mpPaymentId, statusMp, efeito: 'ja_pago' });
      return 'ja_pago';
    }

    case 'rejected':
    case 'cancelled': {
      if (linha.statusPagamento === 'pago') return 'ja_pago';
      const status = statusMp === 'rejected' ? 'recusado' : 'cancelado';
      await db
        .update(pagamentos)
        .set({
          status,
          pagamentoErroEm: new Date(),
          erroConfirmacao: `Mercado Pago: ${statusMp} (${dados.status_detail ?? 'sem detalhe'})`,
        })
        .where(eq(pagamentos.id, linha.pagamentoId));
      await auditar(linha.pagamentoId, { mpPaymentId, statusMp, efeito: status });
      return status;
    }

    case 'refunded':
    case 'charged_back': {
      await db
        .update(pagamentos)
        .set({ status: 'estornado', erroConfirmacao: `Mercado Pago: ${statusMp}` })
        .where(eq(pagamentos.id, linha.pagamentoId));
      await auditar(linha.pagamentoId, { mpPaymentId, statusMp, efeito: 'estornado' });
      console.warn('[mercadopago] pagamento estornado/contestado', { mpPaymentId, statusMp });
      return 'estornado';
    }

    // pending, in_process, authorized, in_mediation: ainda em trânsito. A próxima notificação
    // (ou a conciliação) reenfileira.
    default:
      return 'aguardando';
  }
}
