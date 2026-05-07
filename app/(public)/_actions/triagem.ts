'use server';

import { db } from '@/lib/db';
import { triagens } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Server Actions de triagem.
 * Formulário público (sem login) + formulário do médico (logado).
 * Visualização: admin vê todas, médico vê apenas as que ele criou.
 */

// ── Schemas ───────────────────────────────────────────────────

const criarTriagemSchema = z.object({
  dados: z.record(z.unknown()).refine((val) => Object.keys(val).length > 0, {
    message: 'Dados da triagem são obrigatórios',
  }),
  emailContato: z.string().email('E-mail inválido').optional(),
  telefoneContato: z.string().optional(),
  nomeContato: z.string().optional(),
  medicoClerkId: z.string().optional(),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Cria uma nova triagem (chamada pelo formulário público ou pelo médico).
 * Se `medicoClerkId` estiver presente, vincula a triagem ao médico.
 * Após salvar no banco, insere automaticamente na planilha Google Sheets.
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
        medicoClerkId: parsed.data.medicoClerkId ?? null,
      })
      .returning({ id: triagens.id });

    // Insere na planilha em paralelo — falha não impacta o usuário
    const { inserirLinhaTriagem } = await import('@/lib/integrations/google-sheets');
    const resultadoSheets = await Promise.allSettled([
      inserirLinhaTriagem({
        nomeContato: parsed.data.nomeContato ?? null,
        emailContato: parsed.data.emailContato ?? null,
        telefoneContato: parsed.data.telefoneContato ?? null,
        createdAt: new Date(),
        statusVisualizacao: 'pendente',
        dados: parsed.data.dados as Record<string, unknown>,
      }),
    ]);

    if (resultadoSheets[0].status === 'rejected') {
      console.error('[Action] Falha ao inserir no Google Sheets (triagem salva no banco):', resultadoSheets[0].reason);
    }

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
 * Lista triagens criadas por um médico específico.
 * Acessível por médico (vê só as próprias) e admin (vê de qualquer médico).
 */
export async function listarTriagensMedico(medicoClerkId?: string): Promise<
  ActionResult<typeof triagens.$inferSelect[]>
> {
  try {
    const { verificarMedicoOuAdmin } = await import('@/lib/auth');
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    // Médico vê apenas as próprias, admin pode ver de qualquer médico
    const clerkIdFiltro = auth.role === 'admin' && medicoClerkId
      ? medicoClerkId
      : auth.clerkId;

    if (!clerkIdFiltro) {
      return { sucesso: false, erro: 'Não foi possível identificar o médico' };
    }

    const resultado = await db
      .select()
      .from(triagens)
      .where(eq(triagens.medicoClerkId, clerkIdFiltro))
      .orderBy(desc(triagens.createdAt));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar triagens do médico:', error);
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
