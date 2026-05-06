'use server';

import { db } from '@/lib/db';
import { notificacoes } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { obterUsuarioAtual } from '@/lib/auth';
import { users } from '@/db/schema';

/**
 * Server Actions para gestão de notificações.
 */

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Lista notificações do usuário autenticado.
 */
export async function listarNotificacoes(): Promise<
  ActionResult<typeof notificacoes.$inferSelect[]>
> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    // Buscar userId interno pelo clerkId
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, auth.clerkId!))
      .limit(1);

    if (!user) {
      return { sucesso: true, dados: [] };
    }

    const resultado = await db
      .select()
      .from(notificacoes)
      .where(eq(notificacoes.userId, user.id))
      .orderBy(desc(notificacoes.createdAt));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar notificações:', error);
    return { sucesso: false, erro: 'Erro ao listar notificações' };
  }
}

/**
 * Marca uma notificação como lida.
 */
export async function marcarNotificacaoLida(
  notificacaoId: string,
): Promise<ActionResult> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    await db
      .update(notificacoes)
      .set({ lida: true })
      .where(eq(notificacoes.id, notificacaoId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao marcar notificação:', error);
    return { sucesso: false, erro: 'Erro ao marcar notificação' };
  }
}

/**
 * Marca todas as notificações do usuário como lidas.
 */
export async function marcarTodasNotificacoesLidas(): Promise<ActionResult> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, auth.clerkId!))
      .limit(1);

    if (!user) return { sucesso: true };

    await db
      .update(notificacoes)
      .set({ lida: true })
      .where(
        and(
          eq(notificacoes.userId, user.id),
          eq(notificacoes.lida, false),
        ),
      );

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao marcar todas notificações:', error);
    return { sucesso: false, erro: 'Erro ao marcar notificações' };
  }
}

/**
 * Conta notificações não lidas do usuário.
 */
export async function contarNotificacoesNaoLidas(): Promise<ActionResult<number>> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, auth.clerkId!))
      .limit(1);

    if (!user) return { sucesso: true, dados: 0 };

    const resultado = await db
      .select()
      .from(notificacoes)
      .where(
        and(
          eq(notificacoes.userId, user.id),
          eq(notificacoes.lida, false),
        ),
      );

    return { sucesso: true, dados: resultado.length };
  } catch (error) {
    console.error('[Action] Erro ao contar notificações:', error);
    return { sucesso: false, erro: 'Erro ao contar notificações' };
  }
}
