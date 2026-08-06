import { pgTable, text, integer, boolean, index } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { pacientes } from './pacientes';
import { medicos } from './medicos';
import { tabagismoEnum, consumoAlcoolEnum, qualidadeSonoEnum } from './enums';

/**
 * Tabela de anamneses — registro clínico estruturado do paciente.
 * Contém queixa principal, histórico, hábitos e indicadores.
 */
export const anamneses = pgTable(
  'anamneses',
  {
    ...baseColumns,
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    conteudo: text('conteudo'), // legado — rich text
    queixaPrincipal: text('queixa_principal').notNull(),
    historiaDoencaAtual: text('historia_doenca_atual').notNull(),
    doencasPrevias: text('doencas_previas'),
    medicamentosEmUso: text('medicamentos_em_uso'),
    alergias: text('alergias'),
    historicoFamiliar: text('historico_familiar'),
    historiaSocial: text('historia_social'),
    tabagismo: tabagismoEnum('tabagismo').notNull(),
    consumoAlcool: consumoAlcoolEnum('consumo_alcool').notNull(),
    qualidadeSono: qualidadeSonoEnum('qualidade_sono').notNull(),
    atividadeFisica: text('atividade_fisica'),
    nivelDor: integer('nivel_dor'), // 0-10
    objetivosTratamento: text('objetivos_tratamento'),
    usoPrevioCannabis: boolean('uso_previo_cannabis').default(false),
    criadoPor: text('criado_por')
      .notNull()
      .references(() => medicos.id),
    ...softDeleteColumn,
  },
  (table) => [index('anamneses_paciente_idx').on(table.pacienteId)],
);
