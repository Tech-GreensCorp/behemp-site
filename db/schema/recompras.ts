import { pgTable, text, date, timestamp, index } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';
import { dosagens } from './dosagens';
import { recompraStatusEnum } from './enums';

/**
 * Tabela de recompras — controle de pedidos de recompra de medicamento.
 * Vinculada à dosagem ativa do paciente.
 * Status: agendada → pedida → entregue
 */
export const recompras = pgTable(
  'recompras',
  {
    ...baseColumns,
    dosagemId: text('dosagem_id')
      .notNull()
      .references(() => dosagens.id),
    dataPrevista: date('data_prevista').notNull(),
    status: recompraStatusEnum('status').notNull().default('agendada'),
    emailEnviadoEm: timestamp('email_enviado_em', { withTimezone: true }),
  },
  (table) => [
    index('recompras_dosagem_idx').on(table.dosagemId),
    index('recompras_data_idx').on(table.dataPrevista),
    index('recompras_status_idx').on(table.status),
  ],
);
