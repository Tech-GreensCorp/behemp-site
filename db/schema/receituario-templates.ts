import { pgTable, text, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { medicos } from './medicos';
import { prescricaoTipoEnum } from './enums';

/**
 * Templates de receituário — canvas A4 configurável por blocos.
 * medicoId null = template da organização (visível para todos os médicos).
 * config: ReceituarioConfig (blocos, cores, estampa) — editor visual.
 * layoutHtml: Handlebars cru (modo avançado — alternativa ao config).
 */
export const receituarioTemplates = pgTable(
  'receituario_templates',
  {
    ...baseColumns,
    medicoId: text('medico_id').references(() => medicos.id), // null = org
    nome: text('nome').notNull(),
    tipo: prescricaoTipoEnum('tipo').notNull().default('simples'),
    padrao: boolean('padrao').default(false),
    ativo: boolean('ativo').default(true),
    config: jsonb('config'), // ReceituarioConfig (blocos, cores, estampa)
    layoutHtml: text('layout_html'), // Handlebars cru (modo avançado)
    ...softDeleteColumn,
  },
  (t) => [
    index('receituario_templates_medico_idx').on(t.medicoId),
    index('receituario_templates_ativo_idx').on(t.ativo),
  ],
);
