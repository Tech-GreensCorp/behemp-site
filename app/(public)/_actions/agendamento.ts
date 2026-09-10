'use server';

import { db } from '@/lib/db';
import { consultas, medicos, pacientes, pagamentos, users } from '@/db/schema';
import { eq, and, gte, lte, isNull, asc } from 'drizzle-orm';
import { z } from 'zod';
import { verificarPaciente } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/utils/audit';
import { revalidatePath } from 'next/cache';
import { criarConsultaGoogleCalendar, cancelarEventoGoogleCalendar } from '@/lib/integrations/google-calendar';
import { enviarEmailConsultaAgendada, enviarEmailConsultaMedico } from '@/lib/email/consultas';
import { format } from 'date-fns';

/**
 * Server Actions de agendamento de consultas.
 *
 * Fluxo em duas etapas:
 * 1. `reservarConsulta` — trava o horário (`status: 'reservada'`) por um prazo curto
 *    (`RESERVA_TTL_MINUTOS`). Ninguém mais consegue reservar o mesmo horário enquanto
 *    a reserva estiver ativa (garantido pelo índice único de `consultas`).
 * 2. `confirmarAgendamento` — dentro do prazo, confirma de fato: tenta o Google
 *    Calendar (falha não bloqueia — token expirado/"invalid_grant" não deve travar
 *    todos os agendamentos do médico), envia e-mails, e vincula o pagamento.
 *
 * Reservas que expiram sem confirmação são liberadas por um job (ver
 * `liberarReservasExpiradas` em lib/integrations/inngest/functions.ts).
 */

/** Placeholder ajustável — quanto tempo o paciente tem para confirmar após reservar. */
const RESERVA_TTL_MINUTOS = 15;

// ── Schemas de validação ──────────────────────────────────────

const reservarConsultaSchema = z.object({
  medicoId: z.string().min(1, 'ID do médico é obrigatório'),
  dataHora: z.string().datetime('Data/hora inválida'),
  observacoes: z.string().optional(),
});

const confirmarAgendamentoSchema = z.object({
  consultaId: z.string().min(1, 'ID da consulta é obrigatório'),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

/**
 * Registra o motivo pelo qual a confirmação falhou no pagamento vinculado à consulta —
 * best-effort, nunca deixa a falha de escrita mascarar o erro original.
 */
async function marcarErroConfirmacao(consultaId: string, mensagem: string): Promise<void> {
  try {
    await db
      .update(pagamentos)
      .set({ erroConfirmacao: mensagem })
      .where(eq(pagamentos.consultaId, consultaId));
  } catch (erro) {
    console.error('[Action] Falha ao registrar erro de confirmação no pagamento:', erro);
  }
}

/**
 * Reserva um horário: cria a consulta com status 'reservada' e prazo de confirmação,
 * e o registro de pagamento vinculado a ela. Autenticação obrigatória — pacienteId
 * nunca vem do client, sempre resolvido a partir do usuário autenticado.
 */
export async function reservarConsulta(
  dados: z.infer<typeof reservarConsultaSchema>,
): Promise<ActionResult<{ consultaId: string; expiraEm: string; valor: number; moeda: string }>> {
  try {
    const parsed = reservarConsultaSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const { medicoId, dataHora, observacoes } = parsed.data;

    const auth = await verificarPaciente();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: 'Autenticação necessária para agendar' };
    }

    const [userInterno] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, auth.clerkId))
      .limit(1);

    if (!userInterno) {
      return { sucesso: false, erro: 'Usuário não encontrado no sistema' };
    }

    const [pacienteAuto] = await db
      .select({ id: pacientes.id })
      .from(pacientes)
      .where(and(eq(pacientes.userId, userInterno.id), isNull(pacientes.deletedAt)))
      .limit(1);

    if (!pacienteAuto) {
      return {
        sucesso: false,
        erro: 'Seu cadastro de paciente não foi encontrado. Entre em contato com a clínica.',
      };
    }

    const pacienteId = pacienteAuto.id;

    const [medico] = await db
      .select({ valorConsulta: medicos.valorConsulta })
      .from(medicos)
      .where(eq(medicos.id, medicoId))
      .limit(1);

    if (!medico) {
      return { sucesso: false, erro: 'Médico não encontrado' };
    }

    const dataConsulta = new Date(dataHora);
    const expiraEm = new Date(Date.now() + RESERVA_TTL_MINUTOS * 60 * 1000);

    // O índice único parcial de `consultas` (medicoId+dataHora, status <> 'cancelada')
    // garante a exclusividade — 'reservada' já conta como ativa.
    let novaConsulta: { id: string };
    try {
      [novaConsulta] = await db
        .insert(consultas)
        .values({
          pacienteId,
          medicoId,
          dataHora: dataConsulta,
          status: 'reservada',
          expiraEm,
          observacoes,
        })
        .returning({ id: consultas.id });
    } catch (dbError) {
      const codigo = (dbError as { code?: string }).code;
      if (codigo === '23505') {
        return {
          sucesso: false,
          erro: 'Este horário acabou de ser reservado por outra pessoa. Escolha outro horário.',
        };
      }
      throw dbError;
    }

    await registrarAuditoria({
      userId: userInterno.id,
      acao: 'criar',
      entidade: 'consultas',
      entidadeId: novaConsulta.id,
      dadosDepois: { medicoId, dataHora: dataConsulta.toISOString(), status: 'reservada', expiraEm: expiraEm.toISOString() },
    });

    const config = await db.query.pagamentosConfig.findFirst();
    const moeda = config?.moedaPadrao ?? 'BRL';
    const valor = medico.valorConsulta !== null && medico.valorConsulta !== undefined
      ? Number(medico.valorConsulta)
      : Number(config?.valorConsultaPadrao ?? 150);

    try {
      await db.insert(pagamentos).values({
        consultaId: novaConsulta.id,
        pacienteId,
        medicoId,
        dataHora: dataConsulta,
        valor: valor.toFixed(2),
        moeda,
      });
    } catch (pagamentoError) {
      // Não falha a reserva por causa do registro de pagamento — a consulta já existe.
      console.error('[Action] Falha ao criar registro de pagamento da reserva:', pagamentoError);
    }

    revalidatePath('/admin/pagamentos');

    return {
      sucesso: true,
      dados: { consultaId: novaConsulta.id, expiraEm: expiraEm.toISOString(), valor, moeda },
    };
  } catch (error) {
    console.error('[Action] Erro ao reservar consulta:', error);
    return { sucesso: false, erro: 'Erro interno ao reservar horário' };
  }
}

/**
 * Confirma uma reserva dentro do prazo.
 * 1. Valida dono e prazo da reserva
 * 2. Tenta criar evento no Google Calendar com Meet — falha não bloqueia
 * 3. Atualiza a consulta para 'confirmada'/'agendada' e limpa o prazo
 * 4. Envia e-mail de confirmação
 */
export async function confirmarAgendamento(
  dados: z.infer<typeof confirmarAgendamentoSchema>,
): Promise<ActionResult<{ consultaId: string; meetLink: string }>> {
  try {
    const parsed = confirmarAgendamentoSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const { consultaId } = parsed.data;

    const auth = await verificarPaciente();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: 'Autenticação necessária para agendar' };
    }

    const [userInterno] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, auth.clerkId))
      .limit(1);

    if (!userInterno) {
      return { sucesso: false, erro: 'Usuário não encontrado no sistema' };
    }

    const [pacienteAuto] = await db
      .select({ id: pacientes.id })
      .from(pacientes)
      .where(and(eq(pacientes.userId, userInterno.id), isNull(pacientes.deletedAt)))
      .limit(1);

    if (!pacienteAuto) {
      return {
        sucesso: false,
        erro: 'Seu cadastro de paciente não foi encontrado. Entre em contato com a clínica.',
      };
    }

    const pacienteId = pacienteAuto.id;

    // A consulta precisa existir e pertencer a este paciente — nunca confiamos só no
    // id vindo do client. Não distinguimos "não existe" de "não é sua" (evita enumeração).
    const [reserva] = await db
      .select()
      .from(consultas)
      .where(and(eq(consultas.id, consultaId), eq(consultas.pacienteId, pacienteId)))
      .limit(1);

    if (!reserva) {
      return { sucesso: false, erro: 'Reserva não encontrada.' };
    }

    if (reserva.status !== 'reservada') {
      return {
        sucesso: false,
        erro: reserva.status === 'cancelada'
          ? 'Sua reserva expirou ou foi cancelada. Escolha um novo horário.'
          : 'Este agendamento já foi confirmado anteriormente.',
      };
    }

    if (reserva.expiraEm && reserva.expiraEm.getTime() < Date.now()) {
      // Expirou mas o job de limpeza ainda não passou — libera agora mesmo.
      await db
        .update(consultas)
        .set({ status: 'cancelada', expiraEm: null })
        .where(eq(consultas.id, consultaId));
      const mensagem = 'O prazo da reserva expirou antes da confirmação.';
      await marcarErroConfirmacao(consultaId, mensagem);
      return { sucesso: false, erro: `${mensagem} Escolha um novo horário.` };
    }

    const medicoId = reserva.medicoId;
    const observacoes = reserva.observacoes ?? undefined;

    const [medico] = await db
      .select()
      .from(medicos)
      .innerJoin(users, eq(medicos.userId, users.id))
      .where(eq(medicos.id, medicoId))
      .limit(1);

    if (!medico) {
      await marcarErroConfirmacao(consultaId, 'Médico não encontrado');
      return { sucesso: false, erro: 'Médico não encontrado' };
    }

    const [paciente] = await db
      .select()
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(eq(pacientes.id, pacienteId))
      .limit(1);

    if (!paciente) {
      await marcarErroConfirmacao(consultaId, 'Paciente não encontrado');
      return { sucesso: false, erro: 'Paciente não encontrado' };
    }

    const dataConsulta = reserva.dataHora;
    const dataFim = new Date(dataConsulta.getTime() + 60 * 60 * 1000); // +1 hora

    // Tentar criar evento no Google Calendar. Falha aqui NÃO bloqueia a confirmação —
    // o token do médico pode ter expirado ou sido revogado (ex.: "invalid_grant"), e
    // travar todo mundo por causa da agenda quebrada de um médico é pior do que a
    // consulta nascer sem Meet. O motivo fica em consultas.googleCalendarErro.
    let googleEventId: string | null = null;
    let meetLink: string | null = null;
    let googleCalendarErro: string | null = null;

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

      if (resultadoGoogle.sucesso) {
        googleEventId = resultadoGoogle.dados?.eventId || null;
        meetLink = resultadoGoogle.dados?.meetLink || null;
      } else {
        googleCalendarErro = resultadoGoogle.erro || 'Erro desconhecido';
        console.error(
          '[Action] Falha ao criar evento no Google Calendar — agendamento prossegue sem Meet:',
          googleCalendarErro,
        );
      }
    }

    const statusConsulta = googleEventId ? 'confirmada' : 'agendada';

    try {
      await db
        .update(consultas)
        .set({
          status: statusConsulta,
          expiraEm: null,
          googleEventId,
          googleMeetLink: meetLink,
          googleCalendarErro,
        })
        .where(eq(consultas.id, consultaId));
    } catch (dbError) {
      if (googleEventId && medico.medicos.googleRefreshToken) {
        await cancelarEventoGoogleCalendar({
          eventId: googleEventId,
          refreshToken: medico.medicos.googleRefreshToken,
          calendarId: medico.medicos.googleCalendarId || undefined,
        }).catch((cancelError) =>
          console.error('[Action] Falha ao compensar evento órfão do Calendar:', cancelError),
        );
      }
      await marcarErroConfirmacao(consultaId, 'Erro ao confirmar o agendamento.');
      throw dbError;
    }

    await db
      .update(pagamentos)
      .set({ confirmadoEm: new Date(), erroConfirmacao: null })
      .where(eq(pagamentos.consultaId, consultaId));

    await registrarAuditoria({
      userId: userInterno.id,
      acao: 'atualizar',
      entidade: 'consultas',
      entidadeId: consultaId,
      dadosAntes: { status: 'reservada' },
      dadosDepois: { status: statusConsulta },
    });

    revalidatePath('/medico/agenda');
    revalidatePath('/admin/pagamentos');

    // Enviar e-mail de confirmação ao paciente via Brevo
    try {
      await enviarEmailConsultaAgendada({
        pacienteNome: paciente.users.nome,
        pacienteEmail: paciente.users.email,
        medicoNome: medico.users.nome,
        dataHora: dataConsulta,
        meetLink,
      });
      await db
        .update(consultas)
        .set({ emailPacienteEnviadoEm: new Date() })
        .where(eq(consultas.id, consultaId));
    } catch (emailError) {
      console.error('[Action] Erro ao enviar e-mail de confirmação ao paciente:', emailError);
      // Não falha a action — consulta já foi criada. Coluna fica null: falha fica visível.
    }

    // Enviar e-mail de notificação ao médico via Brevo
    try {
      await enviarEmailConsultaMedico({
        medicoNome: medico.users.nome,
        medicoEmail: medico.users.email,
        pacienteNome: paciente.users.nome,
        pacienteEmail: paciente.users.email,
        dataHora: dataConsulta,
        meetLink,
      });
      await db
        .update(consultas)
        .set({ emailMedicoEnviadoEm: new Date() })
        .where(eq(consultas.id, consultaId));
    } catch (emailMedicoError) {
      console.error('[Action] Erro ao enviar e-mail de notificação ao médico:', emailMedicoError);
      // Não falha a action — consulta já foi criada
    }

    return {
      sucesso: true,
      dados: { consultaId, meetLink: meetLink || '' },
    };
  } catch (error) {
    console.error('[Action] Erro ao confirmar agendamento:', error);
    if (typeof dados?.consultaId === 'string' && dados.consultaId) {
      await marcarErroConfirmacao(dados.consultaId, 'Erro interno ao confirmar agendamento');
    }
    return { sucesso: false, erro: 'Erro interno ao confirmar agendamento' };
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
  avatarUrl: string | null;
  valorConsulta: number | null;
  googleConectado: boolean;
}>>> {
  try {
    const resultado = await db
      .select({
        id: medicos.id,
        nome: users.nome,
        especialidade: medicos.especialidade,
        bio: medicos.bio,
        avatarUrl: users.avatarUrl,
        valorConsulta: medicos.valorConsulta,
        googleRefreshToken: medicos.googleRefreshToken,
      })
      .from(medicos)
      .innerJoin(users, eq(medicos.userId, users.id))
      .where(isNull(users.deletedAt))
      .orderBy(asc(medicos.ordem), asc(medicos.createdAt));

    const lista = resultado.map((m) => ({
      id: m.id,
      nome: m.nome,
      especialidade: m.especialidade,
      bio: m.bio,
      avatarUrl: m.avatarUrl,
      valorConsulta: m.valorConsulta !== null ? Number(m.valorConsulta) : null,
      googleConectado: !!m.googleRefreshToken,
    }));

    return { sucesso: true, dados: lista };
  } catch (error) {
    console.error('[Action] Erro ao listar médicos:', error);
    return { sucesso: false, erro: 'Erro ao listar médicos' };
  }
}

/**
 * Lista médicos para exibição pública na página de agendamento.
 * NÃO requer autenticação. Retorna apenas dados de apresentação:
 * nome, especialidade, bio e foto. Sem valor da consulta.
 */
export async function listarMedicosPublico(): Promise<ActionResult<Array<{
  id: string;
  nome: string;
  especialidade: string;
  bio: string | null;
  avatarUrl: string | null;
  crm: string | null;
}>>> {
  try {
    const resultado = await db
      .select({
        id: medicos.id,
        nome: users.nome,
        especialidade: medicos.especialidade,
        bio: medicos.bio,
        avatarUrl: users.avatarUrl,
        crm: medicos.crm,
      })
      .from(medicos)
      .innerJoin(users, eq(medicos.userId, users.id))
      .where(isNull(users.deletedAt))
      .orderBy(asc(medicos.ordem), asc(medicos.createdAt));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar médicos públicos:', error);
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

    const inicioData = new Date(`${data}T00:00:00`);
    const fimData = new Date(`${data}T23:59:59`);
    const diaSemana = inicioData.getDay(); // 0 = Domingo, 1 = Segunda...

    // Buscar configurações do médico
    const [medicoConfig] = await db
      .select({ configAgenda: medicos.configAgenda })
      .from(medicos)
      .where(eq(medicos.id, medicoId))
      .limit(1);

    const configAgenda = medicoConfig?.configAgenda as { diaSemana: number; ativo: boolean; horarios: string[] }[] | null;
    
    // Encontrar configuração para o dia da semana atual
    const configDoDia = configAgenda?.find((c) => c.diaSemana === diaSemana);

    // Se não tem configuração, ou o dia não está ativo, retorna vazio (indisponível)
    if (!configDoDia || !configDoDia.ativo || !configDoDia.horarios || configDoDia.horarios.length === 0) {
      return { sucesso: true, dados: [] };
    }

    const HORARIOS_POSSIVEIS = configDoDia.horarios;

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

    const inicioData = new Date(`${data}T00:00:00`);
    const fimData = new Date(`${data}T23:59:59`);
    const diaSemana = inicioData.getDay();

    // Buscar configurações do médico
    const [medicoConfig] = await db
      .select({ configAgenda: medicos.configAgenda })
      .from(medicos)
      .where(eq(medicos.id, medicoId))
      .limit(1);

    const configAgenda = medicoConfig?.configAgenda as { diaSemana: number; ativo: boolean; horarios: string[] }[] | null;
    const configDoDia = configAgenda?.find((c) => c.diaSemana === diaSemana);
    
    // Usar horários da configuração ou vazio se inativo
    const TODOS_SLOTS = (configDoDia?.ativo && configDoDia?.horarios) ? configDoDia.horarios : [];

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
