'use server';

import { db } from '@/lib/db';
import { consultas, medicos, pacientes, users } from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { z } from 'zod';
import { criarConsultaGoogleCalendar, cancelarEventoGoogleCalendar } from '@/lib/integrations/google-calendar';
import { enviarEmailConsultaAgendada } from '@/lib/email/consultas';
import { format } from 'date-fns';

/**
 * Server Actions de agendamento de consultas.
 *
 * Regra (CLAUDE.md): Consulta só é confirmada APÓS criação bem-sucedida
 * do evento no Google Calendar. Em caso de falha, a transação é revertida.
 */

// ── Schemas de validação ──────────────────────────────────────

const agendarConsultaSchema = z.object({
  pacienteId: z.string().min(1, 'ID do paciente é obrigatório'),
  medicoId: z.string().min(1, 'ID do médico é obrigatório'),
  dataHora: z.string().datetime('Data/hora inválida'),
  observacoes: z.string().optional(),
});

const cancelarConsultaSchema = z.object({
  consultaId: z.string().min(1, 'ID da consulta é obrigatório'),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Agenda uma nova consulta.
 * 1. Valida dados
 * 2. Busca dados do médico e paciente
 * 3. Cria evento no Google Calendar com Meet
 * 4. Salva no banco
 * 5. Envia e-mail de confirmação
 */
export async function agendarConsulta(
  dados: z.infer<typeof agendarConsultaSchema>,
): Promise<ActionResult<{ consultaId: string; meetLink: string }>> {
  try {
    // Validar entrada
    const parsed = agendarConsultaSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const { pacienteId, medicoId, dataHora, observacoes } = parsed.data;

    // Buscar dados do médico
    const [medico] = await db
      .select()
      .from(medicos)
      .innerJoin(users, eq(medicos.userId, users.id))
      .where(eq(medicos.id, medicoId))
      .limit(1);

    if (!medico) {
      return { sucesso: false, erro: 'Médico não encontrado' };
    }

    // Buscar dados do paciente
    const [paciente] = await db
      .select()
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(eq(pacientes.id, pacienteId))
      .limit(1);

    if (!paciente) {
      return { sucesso: false, erro: 'Paciente não encontrado' };
    }

    const dataConsulta = new Date(dataHora);
    const dataFim = new Date(dataConsulta.getTime() + 60 * 60 * 1000); // +1 hora

    // Tentar criar evento no Google Calendar
    let googleEventId: string | null = null;
    let meetLink: string | null = null;

    if (medico.medicos.googleRefreshToken) {
      const resultadoGoogle = await criarConsultaGoogleCalendar({
        titulo: `Consulta Be4Hope — ${paciente.users.nome}`,
        descricao: observacoes || 'Consulta de medicina endocanabinóide',
        dataInicio: dataConsulta,
        dataFim,
        emailPaciente: paciente.users.email,
        emailMedico: medico.users.email,
        refreshToken: medico.medicos.googleRefreshToken,
        calendarId: medico.medicos.googleCalendarId || undefined,
      });

      if (!resultadoGoogle.sucesso) {
        return {
          sucesso: false,
          erro: `Falha ao criar evento no Google Calendar: ${resultadoGoogle.erro}`,
        };
      }

      googleEventId = resultadoGoogle.dados?.eventId || null;
      meetLink = resultadoGoogle.dados?.meetLink || null;
    }

    // Salvar consulta no banco
    const [novaConsulta] = await db
      .insert(consultas)
      .values({
        pacienteId,
        medicoId,
        dataHora: dataConsulta,
        status: medico.medicos.googleRefreshToken ? 'confirmada' : 'agendada',
        googleEventId,
        googleMeetLink: meetLink,
        observacoes,
      })
      .returning({ id: consultas.id });

    // Enviar e-mail de confirmação ao paciente via Brevo
    try {
      await enviarEmailConsultaAgendada({
        pacienteNome: paciente.users.nome,
        pacienteEmail: paciente.users.email,
        medicoNome: medico.users.nome,
        dataHora: dataConsulta,
        meetLink,
      });
    } catch (emailError) {
      console.error('[Action] Erro ao enviar e-mail de confirmação:', emailError);
      // Não falha a action — consulta já foi criada
    }

    return {
      sucesso: true,
      dados: {
        consultaId: novaConsulta.id,
        meetLink: meetLink || '',
      },
    };
  } catch (error) {
    console.error('[Action] Erro ao agendar consulta:', error);
    return { sucesso: false, erro: 'Erro interno ao agendar consulta' };
  }
}

/**
 * Cancela uma consulta existente.
 */
export async function cancelarConsulta(
  dados: z.infer<typeof cancelarConsultaSchema>,
): Promise<ActionResult> {
  try {
    const parsed = cancelarConsultaSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    // Buscar consulta
    const [consulta] = await db
      .select()
      .from(consultas)
      .where(eq(consultas.id, parsed.data.consultaId))
      .limit(1);

    if (!consulta) {
      return { sucesso: false, erro: 'Consulta não encontrada' };
    }

    // Cancelar no Google Calendar se existir
    if (consulta.googleEventId) {
      const [medico] = await db
        .select()
        .from(medicos)
        .where(eq(medicos.id, consulta.medicoId))
        .limit(1);

      if (medico?.googleRefreshToken) {
        await cancelarEventoGoogleCalendar({
          eventId: consulta.googleEventId,
          refreshToken: medico.googleRefreshToken,
          calendarId: medico.googleCalendarId || undefined,
        });
      }
    }

    // Atualizar status
    await db
      .update(consultas)
      .set({ status: 'cancelada' })
      .where(eq(consultas.id, parsed.data.consultaId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao cancelar consulta:', error);
    return { sucesso: false, erro: 'Erro interno ao cancelar consulta' };
  }
}

/**
 * Lista consultas de um médico em um período.
 */
export async function listarConsultasMedico(params: {
  medicoId: string;
  dataInicio?: string;
  dataFim?: string;
}): Promise<ActionResult<typeof consultas.$inferSelect[]>> {
  try {
    const condicoes = [eq(consultas.medicoId, params.medicoId)];

    if (params.dataInicio) {
      condicoes.push(gte(consultas.dataHora, new Date(params.dataInicio)));
    }
    if (params.dataFim) {
      condicoes.push(lte(consultas.dataHora, new Date(params.dataFim)));
    }

    const resultado = await db
      .select()
      .from(consultas)
      .where(and(...condicoes))
      .orderBy(desc(consultas.dataHora));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar consultas:', error);
    return { sucesso: false, erro: 'Erro ao listar consultas' };
  }
}

/**
 * Lista médicos disponíveis para agendamento público.
 * Retorna apenas nome, especialidade e disponibilidade (se Google Calendar conectado).
 */
export async function listarMedicosDisponiveis(): Promise<ActionResult<Array<{
  id: string;
  nome: string;
  especialidade: string;
  bio: string | null;
  googleConectado: boolean;
}>>> {
  try {
    const resultado = await db
      .select({
        id: medicos.id,
        nome: users.nome,
        especialidade: medicos.especialidade,
        bio: medicos.bio,
        googleRefreshToken: medicos.googleRefreshToken,
      })
      .from(medicos)
      .innerJoin(users, eq(medicos.userId, users.id));

    const lista = resultado.map((m) => ({
      id: m.id,
      nome: m.nome,
      especialidade: m.especialidade,
      bio: m.bio,
      googleConectado: !!m.googleRefreshToken,
    }));

    return { sucesso: true, dados: lista };
  } catch (error) {
    console.error('[Action] Erro ao listar médicos:', error);
    return { sucesso: false, erro: 'Erro ao listar médicos' };
  }
}

/**
 * Lista horários livres de um médico em uma data específica.
 * Slots de 1h, das 08:00 às 18:00 (horário comercial).
 * Exclui horários com consultas já agendadas ou confirmadas.
 */
export async function listarHorariosLivres(params: {
  medicoId: string;
  data: string; // formato YYYY-MM-DD
}): Promise<ActionResult<string[]>> {
  try {
    const { medicoId, data } = params;

    // Gerar todos os slots possíveis (08:00–17:00 = início, cada slot dura 1h)
    const HORARIOS_POSSIVEIS = [
      '08:00', '09:00', '10:00', '11:00',
      '13:00', '14:00', '15:00', '16:00', '17:00',
    ];

    const inicioData = new Date(`${data}T00:00:00`);
    const fimData = new Date(`${data}T23:59:59`);

    // Buscar consultas existentes neste dia para este médico
    const consultasExistentes = await db
      .select({ dataHora: consultas.dataHora })
      .from(consultas)
      .where(
        and(
          eq(consultas.medicoId, medicoId),
          gte(consultas.dataHora, inicioData),
          lte(consultas.dataHora, fimData),
        ),
      );

    // Filtrar horários ocupados
    const horariosOcupados = new Set(
      consultasExistentes.map((c) =>
        format(new Date(c.dataHora), 'HH:mm'),
      ),
    );

    const horariosLivres = HORARIOS_POSSIVEIS.filter(
      (h) => !horariosOcupados.has(h),
    );

    return { sucesso: true, dados: horariosLivres };
  } catch (error) {
    console.error('[Action] Erro ao listar horários:', error);
    return { sucesso: false, erro: 'Erro ao listar horários livres' };
  }
}

/**
 * Lista TODOS os slots de 30 minutos das 24h de um dia com status.
 * Retorna array com { horario: 'HH:mm', livre: boolean }.
 * Usado na agenda do médico para visão completa do dia.
 */
export async function listarTodosHorariosDia(params: {
  medicoId: string;
  data: string; // formato YYYY-MM-DD
}): Promise<ActionResult<{ horario: string; livre: boolean }[]>> {
  try {
    const { medicoId, data } = params;

    // Gerar todos os slots de 30 em 30 min — 00:00 a 23:30
    const TODOS_SLOTS: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30]) {
        TODOS_SLOTS.push(
          `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        );
      }
    }

    const inicioData = new Date(`${data}T00:00:00`);
    const fimData = new Date(`${data}T23:59:59`);

    // Buscar consultas existentes neste dia para este médico
    const consultasExistentes = await db
      .select({ dataHora: consultas.dataHora, status: consultas.status })
      .from(consultas)
      .where(
        and(
          eq(consultas.medicoId, medicoId),
          gte(consultas.dataHora, inicioData),
          lte(consultas.dataHora, fimData),
        ),
      );

    // Horários ocupados = consultas ativas (não canceladas)
    const horariosOcupados = new Set(
      consultasExistentes
        .filter((c) => c.status !== 'cancelada')
        .map((c) => format(new Date(c.dataHora), 'HH:mm')),
    );

    const resultado = TODOS_SLOTS.map((horario) => ({
      horario,
      livre: !horariosOcupados.has(horario),
    }));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar todos os horários:', error);
    return { sucesso: false, erro: 'Erro ao listar horários do dia' };
  }
}
