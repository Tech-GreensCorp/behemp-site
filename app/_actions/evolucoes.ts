'use server';

import { db } from '@/lib/db';
import { evolucoes } from '@/db/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { verificarMedicoOuAdmin } from '@/lib/auth';

/**
 * Server Actions para registro de evoluções clínicas.
 * Inclui indicadores numéricos para gráficos de acompanhamento.
 */

// ── Schemas ───────────────────────────────────────────────────

const criarEvolucaoSchema = z.object({
  pacienteId: z.string().min(1),
  data: z.string().min(1, 'Data é obrigatória'),
  conteudo: z.string().min(5, 'Conteúdo deve ter pelo menos 5 caracteres'),
  nivelDor: z.number().min(0).max(10).optional(),
  qualidadeSono: z.number().min(0).max(10).optional(),
  bemEstar: z.number().min(0).max(10).optional(),
  medicoId: z.string().min(1),
});

const atualizarEvolucaoSchema = z.object({
  evolucaoId: z.string().min(1),
  conteudo: z.string().min(5).optional(),
  nivelDor: z.number().min(0).max(10).optional(),
  qualidadeSono: z.number().min(0).max(10).optional(),
  bemEstar: z.number().min(0).max(10).optional(),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Cria uma nova evolução clínica.
 */
export async function criarEvolucao(
  dados: z.infer<typeof criarEvolucaoSchema>,
): Promise<ActionResult<{ evolucaoId: string }>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = criarEvolucaoSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };

    const [nova] = await db
      .insert(evolucoes)
      .values({
        pacienteId: parsed.data.pacienteId,
        data: parsed.data.data,
        conteudo: parsed.data.conteudo,
        nivelDor: parsed.data.nivelDor,
        qualidadeSono: parsed.data.qualidadeSono,
        bemEstar: parsed.data.bemEstar,
        criadoPor: parsed.data.medicoId,
      })
      .returning({ id: evolucoes.id });

    return { sucesso: true, dados: { evolucaoId: nova.id } };
  } catch (error) {
    console.error('[Action] Erro ao criar evolução:', error);
    return { sucesso: false, erro: 'Erro ao criar evolução' };
  }
}

/**
 * Atualiza uma evolução existente.
 */
export async function atualizarEvolucao(
  dados: z.infer<typeof atualizarEvolucaoSchema>,
): Promise<ActionResult> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = atualizarEvolucaoSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };

    const { evolucaoId, ...updates } = parsed.data;

    await db
      .update(evolucoes)
      .set(updates)
      .where(eq(evolucoes.id, evolucaoId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao atualizar evolução:', error);
    return { sucesso: false, erro: 'Erro ao atualizar evolução' };
  }
}

/**
 * Lista evoluções de um paciente (ordenadas por data desc).
 */
export async function listarEvolucoes(
  pacienteId: string,
): Promise<ActionResult<typeof evolucoes.$inferSelect[]>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const resultado = await db
      .select()
      .from(evolucoes)
      .where(
        and(
          eq(evolucoes.pacienteId, pacienteId),
          isNull(evolucoes.deletedAt),
        ),
      )
      .orderBy(desc(evolucoes.data));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar evoluções:', error);
    return { sucesso: false, erro: 'Erro ao listar evoluções' };
  }
}
