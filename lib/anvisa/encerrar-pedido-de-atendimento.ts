/**
 * ENCERRA O PEDIDO DE ATENDIMENTO QUANDO A ANVISA RESPONDE — ADR-0029 D-03 (`DO-72`, `DO-76`).
 *
 * Chamado pela rota de status (`app/api/anvisa/atualizar-status/route.ts`) depois de gravar a
 * resposta da ANVISA: `aprovado` encerra como `concluido`; `rejeitado`, como `rejeitado_anvisa`
 * (Davi, 30/09/2026: _"ele fica como rejeitado anvisa"_). O pedido sai dos pendentes do admin, sem
 * ser apagado.
 *
 * ⚠️ NUNCA LANÇA, pelo mesmo motivo de `avisarAnvisaAprovada`: a resposta da ANVISA já foi
 * gravada, e uma falha aqui não pode desfazê-la nem derrubar a resposta ao admin. O pior caso é o
 * pedido ficar aberto na lista, o que o admin vê e resolve.
 */
import { and, eq, inArray } from 'drizzle-orm';

import { pedidosAtendimentoAssistido } from '@/db/schema';
import { db } from '@/lib/db';
import { motivoLegivel } from '@/lib/erros/motivo-legivel';

import { STATUS_ABERTOS } from './pedido-de-atendimento';

export type DesfechoDaAnvisa = 'concluido' | 'rejeitado_anvisa';

export async function encerrarPedidoDaAutorizacao(
  autorizacaoId: string,
  desfecho: DesfechoDaAnvisa,
): Promise<void> {
  try {
    await db
      .update(pedidosAtendimentoAssistido)
      .set({ status: desfecho, encerradoEm: new Date() })
      .where(
        and(
          eq(pedidosAtendimentoAssistido.autorizacaoId, autorizacaoId),
          inArray(pedidosAtendimentoAssistido.status, [...STATUS_ABERTOS]),
        ),
      );
  } catch (erro) {
    // `motivoLegivel` diagnostica sem vazar valor: erro de banco sai como código:restrição:tabela.
    console.warn('[anvisa] pedido de atendimento não foi encerrado', {
      desfecho,
      motivo: motivoLegivel(erro),
    });
  }
}
