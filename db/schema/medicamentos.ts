import { pgTable, text, integer } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';

/**
 * Tabela de medicamentos — cadastro dos medicamentos disponíveis.
 * O campo gotasPorMl pode variar por concentração (padrão: 20 gotas/ml).
 */
export const medicamentos = pgTable('medicamentos', {
  ...baseColumns,
  nome: text('nome').notNull(),
  principioAtivo: text('principio_ativo'),
  gotasPorMl: integer('gotas_por_ml').notNull().default(20),
});
