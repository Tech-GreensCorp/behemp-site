import { pgTable, text, index } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { pacientes } from './pacientes';
import { medicos } from './medicos';

/**
 * Tabela de anamneses — registro clínico do paciente.
 * O conteúdo é armazenado como texto rico (HTML do editor Tiptap).
 * Soft delete habilitado para preservar histórico clínico.
 */
export const anamneses = pgTable(
  'anamneses',
  {
    ...baseColumns,
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    conteudo: text('conteudo').notNull(), // Rich text (HTML)
    criadoPor: text('criado_por')
      .notNull()
      .references(() => medicos.id),
    ...softDeleteColumn,
  },
  (table) => [index('anamneses_paciente_idx').on(table.pacienteId)],
);
