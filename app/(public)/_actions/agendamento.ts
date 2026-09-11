'use server';

import { db } from '@/lib/db';
import { consultas, medicos, pacientes, pagamentos, users } from '@/db/schema';
import { eq, and, gte, lte, isNull, asc, desc } from 'drizzle-orm';
import { z } from 'zod';
import { verificarPaciente } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/utils/audit';
import { revalidatePath } from 'next/cache';
import {
  criarConsultaGoogleCalendar,
  cancelarEventoGoogleCalendar,
  atualizarEventoGoogleCalendar,
} from '@/lib/integrations/google-calendar';
import {
  enviarEmailConsultaAgendada,
  enviarEmailConsultaMedico,
  enviarEmailReservaAguardandoPagamento,
  enviarEmailConsultaCancelada,
  enviarEmailConsultaRemarcada,
  enviarEmailConsultaRemarcadaPeloPacienteMedico,
} from '@/lib/email/consultas';
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

/** Placeholder ajustável — quanto tempo o paciente tem para pagar após reservar. */
const RESERVA_TTL_MINUTOS = 30;

// ── Schemas de validação ──────────────────────────────────────

const reservarConsultaSchema = z.object({
  medicoId: z.string().min(1, 'ID do médico é obrigatório'),
  dataHora: z.string().datetime('Data/hora inválida'),
  observacoes: z.string().optional(),
});

const confirmarAgendamentoSchema = z.object({
  consultaId: z.string().min(1, 'ID da consulta é obrigatório'),
});

const iniciarAguardoPagamentoSchema = z.object({
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

    if (medico.valorConsulta === null || medico.valorConsulta === undefined) {
      return {
        sucesso: false,
        erro:
          'Este médico ainda não tem o valor da consulta configurado. Peça para o administrador configurar em Médicos.',
      };
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

    const moeda = 'BRL';
    const valor = Number(medico.valorConsulta);

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
 * Sai da etapa de confirmação para a etapa de pagamento (layout, sem gateway real).
 *
 * Ao contrário de `confirmarAgendamento`, esta action NÃO muda `consultas.status`
 * (a reserva já nasceu 'reservada' em `reservarConsulta` e continua assim), NÃO toca
 * Google Calendar e NÃO envia o e-mail de "consulta confirmada" — isso ficaria
 * enganoso antes do pagamento existir de verdade. Só valida que a reserva ainda é
 * do paciente e está dentro do prazo, e dispara o aviso de "aguardando pagamento".
 *
 * `confirmarAgendamento` continua intocada no código para ser chamada futuramente
 * quando existir confirmação real de pagamento (ex.: webhook de gateway).
 */
export async function iniciarAguardoPagamento(
  dados: z.infer<typeof iniciarAguardoPagamentoSchema>,
): Promise<ActionResult<{ consultaId: string }>> {
  try {
    const parsed = iniciarAguardoPagamentoSchema.safeParse(dados);
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
      await db
        .update(consultas)
        .set({ status: 'cancelada', expiraEm: null })
        .where(eq(consultas.id, consultaId));
      const mensagem = 'O prazo da reserva expirou.';
      await marcarErroConfirmacao(consultaId, mensagem);
      return { sucesso: false, erro: `${mensagem} Escolha um novo horário.` };
    }

    const [medico] = await db
      .select()
      .from(medicos)
      .innerJoin(users, eq(medicos.userId, users.id))
      .where(eq(medicos.id, reserva.medicoId))
      .limit(1);

    const [paciente] = await db
      .select()
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(eq(pacientes.id, pacienteId))
      .limit(1);

    if (!medico || !paciente) {
      return { sucesso: false, erro: 'Erro ao carregar dados da reserva' };
    }

    const [pagamento] = await db
      .select({ valor: pagamentos.valor, moeda: pagamentos.moeda })
      .from(pagamentos)
      .where(eq(pagamentos.consultaId, consultaId))
      .limit(1);

    // Best-effort — a reserva já existe independente do envio do e-mail.
    try {
      await enviarEmailReservaAguardandoPagamento({
        pacienteNome: paciente.users.nome,
        pacienteEmail: paciente.users.email,
        medicoNome: medico.users.nome,
        dataHora: reserva.dataHora,
        valor: pagamento ? Number(pagamento.valor) : null,
        moeda: pagamento?.moeda ?? 'BRL',
        expiraEm: reserva.expiraEm ?? new Date(),
      });
      await db
        .update(consultas)
        .set({ emailReservaEnviadoEm: new Date() })
        .where(eq(consultas.id, consultaId));
    } catch (emailError) {
      console.error('[Action] Erro ao enviar e-mail de reserva aguardando pagamento:', emailError);
    }

    return { sucesso: true, dados: { consultaId } };
  } catch (error) {
    console.error('[Action] Erro ao iniciar aguardo de pagamento:', error);
    return { sucesso: false, erro: 'Erro interno ao processar a reserva' };
  }
}

/** Resolve o pacienteId do usuário autenticado — usado só pelas funções de estado abaixo. */
async function resolverPacienteIdAutenticado(): Promise<
  { sucesso: true; pacienteId: string } | { sucesso: false; erro: string }
> {
  const auth = await verificarPaciente();
  if (!auth.autorizado || !auth.clerkId) {
    return { sucesso: false, erro: 'Autenticação necessária' };
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

  return { sucesso: true, pacienteId: pacienteAuto.id };
}

/**
 * Libera (marca 'cancelada') qualquer reserva do paciente cujo prazo já passou — mesma
 * lógica de `liberarReservasExpiradas` (Inngest, roda a cada 5 min), mas disparada na hora
 * em que o paciente abre a tela de agendamento, para o status já vir correto sem esperar
 * o próximo ciclo do cron.
 */
async function expirarReservasVencidasDoPaciente(pacienteId: string): Promise<void> {
  const expiradas = await db
    .select({ id: consultas.id })
    .from(consultas)
    .where(
      and(
        eq(consultas.pacienteId, pacienteId),
        eq(consultas.status, 'reservada'),
        lte(consultas.expiraEm, new Date()),
      ),
    );

  if (expiradas.length === 0) return;

  await db
    .update(consultas)
    .set({ status: 'cancelada', expiraEm: null })
    .where(
      and(
        eq(consultas.pacienteId, pacienteId),
        eq(consultas.status, 'reservada'),
        lte(consultas.expiraEm, new Date()),
      ),
    );

  await Promise.all(
    expiradas.map((e) => marcarErroConfirmacao(e.id, 'O prazo da reserva expirou.')),
  );
}

export interface ReservaAtivaAgendamento {
  consultaId: string;
  medicoId: string;
  medicoNome: string;
  medicoEspecialidade: string;
  medicoAvatarUrl: string | null;
  dataHora: string;
  observacoes: string | null;
  expiraEm: string;
  valor: number | null;
  moeda: string;
  /** true = já passou pela confirmação e está na etapa de pagamento; false = ainda está
   *  na etapa de confirmação da reserva. */
  aguardandoPagamento: boolean;
}

export interface HistoricoAgendamentoItem {
  id: string;
  medicoId: string;
  medicoNome: string;
  medicoEspecialidade: string;
  medicoAvatarUrl: string | null;
  dataHora: string;
  status: 'reservada' | 'agendada' | 'confirmada' | 'realizada' | 'cancelada';
  valor: number | null;
  moeda: string;
  expiraEm: string | null;
  observacoes: string | null;
  /** null = ainda pode remarcar de graça uma vez; preenchido = já usou a remarcação gratuita. */
  remarcadaPeloPacienteEm: string | null;
}

/**
 * Estado do agendamento do paciente para retomar a tela exatamente de onde parou:
 * reserva ativa (se houver, dentro do prazo) + histórico recente. Chamada pela Server
 * Component de `/paciente/agendamento` a cada carregamento — a etapa do wizard é sempre
 * derivada daqui, nunca só do estado local do componente.
 */
export async function obterEstadoAgendamentoPaciente(): Promise<
  ActionResult<{ reservaAtiva: ReservaAtivaAgendamento | null; historico: HistoricoAgendamentoItem[] }>
> {
  try {
    const resolvido = await resolverPacienteIdAutenticado();
    if (!resolvido.sucesso) return { sucesso: false, erro: resolvido.erro };
    const { pacienteId } = resolvido;

    // Corrige o status de qualquer reserva vencida ANTES de ler — sem isso, uma reserva
    // expirada há 2 minutos ainda apareceria como "reservada" até o próximo ciclo do cron.
    await expirarReservasVencidasDoPaciente(pacienteId);

    const [reservaRow] = await db
      .select({
        id: consultas.id,
        medicoId: consultas.medicoId,
        medicoNome: users.nome,
        medicoEspecialidade: medicos.especialidade,
        medicoAvatarUrl: users.avatarUrl,
        dataHora: consultas.dataHora,
        observacoes: consultas.observacoes,
        expiraEm: consultas.expiraEm,
        emailReservaEnviadoEm: consultas.emailReservaEnviadoEm,
      })
      .from(consultas)
      .innerJoin(medicos, eq(consultas.medicoId, medicos.id))
      .innerJoin(users, eq(medicos.userId, users.id))
      .where(
        and(
          eq(consultas.pacienteId, pacienteId),
          eq(consultas.status, 'reservada'),
          isNull(consultas.deletedAt),
        ),
      )
      .orderBy(desc(consultas.createdAt))
      .limit(1);

    let reservaAtiva: ReservaAtivaAgendamento | null = null;
    if (reservaRow && reservaRow.expiraEm) {
      const [pagamentoRow] = await db
        .select({ valor: pagamentos.valor, moeda: pagamentos.moeda })
        .from(pagamentos)
        .where(eq(pagamentos.consultaId, reservaRow.id))
        .limit(1);

      reservaAtiva = {
        consultaId: reservaRow.id,
        medicoId: reservaRow.medicoId,
        medicoNome: reservaRow.medicoNome,
        medicoEspecialidade: reservaRow.medicoEspecialidade,
        medicoAvatarUrl: reservaRow.medicoAvatarUrl,
        dataHora: reservaRow.dataHora.toISOString(),
        observacoes: reservaRow.observacoes,
        expiraEm: reservaRow.expiraEm.toISOString(),
        valor: pagamentoRow ? Number(pagamentoRow.valor) : null,
        moeda: pagamentoRow?.moeda ?? 'BRL',
        aguardandoPagamento: reservaRow.emailReservaEnviadoEm !== null,
      };
    }

    const historicoRows = await db
      .select({
        id: consultas.id,
        medicoId: consultas.medicoId,
        medicoNome: users.nome,
        medicoEspecialidade: medicos.especialidade,
        medicoAvatarUrl: users.avatarUrl,
        dataHora: consultas.dataHora,
        status: consultas.status,
        expiraEm: consultas.expiraEm,
        observacoes: consultas.observacoes,
        remarcadaPeloPacienteEm: consultas.remarcadaPeloPacienteEm,
        valor: pagamentos.valor,
        moeda: pagamentos.moeda,
      })
      .from(consultas)
      .innerJoin(medicos, eq(consultas.medicoId, medicos.id))
      .innerJoin(users, eq(medicos.userId, users.id))
      .leftJoin(pagamentos, eq(pagamentos.consultaId, consultas.id))
      .where(and(eq(consultas.pacienteId, pacienteId), isNull(consultas.deletedAt)))
      .orderBy(desc(consultas.dataHora))
      .limit(8);

    const historico: HistoricoAgendamentoItem[] = historicoRows.map((r) => ({
      id: r.id,
      medicoId: r.medicoId,
      medicoNome: r.medicoNome,
      medicoEspecialidade: r.medicoEspecialidade,
      medicoAvatarUrl: r.medicoAvatarUrl,
      dataHora: r.dataHora.toISOString(),
      status: r.status,
      valor: r.valor !== null ? Number(r.valor) : null,
      moeda: r.moeda ?? 'BRL',
      expiraEm: r.expiraEm ? r.expiraEm.toISOString() : null,
      observacoes: r.observacoes,
      remarcadaPeloPacienteEm: r.remarcadaPeloPacienteEm ? r.remarcadaPeloPacienteEm.toISOString() : null,
    }));

    return { sucesso: true, dados: { reservaAtiva, historico } };
  } catch (error) {
    console.error('[Action] Erro ao obter estado do agendamento:', error);
    return { sucesso: false, erro: 'Erro ao carregar estado do agendamento' };
  }
}

const cancelarReservaPendenteSchema = z.object({
  consultaId: z.string().min(1, 'ID da consulta é obrigatório'),
});

/**
 * Cancela uma reserva PENDENTE (status 'reservada', ainda sem pagamento) a pedido do
 * próprio paciente. Só existe para esse status: uma consulta 'agendada'/'confirmada' já
 * tem pagamento associado, e cancelar isso passa por suporte, não por autoatendimento
 * (ver `remarcarConsultaPaciente` abaixo para a alternativa de trocar a data).
 */
export async function cancelarReservaPendente(
  dados: z.infer<typeof cancelarReservaPendenteSchema>,
): Promise<ActionResult> {
  try {
    const parsed = cancelarReservaPendenteSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const resolvido = await resolverPacienteIdAutenticado();
    if (!resolvido.sucesso) return { sucesso: false, erro: resolvido.erro };
    const { pacienteId } = resolvido;

    const { consultaId } = parsed.data;

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
        erro:
          'Só é possível cancelar por aqui uma reserva ainda não paga. Para consultas já ' +
          'confirmadas, entre em contato com o suporte.',
      };
    }

    await db
      .update(consultas)
      .set({ status: 'cancelada', expiraEm: null })
      .where(eq(consultas.id, consultaId));

    // Sincroniza o pagamento vinculado — nasceu 'pendente' e nunca foi pago de verdade,
    // então "cancelado" é o estado correto agora (recomendação: status do pagamento não
    // pode ficar dessincronizado do status da consulta).
    await db
      .update(pagamentos)
      .set({ status: 'cancelado' })
      .where(eq(pagamentos.consultaId, consultaId));

    const [medico] = await db
      .select()
      .from(medicos)
      .innerJoin(users, eq(medicos.userId, users.id))
      .where(eq(medicos.id, reserva.medicoId))
      .limit(1);

    const [paciente] = await db
      .select()
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(eq(pacientes.id, pacienteId))
      .limit(1);

    await registrarAuditoria({
      userId: paciente?.users.id ?? pacienteId,
      acao: 'atualizar',
      entidade: 'consultas',
      entidadeId: consultaId,
      dadosAntes: { status: 'reservada' },
      dadosDepois: { status: 'cancelada', por: 'paciente' },
    });

    // O médico nunca foi avisado desta reserva (só é avisado quando o pagamento é
    // confirmado de verdade) — não faz sentido notificá-lo de um cancelamento de algo
    // que ele não sabia que existia.
    if (paciente && medico) {
      try {
        await enviarEmailConsultaCancelada({
          pacienteNome: paciente.users.nome,
          pacienteEmail: paciente.users.email,
          medicoNome: medico.users.nome,
          dataHora: reserva.dataHora,
          motivo: 'Você cancelou esta reserva.',
        });
      } catch (emailError) {
        console.error('[Action] Erro ao enviar e-mail de cancelamento pelo paciente:', emailError);
      }
    }

    revalidatePath('/paciente/agendamento');

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao cancelar reserva:', error);
    return { sucesso: false, erro: 'Erro interno ao cancelar a reserva' };
  }
}

const remarcarConsultaPacienteSchema = z.object({
  consultaId: z.string().min(1, 'ID da consulta é obrigatório'),
  novaDataHora: z.string().datetime('Data/hora inválida'),
});

/**
 * Remarca (troca a data/hora de) uma consulta a pedido do próprio paciente — permitido
 * para qualquer status ainda ativo ('reservada', 'agendada', 'confirmada'). Limitado a
 * UMA vez sem custo por consulta: `consultas.remarcadaPeloPacienteEm` é o próprio limite
 * — se já estiver preenchido, uma nova remarcação exige contato com o suporte.
 */
export async function remarcarConsultaPaciente(
  dados: z.infer<typeof remarcarConsultaPacienteSchema>,
): Promise<ActionResult> {
  try {
    const parsed = remarcarConsultaPacienteSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const resolvido = await resolverPacienteIdAutenticado();
    if (!resolvido.sucesso) return { sucesso: false, erro: resolvido.erro };
    const { pacienteId } = resolvido;

    const { consultaId, novaDataHora } = parsed.data;

    const [consulta] = await db
      .select()
      .from(consultas)
      .where(and(eq(consultas.id, consultaId), eq(consultas.pacienteId, pacienteId)))
      .limit(1);

    if (!consulta) {
      return { sucesso: false, erro: 'Consulta não encontrada.' };
    }

    if (!['reservada', 'agendada', 'confirmada'].includes(consulta.status)) {
      return {
        sucesso: false,
        erro: 'Esta consulta não pode mais ser remarcada.',
      };
    }

    if (consulta.remarcadaPeloPacienteEm !== null) {
      return {
        sucesso: false,
        erro:
          'Você já remarcou esta consulta uma vez. Para remarcar de novo, entre em ' +
          'contato com o suporte.',
      };
    }

    const dataAnterior = consulta.dataHora;
    const novaData = new Date(novaDataHora);

    if (novaData.getTime() <= Date.now()) {
      return { sucesso: false, erro: 'Escolha uma data no futuro.' };
    }

    const [medico] = await db
      .select()
      .from(medicos)
      .innerJoin(users, eq(medicos.userId, users.id))
      .where(eq(medicos.id, consulta.medicoId))
      .limit(1);

    const [paciente] = await db
      .select()
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(eq(pacientes.id, pacienteId))
      .limit(1);

    if (!medico || !paciente) {
      return { sucesso: false, erro: 'Erro ao carregar dados da consulta' };
    }

    // Se havia evento no Calendar (consulta já confirmada de verdade), atualiza a data
    // nele também — best-effort, igual ao padrão do resto do arquivo: falha aqui não
    // pode travar a remarcação.
    let novoMeetLink: string | null = consulta.googleMeetLink;
    if (consulta.googleEventId && medico.medicos.googleRefreshToken) {
      const novaDataFim = new Date(novaData.getTime() + 60 * 60 * 1000);
      const resultadoGoogle = await atualizarEventoGoogleCalendar({
        eventId: consulta.googleEventId,
        refreshToken: medico.medicos.googleRefreshToken,
        novaDataInicio: novaData,
        novaDataFim,
      });
      if (resultadoGoogle.sucesso && resultadoGoogle.dados) {
        novoMeetLink = resultadoGoogle.dados.meetLink;
      } else {
        console.error(
          '[Action] Falha ao atualizar evento no Calendar ao remarcar (paciente):',
          resultadoGoogle.erro,
        );
      }
    }

    // Mesmo índice único que protege `reservarConsulta` — outro médico/horário pode ter
    // sido ocupado nesse meio tempo.
    try {
      await db
        .update(consultas)
        .set({
          dataHora: novaData,
          googleMeetLink: novoMeetLink,
          remarcadaPeloPacienteEm: new Date(),
          // Uma reserva pendente continua pendente, só com prazo renovado — ela não virou
          // paga só porque a data mudou.
          expiraEm: consulta.status === 'reservada' ? new Date(Date.now() + RESERVA_TTL_MINUTOS * 60 * 1000) : null,
        })
        .where(eq(consultas.id, consultaId));
    } catch (dbError) {
      const codigo = (dbError as { code?: string }).code;
      if (codigo === '23505') {
        return {
          sucesso: false,
          erro: 'Este médico já tem outra consulta nesse horário. Escolha outro horário.',
        };
      }
      throw dbError;
    }

    await db
      .update(pagamentos)
      .set({ dataHora: novaData })
      .where(eq(pagamentos.consultaId, consultaId));

    await registrarAuditoria({
      userId: paciente.users.id,
      acao: 'atualizar',
      entidade: 'consultas',
      entidadeId: consultaId,
      dadosAntes: { dataHora: dataAnterior.toISOString() },
      dadosDepois: { dataHora: novaData.toISOString(), remarcadaPor: 'paciente' },
    });

    try {
      await enviarEmailConsultaRemarcada({
        pacienteNome: paciente.users.nome,
        pacienteEmail: paciente.users.email,
        medicoNome: medico.users.nome,
        dataHoraAnterior: dataAnterior,
        dataHoraNova: novaData,
      });
    } catch (emailError) {
      console.error('[Action] Erro ao enviar e-mail de remarcação ao paciente:', emailError);
    }

    // O médico só é avisado se já sabia da consulta (status já era 'agendada'/'confirmada'
    // antes desta remarcação) — uma 'reservada' nunca chegou a ser comunicada a ele.
    if (consulta.status !== 'reservada') {
      try {
        await enviarEmailConsultaRemarcadaPeloPacienteMedico({
          medicoNome: medico.users.nome,
          medicoEmail: medico.users.email,
          pacienteNome: paciente.users.nome,
          dataHoraAntiga: dataAnterior,
          dataHoraNova: novaData,
        });
      } catch (emailError) {
        console.error('[Action] Erro ao enviar e-mail de remarcação ao médico:', emailError);
      }
    }

    revalidatePath('/paciente/agendamento');
    revalidatePath('/medico/agenda');

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao remarcar consulta (paciente):', error);
    return { sucesso: false, erro: 'Erro interno ao remarcar a consulta' };
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
  crm: string | null;
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
        crm: medicos.crm,
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
      crm: m.crm,
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
