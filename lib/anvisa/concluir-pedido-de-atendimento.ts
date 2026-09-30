/**
 * CONCLUI O PEDIDO DE ATENDIMENTO QUANDO A ANVISA APROVA — ADR-0029 D-03 (`DO-72`).
 *
 * Chamado pela rota de status (`app/api/anvisa/atualizar-status/route.ts`) depois de gravar
 * `aprovado`. O pedido aberto daquela autorização vira `concluido` e sai dos pendentes do admin,
 * sem ser apagado.
 *
 * ⚠️ NUNCA LANÇA, pelo mesmo motivo de `avisarAnvisaAprovada`: a aprovação já foi gravada, e uma
 * falha aqui não pode desfazê-la nem derrubar a resposta ao admin. O pior caso é o pedido ficar
 * aberto na lista, o que o admin vê e resolve.
 */
import { and, eq, inArray } from 'drizzle-orm';

import { pedidosAtendimentoAssistido } from '@/db/schema';
import { db } from '@/lib/db';
import { motivoLegivel } from '@/lib/erros/motivo-legivel';

import { STATUS_ABERTOS } from './pedido-de-atendimento';

export async function concluirPedidoDaAutorizacao(autorizacaoId: string): Promise<void> {
  try {
    await db
      .update(pedidosAtendimentoAssistido)
      .set({ status: 'concluido', concluidoEm: new Date() })
      .where(
        and(
          eq(pedidosAtendimentoAssistido.autorizacaoId, autorizacaoId),
          inArray(pedidosAtendimentoAssistido.status, [...STATUS_ABERTOS]),
        ),
      );
  } catch (erro) {
    // `motivoLegivel` diagnostica sem vazar valor: erro de banco sai como código:restrição:tabela.
    console.warn('[anvisa] pedido de atendimento não foi concluído', {
      motivo: motivoLegivel(erro),
    });
  }
}
