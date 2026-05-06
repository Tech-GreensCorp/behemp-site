import { pgTable, text, date, integer, index } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { pacientes } from './pacientes';
import { medicos } from './medicos';

/**
 * Tabela de evoluções clínicas — registro contínuo da evolução do paciente.
 * Inclui indicadores numéricos (0-10) para gráficos de acompanhamento:
 * - Nível de dor
 * - Qualidade de sono
 * - Bem-estar geral
 */
export const evolucoes = pgTable(
  'evolucoes',
  {
    ...baseColumns,
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    data: date('data').notNull(),
    conteudo: text('conteudo').notNull(),
    nivelDor: integer('nivel_dor'), // 0-10
    qualidadeSono: integer('qualidade_sono'), // 0-10
    bemEstar: integer('bem_estar'), // 0-10
    criadoPor: text('criado_por')
      .notNull()
      .references(() => medicos.id),
    ...softDeleteColumn,
  },
  (table) => [
    index('evolucoes_paciente_idx').on(table.pacienteId),
    index('evolucoes_data_idx').on(table.data),
  ],
);
