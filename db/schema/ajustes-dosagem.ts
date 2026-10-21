import { pgTable, text, date, index } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { pacientes } from './pacientes';
import { medicos } from './medicos';
import { medicamentos } from './medicamentos';
import { dosagens } from './dosagens';

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

    // ── Ligação com a cadeia numérica (ADR-0012 D-01) ────────────────────────
    // As três colunas abaixo são ADITIVAS e NULLABLE de propósito: linha antiga fica com
    // os três nulos e continua válida — é o histórico legado, em texto livre, que o
    // `DO-48` manda preservar. O caminho novo SEMPRE as preenche.
    /** Qual produto do catálogo. Sem isto não há como cumprir `CAN-03` (nome e concentração). */
    medicamentoId: text('medicamento_id').references(() => medicamentos.id),
    /** A `dosagens` que este ajuste encerrou. */
    dosagemAnteriorId: text('dosagem_anterior_id').references(() => dosagens.id),
    /** A `dosagens` que este ajuste passou a valer. */
    novaDosagemId: text('nova_dosagem_id').references(() => dosagens.id),
  },
  (table) => [
    index('itens_ajuste_id_idx').on(table.ajusteId),
    index('itens_ajuste_medicamento_idx').on(table.medicamentoId),
  ],
);
