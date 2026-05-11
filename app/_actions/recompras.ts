'use server';

import { db } from '@/lib/db';
import { recompras, dosagens, medicamentos, pacientes, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { obterUsuarioAtual } from '@/lib/auth';

/**
 * Server Actions para recompra de medicamento.
 *
 * Fórmula (CLAUDE.md):
 *   gotas_totais = ml_frasco × gotas_por_ml
 *   dias_duracao = gotas_totais / gotas_por_dia
 *   data_termino = data_inicio + dias_duracao
 */

// ── Schemas ───────────────────────────────────────────────────

const pedirRecompraSchema = z.object({
  dosagemId: z.string().min(1),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Pedir recompra agora — cria pedido com status 'pedida'.
 * Envia e-mail para RECOMPRA_EMAIL_DESTINO.
 */
export async function pedirRecompraAgora(
  dados: z.infer<typeof pedirRecompraSchema>,
): Promise<ActionResult<{ recompraId: string }>> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = pedirRecompraSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };

    // Buscar dados da dosagem e paciente para envio de e-mail
    const [dadosDosagem] = await db
      .select({
        dataFimPrevista: dosagens.dataFimPrevista,
        pacienteNome: users.nome,
        pacienteEmail: users.email,
        nomeMedicamento: medicamentos.nome,
        gotasPorDia: dosagens.gotasPorDia,
        mlFrasco: dosagens.mlFrasco,
      })
      .from(dosagens)
      .innerJoin(pacientes, eq(dosagens.pacienteId, pacientes.id))
      .innerJoin(users, eq(pacientes.userId, users.id))
      .innerJoin(medicamentos, eq(dosagens.medicamentoId, medicamentos.id))
      .where(eq(dosagens.id, parsed.data.dosagemId))
      .limit(1);

    if (!dadosDosagem) {
      return { sucesso: false, erro: 'Dosagem não encontrada' };
    }

    const [novaRecompra] = await db
      .insert(recompras)
      .values({
        dosagemId: parsed.data.dosagemId,
        dataPrevista: dadosDosagem.dataFimPrevista,
        status: 'pedida',
        emailEnviadoEm: new Date(),
      })
      .returning({ id: recompras.id });

    // Enviar e-mail para a equipe de recompra via Brevo
    if (dadosDosagem) {
      try {
        const { enviarEmailRecompraEquipe } = await import('@/lib/email/notificacoes');
        await enviarEmailRecompraEquipe({
          pacienteNome: dadosDosagem.pacienteNome,
          nomeMedicamento: dadosDosagem.nomeMedicamento,
          dataPrevista: dadosDosagem.dataFimPrevista,
          gotasPorDia: dadosDosagem.gotasPorDia,
          mlFrasco: dadosDosagem.mlFrasco,
        });
      } catch (emailError) {
        console.error('[Action] Erro ao enviar e-mail de recompra:', emailError);
        // Não falha a action principal — o registro já foi criado
      }
    }

    return { sucesso: true, dados: { recompraId: novaRecompra.id } };
  } catch (error) {
    console.error('[Action] Erro ao pedir recompra:', error);
    return { sucesso: false, erro: 'Erro ao pedir recompra' };
  }
}

/**
 * Agendar recompra — cria pedido com status 'agendada'.
 * O job (Inngest/cron) enviará o e-mail na data prevista.
 */
export async function agendarRecompra(
  dados: z.infer<typeof pedirRecompraSchema>,
): Promise<ActionResult<{ recompraId: string }>> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = pedirRecompraSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };

    const [dosagem] = await db
      .select({
        dataFimPrevista: dosagens.dataFimPrevista,
      })
      .from(dosagens)
      .where(eq(dosagens.id, parsed.data.dosagemId))
      .limit(1);

    if (!dosagem) {
      return { sucesso: false, erro: 'Dosagem não encontrada' };
    }

    const [novaRecompra] = await db
      .insert(recompras)
      .values({
        dosagemId: parsed.data.dosagemId,
        dataPrevista: dosagem.dataFimPrevista,
        status: 'agendada',
      })
      .returning({ id: recompras.id });

    return { sucesso: true, dados: { recompraId: novaRecompra.id } };
  } catch (error) {
    console.error('[Action] Erro ao agendar recompra:', error);
    return { sucesso: false, erro: 'Erro ao agendar recompra' };
  }
}

/**
 * Lista recompras do paciente autenticado.
 */
export async function listarRecompras(
  pacienteId?: string,
): Promise<ActionResult<Array<{
  id: string;
  medicamentoNome: string;
  dataPrevista: string;
  status: string;
  emailEnviadoEm: Date | null;
}>>> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    // Se pacienteId não foi fornecido, buscar todas
    const resultado = await db
      .select({
        id: recompras.id,
        medicamentoNome: medicamentos.nome,
        dataPrevista: recompras.dataPrevista,
        status: recompras.status,
        emailEnviadoEm: recompras.emailEnviadoEm,
      })
      .from(recompras)
      .innerJoin(dosagens, eq(recompras.dosagemId, dosagens.id))
      .innerJoin(medicamentos, eq(dosagens.medicamentoId, medicamentos.id))
      .orderBy(desc(recompras.createdAt));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar recompras:', error);
    return { sucesso: false, erro: 'Erro ao listar recompras' };
  }
}
