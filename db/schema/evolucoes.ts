import { pgTable, text, date, integer, index } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { pacientes } from './pacientes';
import { medicos } from './medicos';
import { evolucaoTipoEnum, qualidadeSonoEnum } from './enums';

/**
 * Tabela de evoluções clínicas — registro contínuo da evolução do paciente.
 * Inclui tipo de evolução, sintomas, efeitos colaterais e indicadores numéricos.
 */
export const evolucoes = pgTable(
  'evolucoes',
  {
    ...baseColumns,
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    data: date('data').notNull(),
    tipo: evolucaoTipoEnum('tipo').notNull(),
    sintomasAtuais: text('sintomas_atuais'),
    efeitosColaterais: text('efeitos_colaterais'),
    conteudo: text('conteudo').notNull(), // observações
    nivelDor: integer('nivel_dor'), // 0-10
    qualidadeSono: qualidadeSonoEnum('qualidade_sono'),
    bemEstar: text('bem_estar'), // ruim, regular, boa, excelente
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
