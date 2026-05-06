'use server';

import { db } from '@/lib/db';
import { dosagens, medicamentos } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import { verificarMedicoOuAdmin } from '@/lib/auth';

/**
 * Server Actions para gestão de dosagens.
 * Implementa a fórmula de cálculo de recompra:
 *   gotas_totais = ml_frasco × gotas_por_ml
 *   dias_duracao = gotas_totais / gotas_por_dia
 *   data_fim_prevista = data_inicio + dias_duracao
 */

// ── Schemas ───────────────────────────────────────────────────

const criarDosagemSchema = z.object({
  pacienteId: z.string().min(1),
  medicamentoId: z.string().min(1),
  gotasPorDia: z.number().min(1, 'Gotas por dia é obrigatório'),
  mlFrasco: z.number().min(1, 'ML do frasco é obrigatório'),
  dataInicio: z.string().min(1, 'Data de início é obrigatória'),
});

const atualizarDosagemSchema = z.object({
  dosagemId: z.string().min(1),
  gotasPorDia: z.number().min(1).optional(),
  mlFrasco: z.number().min(1).optional(),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Cria uma nova dosagem e desativa a anterior.
 */
export async function criarDosagem(
  dados: z.infer<typeof criarDosagemSchema>,
): Promise<ActionResult<{ dosagemId: string }>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = criarDosagemSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };

    // Buscar gotas por ml do medicamento
    const [med] = await db
      .select({ gotasPorMl: medicamentos.gotasPorMl })
      .from(medicamentos)
      .where(eq(medicamentos.id, parsed.data.medicamentoId))
      .limit(1);

    const gotasPorMl = med?.gotasPorMl || 20;

    // Calcular data fim prevista
    const gotasTotais = parsed.data.mlFrasco * gotasPorMl;
    const diasDuracao = Math.floor(gotasTotais / parsed.data.gotasPorDia);
    const dataInicio = new Date(parsed.data.dataInicio);
    const dataFim = new Date(dataInicio);
    dataFim.setDate(dataFim.getDate() + diasDuracao);

    // Desativar dosagens anteriores do mesmo paciente
    await db
      .update(dosagens)
      .set({ ativa: false })
      .where(
        and(
          eq(dosagens.pacienteId, parsed.data.pacienteId),
          eq(dosagens.ativa, true),
        ),
      );

    // Criar nova dosagem
    const [nova] = await db
      .insert(dosagens)
      .values({
        pacienteId: parsed.data.pacienteId,
        medicamentoId: parsed.data.medicamentoId,
        gotasPorDia: parsed.data.gotasPorDia,
        mlFrasco: parsed.data.mlFrasco,
        dataInicio: parsed.data.dataInicio,
        dataFimPrevista: dataFim.toISOString().split('T')[0],
        ativa: true,
      })
      .returning({ id: dosagens.id });

    return { sucesso: true, dados: { dosagemId: nova.id } };
  } catch (error) {
    console.error('[Action] Erro ao criar dosagem:', error);
    return { sucesso: false, erro: 'Erro ao criar dosagem' };
  }
}

/**
 * Atualiza uma dosagem existente (recalcula data fim).
 */
export async function atualizarDosagem(
  dados: z.infer<typeof atualizarDosagemSchema>,
): Promise<ActionResult> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = atualizarDosagemSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };

    // Buscar dosagem atual para recalcular
    const [dosagemAtual] = await db
      .select()
      .from(dosagens)
      .where(eq(dosagens.id, parsed.data.dosagemId))
      .limit(1);

    if (!dosagemAtual) {
      return { sucesso: false, erro: 'Dosagem não encontrada' };
    }

    const gotasPorDia = parsed.data.gotasPorDia ?? dosagemAtual.gotasPorDia;
    const mlFrasco = parsed.data.mlFrasco ?? dosagemAtual.mlFrasco;

    // Buscar gotas por ml
    const [med] = await db
      .select({ gotasPorMl: medicamentos.gotasPorMl })
      .from(medicamentos)
      .where(eq(medicamentos.id, dosagemAtual.medicamentoId))
      .limit(1);

    const gotasPorMl = med?.gotasPorMl || 20;
    const gotasTotais = mlFrasco * gotasPorMl;
    const diasDuracao = Math.floor(gotasTotais / gotasPorDia);
    const dataInicio = new Date(dosagemAtual.dataInicio);
    const dataFim = new Date(dataInicio);
    dataFim.setDate(dataFim.getDate() + diasDuracao);

    await db
      .update(dosagens)
      .set({
        gotasPorDia,
        mlFrasco,
        dataFimPrevista: dataFim.toISOString().split('T')[0],
      })
      .where(eq(dosagens.id, parsed.data.dosagemId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao atualizar dosagem:', error);
    return { sucesso: false, erro: 'Erro ao atualizar dosagem' };
  }
}

/**
 * Desativa uma dosagem.
 */
export async function desativarDosagem(
  dosagemId: string,
): Promise<ActionResult> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    await db
      .update(dosagens)
      .set({ ativa: false })
      .where(eq(dosagens.id, dosagemId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao desativar dosagem:', error);
    return { sucesso: false, erro: 'Erro ao desativar dosagem' };
  }
}

/**
 * Lista dosagens de um paciente.
 */
export async function listarDosagens(
  pacienteId: string,
): Promise<ActionResult<Array<{
  id: string;
  medicamentoNome: string;
  gotasPorDia: number;
  mlFrasco: number;
  dataInicio: string;
  dataFimPrevista: string;
  ativa: boolean;
}>>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const resultado = await db
      .select({
        id: dosagens.id,
        medicamentoNome: medicamentos.nome,
        gotasPorDia: dosagens.gotasPorDia,
        mlFrasco: dosagens.mlFrasco,
        dataInicio: dosagens.dataInicio,
        dataFimPrevista: dosagens.dataFimPrevista,
        ativa: dosagens.ativa,
      })
      .from(dosagens)
      .innerJoin(medicamentos, eq(dosagens.medicamentoId, medicamentos.id))
      .where(eq(dosagens.pacienteId, pacienteId))
      .orderBy(desc(dosagens.createdAt));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar dosagens:', error);
    return { sucesso: false, erro: 'Erro ao listar dosagens' };
  }
}

/**
 * Lista todos os medicamentos disponíveis.
 */
export async function listarMedicamentos(): Promise<ActionResult<typeof medicamentos.$inferSelect[]>> {
  try {
    const resultado = await db
      .select()
      .from(medicamentos)
      .orderBy(medicamentos.nome);

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar medicamentos:', error);
    return { sucesso: false, erro: 'Erro ao listar medicamentos' };
  }
}
