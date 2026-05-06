'use server';

import { db } from '@/lib/db';
import { triagens } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Server Actions de triagem.
 * Formulário público (sem login) + visualização exclusiva do admin.
 */

// ── Schemas ───────────────────────────────────────────────────

const criarTriagemSchema = z.object({
  dados: z.record(z.unknown()).refine((val) => Object.keys(val).length > 0, {
    message: 'Dados da triagem são obrigatórios',
  }),
  emailContato: z.string().email('E-mail inválido').optional(),
  telefoneContato: z.string().optional(),
  nomeContato: z.string().optional(),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Cria uma nova triagem (chamada pelo formulário público).
 */
export async function criarTriagem(
  dados: z.infer<typeof criarTriagemSchema>,
): Promise<ActionResult<{ triagemId: string }>> {
  try {
    const parsed = criarTriagemSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const [nova] = await db
      .insert(triagens)
      .values({
        dados: parsed.data.dados,
        emailContato: parsed.data.emailContato,
        telefoneContato: parsed.data.telefoneContato,
        nomeContato: parsed.data.nomeContato,
        statusVisualizacao: 'pendente',
      })
      .returning({ id: triagens.id });

    return { sucesso: true, dados: { triagemId: nova.id } };
  } catch (error) {
    console.error('[Action] Erro ao criar triagem:', error);
    return { sucesso: false, erro: 'Erro ao enviar triagem' };
  }
}

/**
 * Lista todas as triagens (admin only).
 */
export async function listarTriagens(): Promise<
  ActionResult<typeof triagens.$inferSelect[]>
> {
  try {
    const { verificarAdmin } = await import('@/lib/auth');
    const auth = await verificarAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const resultado = await db
      .select()
      .from(triagens)
      .orderBy(desc(triagens.createdAt));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar triagens:', error);
    return { sucesso: false, erro: 'Erro ao listar triagens' };
  }
}

/**
 * Marca triagem como visualizada/respondida.
 */
export async function atualizarStatusTriagem(
  triagemId: string,
  status: 'visualizada' | 'respondida',
): Promise<ActionResult> {
  try {
    if (!triagemId) {
      return { sucesso: false, erro: 'ID da triagem é obrigatório' };
    }

    await db
      .update(triagens)
      .set({ statusVisualizacao: status })
      .where(eq(triagens.id, triagemId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao atualizar triagem:', error);
    return { sucesso: false, erro: 'Erro ao atualizar triagem' };
  }
}
