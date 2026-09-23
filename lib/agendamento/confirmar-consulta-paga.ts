import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { consultas, medicos, pacientes, pagamentos, users } from '@/db/schema';
import { db } from '@/lib/db';
import {
  cancelarEventoGoogleCalendar,
  criarConsultaGoogleCalendar,
} from '@/lib/integrations/google-calendar';
import { enviarEmailConsultaAgendada, enviarEmailConsultaMedico } from '@/lib/email/consultas';
import { registrarAuditoria } from '@/lib/utils/audit';

/**
 * CONFIRMAR UMA CONSULTA PAGA — sem sessão, chamável pelo webhook do Mercado Pago.
 *
 * Extraída de `confirmarAgendamento` (app/(public)/_actions/agendamento.ts) na Parte 2 do
 * split de pagamento. O corpo é o MESMO, recortado do original: valida estado e prazo da
 * reserva, tenta o Google Calendar (falha não bloqueia), grava o status final, audita, e envia
 * os e-mails. Duas diferenças, as duas deliberadas:
 *
 *   1. não lê sessão — a consulta vem pelo id, e quem chama responde pela autorização
 *      (a action autenticada confere que o paciente é dono; o webhook confere a assinatura
 *      do Mercado Pago e o status do pagamento na API)
 *   2. marca o pagamento como PAGO (`status: 'pago'`, `pagoEm`) — antes só `confirmadoEm`
 *
 * 🔴 ESTE ARQUIVO NÃO PODE TER `'use server'`, E NÃO PODE SER RE-EXPORTADO DE UM QUE TENHA.
 * Toda função exportada de um arquivo `'use server'` vira endpoint público de Server Action,
 * chamável por POST por qualquer um. Esta função não confere quem chama: exposta assim, ela
 * confirmaria qualquer consulta sem pagamento. O guarda
 * `a-confirmacao-paga-nao-e-action-publica` mantém isso.
 */

export interface ResultadoConfirmacao<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

export interface OpcoesConfirmacao {
  /** `users.id` de quem disparou — o paciente, no fluxo autenticado. `null` no webhook. */
  atorUserId?: string | null;
}

/**
 * Registra o motivo pelo qual a confirmação falhou no pagamento vinculado à consulta —
 * best-effort, nunca deixa a falha de escrita mascarar o erro original.
 */
export async function marcarErroConfirmacao(consultaId: string, mensagem: string): Promise<void> {
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
 * Confirma uma reserva dentro do prazo.
 * 1. Valida estado e prazo da reserva
 * 2. Tenta criar evento no Google Calendar com Meet — falha não bloqueia
 * 3. Atualiza a consulta para 'confirmada'/'agendada', limpa o prazo, e marca o pagamento pago
 * 4. Envia e-mail de confirmação
 */
export async function confirmarConsultaPaga(
  consultaId: string,
  opcoes: OpcoesConfirmacao = {},
): Promise<ResultadoConfirmacao<{ consultaId: string; meetLink: string }>> {
  try {
    const [reserva] = await db
      .select()
      .from(consultas)
      .where(eq(consultas.id, consultaId))
      .limit(1);

    if (!reserva) {
      return { sucesso: false, erro: 'Reserva não encontrada.' };
    }

    const pacienteId = reserva.pacienteId;

    if (reserva.status !== 'reservada') {
      return {
        sucesso: false,
        erro:
          reserva.status === 'cancelada'
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

    // O mesmo instante em `pagoEm` e `confirmadoEm`, tomado AQUI — depois do Calendar — como
    // o `new Date()` do original, para `confirmadoEm` não ficar adiantado.
    const agora = new Date();
    await db
      .update(pagamentos)
      // Parte 2 (23/09/2026): confirmar é o efeito do pagamento aprovado, então a linha passa
      // a dizer que foi PAGA. Antes só `confirmadoEm` era escrito e o status ficava 'pendente'.
      .set({ status: 'pago', pagoEm: agora, confirmadoEm: agora, erroConfirmacao: null })
      .where(eq(pagamentos.consultaId, consultaId));

    await registrarAuditoria({
      userId: opcoes.atorUserId ?? null,
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
    await marcarErroConfirmacao(consultaId, 'Erro interno ao confirmar agendamento');
    return { sucesso: false, erro: 'Erro interno ao confirmar agendamento' };
  }
}
