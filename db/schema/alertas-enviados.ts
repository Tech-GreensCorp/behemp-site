import { pgTable, text, timestamp, integer, unique } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';
import { alertaTipoEnum, alertaDestinatarioEnum } from './enums';

/**
 * Registro de alertas enviados para garantir idempotência.
 * Um mesmo tipo de alerta para a mesma referência (dosagem/autorizacao/invoice)
 * no mesmo marco de dias e para o mesmo destinatário NUNCA deve ser enviado duas vezes.
 */
export const alertasEnviados = pgTable('alertas_enviados', {
  ...baseColumns,
  tipo: alertaTipoEnum('tipo').notNull(),
  referenciaId: text('referencia_id').notNull(), // Pode ser dosagemId, autorizacaoId ou invoiceId
  marcoDias: integer('marco_dias').notNull(), // Ex: 40, 30, 10
  destinatario: alertaDestinatarioEnum('destinatario').notNull(), // 'admin' ou 'paciente'
  enviadoEm: timestamp('enviado_em', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  unqAlerta: unique('unq_alerta_enviado').on(t.tipo, t.referenciaId, t.marcoDias, t.destinatario),
}));
