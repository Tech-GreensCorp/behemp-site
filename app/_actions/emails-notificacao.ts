'use server';

import { db } from '@/lib/db';
import { emailsNotificacao } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { obterUsuarioAtual } from '@/lib/auth';

/**
 * CRUD de e-mails de notificação — gerenciados exclusivamente pelo admin.
 */

// ── Schemas ───────────────────────────────────────────────────

const criarEmailSchema = z.object({
  email: z.string().email('E-mail inválido'),
  nome: z.string().min(1, 'Nome é obrigatório'),
  categoria: z.enum(['financeiro', 'administrativo', 'geral']).default('financeiro'),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Listar todos os e-mails de notificação.
 */
export async function listarEmailsNotificacao(): Promise<ActionResult<Array<{
  id: string;
  email: string;
  nome: string;
  categoria: string;
  ativo: boolean;
}>>> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const resultado = await db
      .select({
        id: emailsNotificacao.id,
        email: emailsNotificacao.email,
        nome: emailsNotificacao.nome,
        categoria: emailsNotificacao.categoria,
        ativo: emailsNotificacao.ativo,
      })
      .from(emailsNotificacao)
      .orderBy(desc(emailsNotificacao.createdAt));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar emails de notificação:', error);
    return { sucesso: false, erro: 'Erro ao listar e-mails' };
  }
}

/**
 * Criar novo e-mail de notificação.
 */
export async function criarEmailNotificacao(
  dados: z.infer<typeof criarEmailSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = criarEmailSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };

    const [novo] = await db
      .insert(emailsNotificacao)
      .values({
        email: parsed.data.email,
        nome: parsed.data.nome,
        categoria: parsed.data.categoria,
      })
      .returning({ id: emailsNotificacao.id });

    return { sucesso: true, dados: { id: novo.id } };
  } catch (error) {
    console.error('[Action] Erro ao criar email de notificação:', error);
    return { sucesso: false, erro: 'Erro ao criar e-mail' };
  }
}

/**
 * Alternar ativo/inativo de um e-mail.
 */
export async function toggleEmailNotificacao(id: string): Promise<ActionResult> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const [atual] = await db
      .select({ ativo: emailsNotificacao.ativo })
      .from(emailsNotificacao)
      .where(eq(emailsNotificacao.id, id))
      .limit(1);

    if (!atual) return { sucesso: false, erro: 'E-mail não encontrado' };

    await db
      .update(emailsNotificacao)
      .set({ ativo: !atual.ativo })
      .where(eq(emailsNotificacao.id, id));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao alternar email:', error);
    return { sucesso: false, erro: 'Erro ao atualizar e-mail' };
  }
}

/**
 * Excluir um e-mail de notificação.
 */
export async function excluirEmailNotificacao(id: string): Promise<ActionResult> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    await db.delete(emailsNotificacao).where(eq(emailsNotificacao.id, id));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao excluir email:', error);
    return { sucesso: false, erro: 'Erro ao excluir e-mail' };
  }
}
