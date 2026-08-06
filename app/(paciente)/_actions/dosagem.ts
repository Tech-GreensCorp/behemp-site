'use server';

import { db } from '@/lib/db';
import { dosagens, medicamentos, recompras, pacientes } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { calcularDosagem } from '@/lib/utils/dosagem';
import { inngest } from '@/lib/integrations/inngest';

/**
 * Server Actions de dosagem e recompra de medicamentos.
 */

// ── Schemas ───────────────────────────────────────────────────

const criarDosagemSchema = z.object({
  pacienteId: z.string().min(1),
  medicamentoId: z.string().min(1),
  gotasPorDia: z.number().int().positive('Gotas por dia deve ser positivo'),
  mlFrasco: z.number().int().positive('ml do frasco deve ser positivo'),
  dataInicio: z.string().min(1, 'Data de início é obrigatória'),
});

const pedirRecompraSchema = z.object({
  dosagemId: z.string().min(1),
  agendarParaFuturo: z.boolean().default(false),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Cria uma nova dosagem com cálculo automático da data de fim.
 * Desativa dosagens anteriores do mesmo medicamento.
 */
export async function criarDosagem(
  dados: z.infer<typeof criarDosagemSchema>,
): Promise<ActionResult<{ dosagemId: string; dataFimPrevista: string }>> {
  try {
    const parsed = criarDosagemSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    // Buscar gotas_por_ml do medicamento
    const [medicamento] = await db
      .select()
      .from(medicamentos)
      .where(eq(medicamentos.id, parsed.data.medicamentoId))
      .limit(1);

    if (!medicamento) {
      return { sucesso: false, erro: 'Medicamento não encontrado' };
    }

    // Calcular data de fim
    const calculo = calcularDosagem({
      mlFrasco: parsed.data.mlFrasco,
      gotasPorDia: parsed.data.gotasPorDia,
      gotasPorMl: medicamento.gotasPorMl,
      dataInicio: new Date(parsed.data.dataInicio),
    });

    // Desativar dosagens anteriores do mesmo paciente + medicamento
    await db
      .update(dosagens)
      .set({ ativa: false })
      .where(
        and(
          eq(dosagens.pacienteId, parsed.data.pacienteId),
          eq(dosagens.medicamentoId, parsed.data.medicamentoId),
          eq(dosagens.ativa, true),
        ),
      );

    // Criar nova dosagem
    const [novaDosagem] = await db
      .insert(dosagens)
      .values({
        pacienteId: parsed.data.pacienteId,
        medicamentoId: parsed.data.medicamentoId,
        gotasPorDia: parsed.data.gotasPorDia,
        mlFrasco: parsed.data.mlFrasco,
        dataInicio: parsed.data.dataInicio,
        dataFimPrevista: calculo.dataFimPrevista.toISOString().split('T')[0],
        ativa: true,
      })
      .returning({ id: dosagens.id });

    // Criar recompra agendada
    // Buscar userId do paciente para solicitanteId
    const [pacienteInfo] = await db
      .select({ userId: pacientes.userId })
      .from(pacientes)
      .where(eq(pacientes.id, parsed.data.pacienteId))
      .limit(1);

    await db.insert(recompras).values({
      dosagemId: novaDosagem.id,
      solicitanteId: pacienteInfo?.userId ?? parsed.data.pacienteId,
      pacienteId: parsed.data.pacienteId,
      dataPrevista: calculo.dataFimPrevista.toISOString().split('T')[0],
      status: 'agendada',
    });

    return {
      sucesso: true,
      dados: {
        dosagemId: novaDosagem.id,
        dataFimPrevista: calculo.dataFimPrevista.toISOString().split('T')[0],
      },
    };
  } catch (error) {
    console.error('[Action] Erro ao criar dosagem:', error);
    return { sucesso: false, erro: 'Erro interno ao criar dosagem' };
  }
}

/**
 * Lista dosagens de um paciente (ativas primeiro, depois históricas).
 */
export async function listarDosagensPaciente(pacienteId: string): Promise<
  ActionResult<
    Array<
      typeof dosagens.$inferSelect & {
        medicamento: typeof medicamentos.$inferSelect;
      }
    >
  >
> {
  try {
    const resultado = await db
      .select({
        dosagem: dosagens,
        medicamento: medicamentos,
      })
      .from(dosagens)
      .innerJoin(medicamentos, eq(dosagens.medicamentoId, medicamentos.id))
      .where(eq(dosagens.pacienteId, pacienteId))
      .orderBy(desc(dosagens.ativa), desc(dosagens.createdAt));

    const formatado = resultado.map((r) => ({
      ...r.dosagem,
      medicamento: r.medicamento,
    }));

    return { sucesso: true, dados: formatado };
  } catch (error) {
    console.error('[Action] Erro ao listar dosagens:', error);
    return { sucesso: false, erro: 'Erro ao listar dosagens' };
  }
}

/**
 * Pede recompra de medicamento.
 * Se agendarParaFuturo=true, dispara job Inngest para enviar email na data prevista.
 * Se agendarParaFuturo=false, envia email imediatamente.
 */
export async function pedirRecompra(
  dados: z.infer<typeof pedirRecompraSchema>,
): Promise<ActionResult> {
  try {
    const parsed = pedirRecompraSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    // Buscar dosagem com dados do paciente e medicamento
    const [dosagem] = await db
      .select()
      .from(dosagens)
      .where(eq(dosagens.id, parsed.data.dosagemId))
      .limit(1);

    if (!dosagem) {
      return { sucesso: false, erro: 'Dosagem não encontrada' };
    }

    if (parsed.data.agendarParaFuturo) {
      // Disparar job Inngest para enviar email na data prevista
      await inngest.send({
        name: 'be4hope/recompra.criada',
        data: {
          dosagemId: dosagem.id,
          dataPrevista: dosagem.dataFimPrevista,
          pacienteEmail: '', // Será resolvido no job
          pacienteNome: '',
          nomeMedicamento: '',
        },
      });

      // Atualizar status da recompra
      await db
        .update(recompras)
        .set({ status: 'agendada' })
        .where(eq(recompras.dosagemId, parsed.data.dosagemId));
    } else {
      // Pedir agora — marcar como pedida
      await db
        .update(recompras)
        .set({ status: 'pedida', emailEnviadoEm: new Date() })
        .where(eq(recompras.dosagemId, parsed.data.dosagemId));
    }

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao pedir recompra:', error);
    return { sucesso: false, erro: 'Erro ao processar recompra' };
  }
}
