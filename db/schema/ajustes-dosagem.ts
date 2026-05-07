import { pgTable, text, date, index } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { pacientes } from './pacientes';
import { medicos } from './medicos';

/**
 * Tabela de ajustes de dosagem — cada ajuste pode conter N medicamentos.
 */
export const ajustesDosagem = pgTable(
  'ajustes_dosagem',
  {
    ...baseColumns,
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    dataAjuste: date('data_ajuste').notNull(),
    proximaRevisao: date('proxima_revisao'),
    motivoAjuste: text('motivo_ajuste').notNull(),
    criadoPor: text('criado_por')
      .notNull()
      .references(() => medicos.id),
    ...softDeleteColumn,
  },
  (table) => [index('ajustes_dosagem_paciente_idx').on(table.pacienteId)],
);

/**
 * Itens individuais de cada ajuste de dosagem (um medicamento por linha).
 */
export const itensAjusteDosagem = pgTable(
  'itens_ajuste_dosagem',
  {
    ...baseColumns,
    ajusteId: text('ajuste_id')
      .notNull()
      .references(() => ajustesDosagem.id),
    tipoCanabinoide: text('tipo_canabinoide').notNull(),
    novaDosagem: text('nova_dosagem').notNull(),
    dosagemAnterior: text('dosagem_anterior'),
    frequencia: text('frequencia').notNull(),
    concentracaoTHC: text('concentracao_thc'),
    concentracaoCBD: text('concentracao_cbd'),
    viaAdministracao: text('via_administracao'),
  },
  (table) => [index('itens_ajuste_id_idx').on(table.ajusteId)],
);
