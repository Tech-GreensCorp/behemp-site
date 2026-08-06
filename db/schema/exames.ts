import { pgTable, text, date, index } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { pacientes } from './pacientes';

/**
 * Tabela de exames — arquivos de exames do paciente.
 */
export const exames = pgTable(
  'exames',
  {
    ...baseColumns,
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    nomeExame: text('nome_exame').notNull(),
    dataExame: date('data_exame').notNull(),
    observacoes: text('observacoes'),
    urlArquivo: text('url_arquivo'),
    nomeArquivo: text('nome_arquivo'),
    ...softDeleteColumn,
  },
  (table) => [index('exames_paciente_idx').on(table.pacienteId)],
);
