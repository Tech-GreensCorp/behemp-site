/**
 * QUEM PODE ESTAR NA CHAMADA DE ATENDIMENTO — ADR-0029 §10, D-12 e D-14.
 *
 * Duas pessoas, e só elas: o PACIENTE dono do pedido e um ADMIN (`DO-70`: o atendimento é do
 * perfil de admin). Todas as portas da chamada passam por aqui — entrar, sinalizar, pedir TURN,
 * assinar o canal Pusher, mandar mensagem e ver o print.
 *
 * O papel vem do BANCO (`users.role`), como no `/api/pusher/auth`, e não de um claim da sessão: é a
 * fonte que o admin controla. "Não existe" e "não é seu" dão a MESMA resposta, 404 — a diferença
 * contaria a quem tenta que aquela sala ou aquele pedido existe (OWASP API1).
 */
import { auth } from '@clerk/nextjs/server';
import { and, eq, isNull } from 'drizzle-orm';

import { chamadasDeAtendimento, pacientes, pedidosAtendimentoAssistido, users } from '@/db/schema';
import { STATUS_ABERTOS, type StatusDoPedido } from '@/lib/anvisa/pedido-de-atendimento';
import { db } from '@/lib/db';

import type { PapelNaChamada } from '@/lib/atendimento/canal';

export type { PapelNaChamada };

type Recusa = { ok: false; status: 401 | 404 | 409; erro: string };

const NAO_ENCONTRADO: Recusa = { ok: false, status: 404, erro: 'Atendimento não encontrado' };

async function usuarioDaSessao(): Promise<{ id: string; role: string } | Recusa> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false, status: 401, erro: 'Não autenticado' };
  const [u] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return u ?? NAO_ENCONTRADO;
}

/** O pedido aceita quem está na sessão? Admin sempre; paciente, só o dono. */
async function papelNoPedido(
  usuario: { id: string; role: string },
  pacienteDoPedido: string,
): Promise<PapelNaChamada | null> {
  if (usuario.role === 'admin') return 'admin';
  if (usuario.role !== 'paciente') return null;
  const [dono] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(
      and(
        eq(pacientes.id, pacienteDoPedido),
        eq(pacientes.userId, usuario.id),
        isNull(pacientes.deletedAt),
      ),
    )
    .limit(1);
  return dono ? 'paciente' : null;
}

/** Para ENTRAR: o pedido tem de existir, ser do paciente (ou o chamador ser admin) e estar aberto. */
export async function garantirAcessoAoPedido(pedidoId: string): Promise<
  | {
      ok: true;
      papel: PapelNaChamada;
      userId: string;
      pedido: { id: string; pacienteId: string; status: StatusDoPedido };
    }
  | Recusa
> {
  const usuario = await usuarioDaSessao();
  if ('ok' in usuario) return usuario;

  const [pedido] = await db
    .select({
      id: pedidosAtendimentoAssistido.id,
      pacienteId: pedidosAtendimentoAssistido.pacienteId,
      status: pedidosAtendimentoAssistido.status,
    })
    .from(pedidosAtendimentoAssistido)
    .where(eq(pedidosAtendimentoAssistido.id, pedidoId))
    .limit(1);
  if (!pedido) return NAO_ENCONTRADO;

  const papel = await papelNoPedido(usuario, pedido.pacienteId);
  if (!papel) return NAO_ENCONTRADO;

  // Só depois de provar o acesso se diz que o pedido fechou: aqui já não é oráculo.
  if (!STATUS_ABERTOS.includes(pedido.status)) {
    return { ok: false, status: 409, erro: 'Este pedido de atendimento já foi encerrado.' };
  }
  return { ok: true, papel, userId: usuario.id, pedido };
}

/**
 * Para AGIR NA SALA (sinalizar, TURN, canal, mensagem, print). `exigirAberta: false` só para LER o
 * que já foi dito — ver um print depois que a chamada acabou.
 */
export async function garantirParticipanteDaChamada(opcoes: {
  sala: string;
  exigirAberta?: boolean;
}): Promise<
  | {
      ok: true;
      papel: PapelNaChamada;
      userId: string;
      chamada: { id: string; sala: string; pedidoId: string; encerradaEm: Date | null };
    }
  | Recusa
> {
  const usuario = await usuarioDaSessao();
  if ('ok' in usuario) return usuario;

  const [linha] = await db
    .select({
      id: chamadasDeAtendimento.id,
      sala: chamadasDeAtendimento.sala,
      pedidoId: chamadasDeAtendimento.pedidoId,
      encerradaEm: chamadasDeAtendimento.encerradaEm,
      pacienteId: pedidosAtendimentoAssistido.pacienteId,
    })
    .from(chamadasDeAtendimento)
    .innerJoin(
      pedidosAtendimentoAssistido,
      eq(pedidosAtendimentoAssistido.id, chamadasDeAtendimento.pedidoId),
    )
    .where(eq(chamadasDeAtendimento.sala, opcoes.sala))
    .limit(1);
  if (!linha) return NAO_ENCONTRADO;

  const papel = await papelNoPedido(usuario, linha.pacienteId);
  if (!papel) return NAO_ENCONTRADO;

  if ((opcoes.exigirAberta ?? true) && linha.encerradaEm) {
    return { ok: false, status: 409, erro: 'Este atendimento já foi encerrado.' };
  }
  return {
    ok: true,
    papel,
    userId: usuario.id,
    chamada: {
      id: linha.id,
      sala: linha.sala,
      pedidoId: linha.pedidoId,
      encerradaEm: linha.encerradaEm,
    },
  };
}
