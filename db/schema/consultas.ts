import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { pacientes } from './pacientes';
import { medicos } from './medicos';
import { consultaStatusEnum } from './enums';

/**
 * Tabela de consultas — vínculo paciente-médico com evento Google Calendar.
 *
 * Ciclo de vida: nasce como 'reservada' (horário travado, com `expiraEm`) quando o
 * paciente sai da etapa de data/hora. Vira 'agendada'/'confirmada' quando ele confirma
 * dentro do prazo. Se o prazo expira sem confirmação, um job (`liberarReservasExpiradas`
 * em lib/integrations/inngest/functions.ts) marca 'cancelada' e libera o horário — o
 * índice único abaixo já trata 'reservada' como ativa, então o horário fica indisponível
 * para outros pacientes durante a reserva.
 */
export const consultas = pgTable(
  'consultas',
  {
    ...baseColumns,
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    medicoId: text('medico_id')
      .notNull()
      .references(() => medicos.id),
    dataHora: timestamp('data_hora', { withTimezone: true }).notNull(),
    status: consultaStatusEnum('status').notNull().default('reservada'),
    /** Só preenchido enquanto status = 'reservada'. Limpo ao confirmar. */
    expiraEm: timestamp('expira_em', { withTimezone: true }),
    googleEventId: text('google_event_id'),
    googleMeetLink: text('google_meet_link'),
    observacoes: text('observacoes'),
    /** Preenchido só quando o e-mail de confirmação foi enviado com sucesso — ausência
     *  (null) é o sinal de falha de envio, sem precisar de coluna de erro à parte. */
    emailPacienteEnviadoEm: timestamp('email_paciente_enviado_em', { withTimezone: true }),
    emailMedicoEnviadoEm: timestamp('email_medico_enviado_em', { withTimezone: true }),
    /** E-mail avisando que o horário foi reservado e aguarda pagamento (etapa 3→4 do
     *  wizard) — mesmo padrão de "ausência é o sinal de falha" dos dois campos acima. */
    emailReservaEnviadoEm: timestamp('email_reserva_enviado_em', { withTimezone: true }),
    /** Falha ao criar o evento no Calendar (ex.: token do médico expirado/revogado,
     *  "invalid_grant") não bloqueia mais o agendamento — a consulta nasce sem Meet
     *  e o motivo fica aqui, visível para o médico/admin reconectarem o Google. */
    googleCalendarErro: text('google_calendar_erro'),
    /** O PACIENTE (não o médico, que remarca livremente) só pode remarcar uma vez sem
     *  custo — presença desta data é o próprio limite: outra remarcação pelo paciente
     *  passa a exigir contato com o suporte. */
    remarcadaPeloPacienteEm: timestamp('remarcada_pelo_paciente_em', { withTimezone: true }),
    ...softDeleteColumn,
  },
  (table) => [
    index('consultas_paciente_idx').on(table.pacienteId),
    index('consultas_medico_idx').on(table.medicoId),
    index('consultas_data_idx').on(table.dataHora),
    index('consultas_status_idx').on(table.status),
    index('consultas_expira_idx').on(table.expiraEm),
    // Impede dois agendamentos pendentes/futuros para o mesmo médico no mesmo horário.
    // Só cobre status que ainda disputam o horário (reservada/agendada/confirmada) —
    // 'realizada' é histórico e 'cancelada' já liberou o slot, nenhum dos dois precisa
    // da trava. Existem duplicatas históricas em 'realizada' no banco; a trava não
    // pode alcançá-las.
    uniqueIndex('consultas_medico_datahora_ativa_idx')
      .on(table.medicoId, table.dataHora)
      .where(sql`${table.status} in ('reservada', 'agendada', 'confirmada') and ${table.deletedAt} is null`),
  ],
);
