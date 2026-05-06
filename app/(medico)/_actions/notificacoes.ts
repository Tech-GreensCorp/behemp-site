'use server';

import { db } from '@/lib/db';
import { notificacoes } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { enviarNotificacaoRealtime } from '@/lib/integrations/pusher';

/**
 * Server Actions de notificações.
 */

// ── Schemas ───────────────────────────────────────────────────

const criarNotificacaoSchema = z.object({
  userId: z.string().min(1),
  tipo: z.enum([
    'renovacao_documento',
    'recompra_medicamento',
    'consulta_agendada',
    'consulta_cancelada',
    'nova_mensagem',
    'geral',
  ]),
  titulo: z.string().min(1),
  mensagem: z.string().min(1),
  linkAcao: z.string().optional(),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Cria uma notificação e envia via Pusher em tempo real.
 */
export async function criarNotificacao(
  dados: z.infer<typeof criarNotificacaoSchema>,
): Promise<ActionResult<{ notificacaoId: string }>> {
  try {
    const parsed = criarNotificacaoSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    // Salvar no banco
    const [nova] = await db
      .insert(notificacoes)
      .values({
        userId: parsed.data.userId,
        tipo: parsed.data.tipo,
        titulo: parsed.data.titulo,
        mensagem: parsed.data.mensagem,
        linkAcao: parsed.data.linkAcao,
      })
      .returning({ id: notificacoes.id });

    // Enviar via Pusher (não bloqueia se falhar)
    try {
      await enviarNotificacaoRealtime({
        userId: parsed.data.userId,
        tipo: parsed.data.tipo,
        titulo: parsed.data.titulo,
        mensagem: parsed.data.mensagem,
        linkAcao: parsed.data.linkAcao,
      });
    } catch {
      console.warn('[Notificação] Pusher indisponível, salva apenas no banco');
    }

    return { sucesso: true, dados: { notificacaoId: nova.id } };
  } catch (error) {
    console.error('[Action] Erro ao criar notificação:', error);
    return { sucesso: false, erro: 'Erro ao criar notificação' };
  }
}

/**
 * Lista notificações de um usuário.
 */
export async function listarNotificacoes(
  userId: string,
  apenasNaoLidas: boolean = false,
): Promise<ActionResult<typeof notificacoes.$inferSelect[]>> {
  try {
    const condicoes = [eq(notificacoes.userId, userId)];

    if (apenasNaoLidas) {
      condicoes.push(eq(notificacoes.lida, false));
    }

    const resultado = await db
      .select()
      .from(notificacoes)
      .where(and(...condicoes))
      .orderBy(desc(notificacoes.createdAt))
      .limit(50);

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar notificações:', error);
    return { sucesso: false, erro: 'Erro ao listar notificações' };
  }
}

/**
 * Marca notificação como lida.
 */
export async function marcarNotificacaoLida(
  notificacaoId: string,
): Promise<ActionResult> {
  try {
    await db
      .update(notificacoes)
      .set({ lida: true })
      .where(eq(notificacoes.id, notificacaoId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao marcar notificação:', error);
    return { sucesso: false, erro: 'Erro ao atualizar notificação' };
  }
}

/**
 * Marca todas as notificações de um usuário como lidas.
 */
export async function marcarTodasNotificacoesLidas(
  userId: string,
): Promise<ActionResult> {
  try {
    await db
      .update(notificacoes)
      .set({ lida: true })
      .where(and(eq(notificacoes.userId, userId), eq(notificacoes.lida, false)));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao marcar notificações:', error);
    return { sucesso: false, erro: 'Erro ao atualizar notificações' };
  }
}

/**
 * Conta notificações não lidas de um usuário.
 */
export async function contarNotificacoesNaoLidas(
  userId: string,
): Promise<ActionResult<{ total: number }>> {
  try {
    const resultado = await db
      .select()
      .from(notificacoes)
      .where(and(eq(notificacoes.userId, userId), eq(notificacoes.lida, false)));

    return { sucesso: true, dados: { total: resultado.length } };
  } catch (error) {
    console.error('[Action] Erro ao contar notificações:', error);
    return { sucesso: false, erro: 'Erro ao contar notificações' };
  }
}
