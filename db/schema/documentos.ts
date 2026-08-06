import { pgTable, text, date, index } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { pacientes } from './pacientes';
import { documentoTipoEnum } from './enums';

/**
 * Tabela de documentos do paciente.
 * Cada documento tem tipo, URL no Blob, data de emissão e validade calculada.
 * - Autorização Anvisa: validade de 24 meses
 * - Receita médica: validade de 6 meses
 */
export const documentos = pgTable(
  'documentos',
  {
    ...baseColumns,
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    tipo: documentoTipoEnum('tipo').notNull(),
    urlBlob: text('url_blob').notNull(),
    nomeArquivo: text('nome_arquivo'),
    dataEmissao: date('data_emissao').notNull(),
    dataValidade: date('data_validade').notNull(),
    observacoes: text('observacoes'),
    ...softDeleteColumn,
  },
  (table) => [
    index('documentos_paciente_idx').on(table.pacienteId),
    index('documentos_validade_idx').on(table.dataValidade),
  ],
);
