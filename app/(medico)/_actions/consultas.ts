'use server';

import { db } from '@/lib/db';
import { consultas, pacientes, medicos, notificacoes, users } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { verificarMedico } from '@/lib/auth';
import {
  criarConsultaGoogleCalendar,
  atualizarEventoGoogleCalendar,
  cancelarEventoGoogleCalendar,
} from '@/lib/integrations/google-calendar';
import { listarTodosHorariosDia } from '@/app/(public)/_actions/agendamento';

/**
 * Server Actions para gestão de consultas pelo médico.
 * Fluxos: Nova Consulta, Remarcar, Cancelar
 * Integração: Google Calendar + Meet + Notificações + Brevo
 */

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

/** Resolve o ID do médico a partir do clerkId autenticado */
async function resolverMedicoId(clerkId: string): Promise<string | null> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId));
  if (!user) return null;
  const [medico] = await db.select({ id: medicos.id }).from(medicos).where(eq(medicos.userId, user.id));
  return medico?.id ?? null;
}

// ── Listar consultas do médico ────────────────────────────────

export async function listarConsultasMedico(): Promise<ActionResult<Array<{
  id: string; dataHora: Date; status: string;
  observacoes: string | null; googleMeetLink: string | null;
  pacienteNome: string; pacienteEmail: string; pacienteId: string;
}>>> {
  try {
    const auth = await verificarMedico();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };
    const medicoId = await resolverMedicoId(auth.clerkId);
    if (!medicoId) return { sucesso: false, erro: 'Médico não encontrado' };

    const resultado = await db
      .select({
        id: consultas.id,
        dataHora: consultas.dataHora,
        status: consultas.status,
        observacoes: consultas.observacoes,
        googleMeetLink: consultas.googleMeetLink,
        pacienteNome: users.nome,
        pacienteEmail: users.email,
        pacienteId: pacientes.id,
      })
      .from(consultas)
      .innerJoin(pacientes, eq(consultas.pacienteId, pacientes.id))
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(eq(consultas.medicoId, medicoId))
      .orderBy(desc(consultas.dataHora))
      .limit(100);

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Consultas] Erro ao listar:', error);
    return { sucesso: false, erro: 'Erro ao listar consultas' };
  }
}

// ── Listar pacientes vinculados ao médico ─────────────────────

export async function listarPacientesMedico(): Promise<ActionResult<Array<{
  id: string; nome: string; email: string;
}>>> {
  try {
    const auth = await verificarMedico();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };
    const medicoId = await resolverMedicoId(auth.clerkId);
    if (!medicoId) return { sucesso: false, erro: 'Médico não encontrado' };

    const resultado = await db
      .select({ id: pacientes.id, nome: users.nome, email: users.email })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(eq(pacientes.medicoId, medicoId))
      .orderBy(users.nome);

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Consultas] Erro ao listar pacientes:', error);
    return { sucesso: false, erro: 'Erro ao listar pacientes' };
  }
}

// ── Criar nova consulta ───────────────────────────────────────

export async function criarConsultaMedico(params: {
  pacienteId: string;
  dataHora: string;
  tipo?: string;
  observacoes?: string;
}): Promise<ActionResult<{ id: string; meetLink: string }>> {
  try {
    const auth = await verificarMedico();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };
    const medicoId = await resolverMedicoId(auth.clerkId);
    if (!medicoId) return { sucesso: false, erro: 'Médico não encontrado' };

    // Dados do médico
    const [medico] = await db
      .select({ refreshToken: medicos.googleRefreshToken, email: users.email, nome: users.nome })
      .from(medicos).innerJoin(users, eq(medicos.userId, users.id))
      .where(eq(medicos.id, medicoId));

    // Dados do paciente
    const [paciente] = await db
      .select({ userId: pacientes.userId, email: users.email, nome: users.nome })
      .from(pacientes).innerJoin(users, eq(pacientes.userId, users.id))
      .where(eq(pacientes.id, params.pacienteId));

    if (!paciente) return { sucesso: false, erro: 'Paciente não encontrado' };

    const dataInicio = new Date(params.dataHora);
    const dataFim = new Date(dataInicio.getTime() + 60 * 60 * 1000);

    let googleEventId: string | null = null;
    let googleMeetLink: string | null = null;

    if (medico?.refreshToken) {
      const tipoLabel = params.tipo === 'retorno' ? 'Retorno' : params.tipo === 'urgencia' ? 'Urgência' : 'Consulta';
      const gcResult = await criarConsultaGoogleCalendar({
        titulo: `${tipoLabel} Be4Hope — ${paciente.nome}`,
        descricao: params.observacoes || `${tipoLabel} de medicina endocanabinóide`,
        dataInicio, dataFim,
        emailPaciente: paciente.email, emailMedico: medico.email,
        refreshToken: medico.refreshToken,
      });
      if (gcResult.sucesso && gcResult.dados) {
        googleEventId = gcResult.dados.eventId;
        googleMeetLink = gcResult.dados.meetLink;
      }
    }

    const [novaConsulta] = await db.insert(consultas).values({
      pacienteId: params.pacienteId, medicoId,
      dataHora: dataInicio, status: 'agendada',
      observacoes: params.observacoes || null, googleEventId, googleMeetLink,
    }).returning({ id: consultas.id });

    // Notificação no site
    await db.insert(notificacoes).values({
      userId: paciente.userId, tipo: 'consulta_agendada',
      titulo: 'Nova consulta agendada',
      mensagem: `Sua consulta com ${medico?.nome ?? 'o médico'} foi agendada para ${dataInicio.toLocaleDateString('pt-BR')} às ${dataInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
      linkAcao: '/paciente/consultas',
    });

    // E-mail ao paciente via Brevo
    try {
      const { enviarEmailConsultaAgendada, enviarEmailConsultaMedico } = await import('@/lib/email/consultas');
      await enviarEmailConsultaAgendada({
        pacienteNome: paciente.nome, pacienteEmail: paciente.email,
        medicoNome: medico?.nome ?? 'Médico Be4Hope',
        dataHora: dataInicio, meetLink: googleMeetLink,
      });
      // E-mail ao médico
      if (medico?.email) {
        await enviarEmailConsultaMedico({
          medicoNome: medico.nome,
          medicoEmail: medico.email,
          pacienteNome: paciente.nome,
          pacienteEmail: paciente.email,
          dataHora: dataInicio,
          meetLink: googleMeetLink,
          tipo: params.tipo,
        });
      }
    } catch (e) { console.error('[Consultas] Erro e-mail:', e); }

    return { sucesso: true, dados: { id: novaConsulta.id, meetLink: googleMeetLink || '' } };
  } catch (error) {
    console.error('[Consultas] Erro ao criar:', error);
    return { sucesso: false, erro: 'Erro ao criar consulta' };
  }
}

// ── Remarcar consulta ─────────────────────────────────────────

export async function remarcarConsulta(params: {
  consultaId: string;
  novaDataHora: string;
}): Promise<ActionResult> {
  try {
    const auth = await verificarMedico();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };
    const medicoId = await resolverMedicoId(auth.clerkId);
    if (!medicoId) return { sucesso: false, erro: 'Médico não encontrado' };

    const [consulta] = await db.select().from(consultas)
      .where(and(eq(consultas.id, params.consultaId), eq(consultas.medicoId, medicoId)));
    if (!consulta) return { sucesso: false, erro: 'Consulta não encontrada' };

    const novaDataInicio = new Date(params.novaDataHora);
    const novaDataFim = new Date(novaDataInicio.getTime() + 60 * 60 * 1000);

    if (consulta.googleEventId) {
      const [med] = await db.select({ refreshToken: medicos.googleRefreshToken }).from(medicos).where(eq(medicos.id, medicoId));
      if (med?.refreshToken) {
        const gcResult = await atualizarEventoGoogleCalendar({
          eventId: consulta.googleEventId, refreshToken: med.refreshToken,
          novaDataInicio, novaDataFim,
        });
        if (gcResult.sucesso && gcResult.dados) {
          await db.update(consultas).set({ googleMeetLink: gcResult.dados.meetLink }).where(eq(consultas.id, params.consultaId));
        }
      }
    }

    await db.update(consultas).set({ dataHora: novaDataInicio, status: 'agendada' }).where(eq(consultas.id, params.consultaId));

    const [paciente] = await db
      .select({ userId: pacientes.userId, nome: users.nome, email: users.email })
      .from(pacientes).innerJoin(users, eq(pacientes.userId, users.id))
      .where(eq(pacientes.id, consulta.pacienteId));

    const [medicoData] = await db
      .select({ nome: users.nome })
      .from(medicos).innerJoin(users, eq(medicos.userId, users.id))
      .where(eq(medicos.id, medicoId));

    if (paciente) {
      await db.insert(notificacoes).values({
        userId: paciente.userId, tipo: 'consulta_agendada',
        titulo: 'Consulta remarcada',
        mensagem: `Sua consulta com ${medicoData?.nome ?? 'o médico'} foi remarcada para ${novaDataInicio.toLocaleDateString('pt-BR')} às ${novaDataInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
        linkAcao: '/paciente/consultas',
      });

      try {
        const { enviarEmailConsultaRemarcada } = await import('@/lib/email/consultas');
        await enviarEmailConsultaRemarcada({
          pacienteNome: paciente.nome, pacienteEmail: paciente.email,
          medicoNome: medicoData?.nome ?? 'Médico Be4Hope',
          dataHoraAnterior: consulta.dataHora, dataHoraNova: novaDataInicio,
        });
      } catch (e) { console.error('[Consultas] Erro e-mail remarcação:', e); }
    }

    return { sucesso: true };
  } catch (error) {
    console.error('[Consultas] Erro ao remarcar:', error);
    return { sucesso: false, erro: 'Erro ao remarcar consulta' };
  }
}

// ── Cancelar consulta ─────────────────────────────────────────

export async function cancelarConsultaMedico(params: {
  consultaId: string;
  motivo: string;
}): Promise<ActionResult> {
  try {
    const auth = await verificarMedico();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };
    const medicoId = await resolverMedicoId(auth.clerkId);
    if (!medicoId) return { sucesso: false, erro: 'Médico não encontrado' };

    if (!params.motivo?.trim()) return { sucesso: false, erro: 'Motivo é obrigatório' };

    const [consulta] = await db.select().from(consultas)
      .where(and(eq(consultas.id, params.consultaId), eq(consultas.medicoId, medicoId)));
    if (!consulta) return { sucesso: false, erro: 'Consulta não encontrada' };

    if (consulta.googleEventId) {
      const [med] = await db.select({ refreshToken: medicos.googleRefreshToken }).from(medicos).where(eq(medicos.id, medicoId));
      if (med?.refreshToken) {
        await cancelarEventoGoogleCalendar({ eventId: consulta.googleEventId, refreshToken: med.refreshToken });
      }
    }

    await db.update(consultas).set({
      status: 'cancelada',
      observacoes: `[CANCELADA] ${params.motivo}${consulta.observacoes ? `\n\nObs. anterior: ${consulta.observacoes}` : ''}`,
    }).where(eq(consultas.id, params.consultaId));

    const [paciente] = await db
      .select({ userId: pacientes.userId, nome: users.nome, email: users.email })
      .from(pacientes).innerJoin(users, eq(pacientes.userId, users.id))
      .where(eq(pacientes.id, consulta.pacienteId));

    const [medicoData] = await db
      .select({ nome: users.nome, email: users.email })
      .from(medicos).innerJoin(users, eq(medicos.userId, users.id))
      .where(eq(medicos.id, medicoId));

    if (paciente) {
      await db.insert(notificacoes).values({
        userId: paciente.userId, tipo: 'consulta_cancelada',
        titulo: 'Consulta cancelada',
        mensagem: `Sua consulta com ${medicoData?.nome ?? 'o médico'} de ${consulta.dataHora.toLocaleDateString('pt-BR')} foi cancelada. Motivo: ${params.motivo}`,
        linkAcao: '/paciente/consultas',
      });

      try {
        const { enviarEmailConsultaCancelada, enviarEmailCancelamentoMedico } = await import('@/lib/email/consultas');
        await enviarEmailConsultaCancelada({
          pacienteNome: paciente.nome, pacienteEmail: paciente.email,
          medicoNome: medicoData?.nome ?? 'Médico Be4Hope',
          dataHora: consulta.dataHora, motivo: params.motivo,
        });
        // E-mail ao médico
        if (medicoData?.email) {
          await enviarEmailCancelamentoMedico({
            medicoNome: medicoData.nome,
            medicoEmail: medicoData.email,
            pacienteNome: paciente.nome,
            dataHora: consulta.dataHora,
            motivo: params.motivo,
          });
        }
      } catch (e) { console.error('[Consultas] Erro e-mail cancelamento:', e); }
    }

    return { sucesso: true };
  } catch (error) {
    console.error('[Consultas] Erro ao cancelar:', error);
    return { sucesso: false, erro: 'Erro ao cancelar consulta' };
  }
}

// ── Listar todos os horários do dia (24h, 48 slots) ──────────



export async function listarTodosHorariosMedico(params: {
  data: string; // YYYY-MM-DD
}): Promise<ActionResult<{ horario: string; livre: boolean }[]>> {
  try {
    const auth = await verificarMedico();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };
    const medicoId = await resolverMedicoId(auth.clerkId);
    if (!medicoId) return { sucesso: false, erro: 'Médico não encontrado' };

    return listarTodosHorariosDia({ medicoId, data: params.data });
  } catch (error) {
    console.error('[Consultas] Erro ao listar horários do dia:', error);
    return { sucesso: false, erro: 'Erro ao listar horários' };
  }
}
