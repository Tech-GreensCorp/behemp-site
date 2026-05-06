'use server';

import { db } from '@/lib/db';
import { anamneses } from '@/db/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { verificarMedicoOuAdmin } from '@/lib/auth';

/**
 * Server Actions para gestão de anamneses clínicas.
 */

// ── Schemas ───────────────────────────────────────────────────

const criarAnamneseSchema = z.object({
  pacienteId: z.string().min(1),
  conteudo: z.string().min(10, 'Conteúdo deve ter pelo menos 10 caracteres'),
  medicoId: z.string().min(1),
});

const atualizarAnamneseSchema = z.object({
  anamneseId: z.string().min(1),
  conteudo: z.string().min(10, 'Conteúdo deve ter pelo menos 10 caracteres'),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Cria uma nova anamnese para o paciente.
 */
export async function criarAnamnese(
  dados: z.infer<typeof criarAnamneseSchema>,
): Promise<ActionResult<{ anamneseId: string }>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = criarAnamneseSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };

    const [nova] = await db
      .insert(anamneses)
      .values({
        pacienteId: parsed.data.pacienteId,
        conteudo: parsed.data.conteudo,
        criadoPor: parsed.data.medicoId,
      })
      .returning({ id: anamneses.id });

    return { sucesso: true, dados: { anamneseId: nova.id } };
  } catch (error) {
    console.error('[Action] Erro ao criar anamnese:', error);
    return { sucesso: false, erro: 'Erro ao criar anamnese' };
  }
}

/**
 * Atualiza uma anamnese existente.
 */
export async function atualizarAnamnese(
  dados: z.infer<typeof atualizarAnamneseSchema>,
): Promise<ActionResult> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = atualizarAnamneseSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };

    await db
      .update(anamneses)
      .set({ conteudo: parsed.data.conteudo })
      .where(eq(anamneses.id, parsed.data.anamneseId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao atualizar anamnese:', error);
    return { sucesso: false, erro: 'Erro ao atualizar anamnese' };
  }
}

/**
 * Lista anamneses de um paciente.
 */
export async function listarAnamneses(
  pacienteId: string,
): Promise<ActionResult<typeof anamneses.$inferSelect[]>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const resultado = await db
      .select()
      .from(anamneses)
      .where(
        and(
          eq(anamneses.pacienteId, pacienteId),
          isNull(anamneses.deletedAt),
        ),
      )
      .orderBy(desc(anamneses.createdAt));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar anamneses:', error);
    return { sucesso: false, erro: 'Erro ao listar anamneses' };
  }
}
