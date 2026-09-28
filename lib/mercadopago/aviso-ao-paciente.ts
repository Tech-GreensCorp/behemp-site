import { eq } from 'drizzle-orm';

import { consultas, pacientes } from '@/db/schema';
import { db } from '@/lib/db';
import { motivoLegivel } from '@/lib/erros/motivo-legivel';
import { canalUsuario, getPusherServer } from '@/lib/integrations/pusher/server';

/**
 * AVISA A TELA DO PACIENTE que o pagamento andou (Parte 2, Fase 5) — pelo Pusher, no canal
 * pessoal `private-user-{userId}`, que só o próprio usuário assina (`app/api/pusher/auth`).
 *
 * É o mesmo padrão de `teleconsulta:iniciada` (`app/(medico)/_actions/notificar-teleconsulta.ts`).
 * E, como lá, NÃO é o único canal: a confirmação já manda e-mail (`confirmarConsultaPaga`), e a
 * tela relê o estado no banco ao voltar ao foco. Pusher é tempo real para quem está com a aba
 * aberta — quem não está, não perde nada.
 *
 * O corpo leva só o id da consulta e o estado: nada de nome, valor ou dado do cartão.
 *
 * 🔴 NUNCA LANÇA. Quem chama é o processamento da fila, e um lançamento ali faria o evento ser
 * reprocessado — reconfirmando uma consulta já confirmada por causa de um aviso que não saiu.
 */

export const EVENTO_PAGAMENTO_ATUALIZADO = 'pagamento:atualizado';

export type EstadoAvisado = 'confirmado' | 'recusado' | 'cancelado';

export async function avisarPacienteDoPagamento(
  consultaId: string,
  estado: EstadoAvisado,
): Promise<void> {
  try {
    const [dono] = await db
      .select({ userId: pacientes.userId })
      .from(consultas)
      .innerJoin(pacientes, eq(consultas.pacienteId, pacientes.id))
      .where(eq(consultas.id, consultaId))
      .limit(1);
    if (!dono) return;

    await getPusherServer().trigger(canalUsuario(dono.userId), EVENTO_PAGAMENTO_ATUALIZADO, {
      consultaId,
      estado,
    });
  } catch (erro) {
    console.error('[mercadopago] aviso em tempo real ao paciente falhou', {
      consultaId,
      estado,
      motivo: motivoLegivel(erro),
    });
  }
}
