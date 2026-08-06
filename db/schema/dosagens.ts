import { pgTable, text, integer, date, boolean, index } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';
import { pacientes } from './pacientes';
import { medicamentos } from './medicamentos';

/**
 * Tabela de dosagens — controle de dosagem atual e histórica do paciente.
 * Calcula data_fim_prevista baseada na fórmula:
 *   gotas_totais = ml_frasco × gotas_por_ml
 *   dias_duracao = gotas_totais / gotas_por_dia
 *   data_fim_prevista = data_inicio + dias_duracao
 */
export const dosagens = pgTable(
  'dosagens',
  {
    ...baseColumns,
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    medicamentoId: text('medicamento_id')
      .notNull()
      .references(() => medicamentos.id),
    gotasPorDia: integer('gotas_por_dia').notNull(),
    mlFrasco: integer('ml_frasco').notNull(),
    dataInicio: date('data_inicio').notNull(),
    dataFimPrevista: date('data_fim_prevista').notNull(),
    ativa: boolean('ativa').notNull().default(true),
  },
  (table) => [
    index('dosagens_paciente_idx').on(table.pacienteId),
    index('dosagens_ativa_idx').on(table.ativa),
  ],
);
