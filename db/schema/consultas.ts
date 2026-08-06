import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { pacientes } from './pacientes';
import { medicos } from './medicos';
import { consultaStatusEnum } from './enums';

/**
 * Tabela de consultas — vínculo paciente-médico com evento Google Calendar.
 * A consulta só é confirmada após criação bem-sucedida do evento no Calendar.
 * O link Meet é gerado automaticamente pelo Google Calendar.
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
    status: consultaStatusEnum('status').notNull().default('agendada'),
    googleEventId: text('google_event_id'),
    googleMeetLink: text('google_meet_link'),
    observacoes: text('observacoes'),
    ...softDeleteColumn,
  },
  (table) => [
    index('consultas_paciente_idx').on(table.pacienteId),
    index('consultas_medico_idx').on(table.medicoId),
    index('consultas_data_idx').on(table.dataHora),
    index('consultas_status_idx').on(table.status),
  ],
);
