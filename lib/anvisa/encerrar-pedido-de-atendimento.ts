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
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { chamadasDeAtendimento, pedidosAtendimentoAssistido } from '@/db/schema';
import { db } from '@/lib/db';
import { canalDoAtendimento } from '@/lib/atendimento/canal';
import { motivoLegivel } from '@/lib/erros/motivo-legivel';
import { getPusherServer } from '@/lib/integrations/pusher/server';

import { STATUS_ABERTOS } from './pedido-de-atendimento';

export type DesfechoDaAnvisa = 'concluido' | 'rejeitado_anvisa';

export async function encerrarPedidoDaAutorizacao(
  autorizacaoId: string,
  desfecho: DesfechoDaAnvisa,
): Promise<void> {
  try {
    const agora = new Date();
    const encerrados = await db
      .update(pedidosAtendimentoAssistido)
      .set({ status: desfecho, encerradoEm: agora })
      .where(
        and(
          eq(pedidosAtendimentoAssistido.autorizacaoId, autorizacaoId),
          inArray(pedidosAtendimentoAssistido.status, [...STATUS_ABERTOS]),
        ),
      )
      .returning({ id: pedidosAtendimentoAssistido.id });

    // A chamada aberta desse pedido fecha junto (ADR-0029 D-12): sala viva de pedido encerrado
    // seria uma porta aberta para um atendimento que não existe mais.
    if (encerrados.length > 0) {
      const fechadas = await db
        .update(chamadasDeAtendimento)
        .set({ encerradaEm: agora })
        .where(
          and(
            inArray(
              chamadasDeAtendimento.pedidoId,
              encerrados.map((p) => p.id),
            ),
            isNull(chamadasDeAtendimento.encerradaEm),
          ),
        )
        .returning({ sala: chamadasDeAtendimento.sala });

      // Revisão de 30/09/2026: fechar no banco não basta. A voz é ponto a ponto e seguiria; as
      // telas precisam do aviso para desligar, como quando o admin encerra.
      for (const { sala } of fechadas) {
        await getPusherServer()
          .trigger(canalDoAtendimento(sala), 'chamada:encerrada', {})
          .catch(() => {});
      }
    }
  } catch (erro) {
    // `motivoLegivel` diagnostica sem vazar valor: erro de banco sai como código:restrição:tabela.
    console.warn('[anvisa] pedido de atendimento não foi encerrado', {
      desfecho,
      motivo: motivoLegivel(erro),
    });
  }
}
