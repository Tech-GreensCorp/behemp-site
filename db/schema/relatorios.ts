import { pgTable, text, index } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';
import { pacientes } from './pacientes';
import { medicos } from './medicos';

/**
 * Tabela de relatórios gerados — histórico de PDFs.
 */
export const relatorios = pgTable(
  'relatorios',
  {
    ...baseColumns,
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    titulo: text('titulo').notNull(),
    urlPdf: text('url_pdf'),
    criadoPor: text('criado_por')
      .notNull()
      .references(() => medicos.id),
  },
  (table) => [index('relatorios_paciente_idx').on(table.pacienteId)],
);
