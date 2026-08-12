import { pgTable, text, integer, numeric, boolean } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';
import { tipoEspectroEnum } from './enums';

/**
 * Tabela de medicamentos — cadastro dos medicamentos disponíveis.
 * O campo gotasPorMl pode variar por concentração (padrão: 20 gotas/ml).
 */
export const medicamentos = pgTable('medicamentos', {
  ...baseColumns,
  nome: text('nome').notNull(),
  principioAtivo: text('principio_ativo'),
  gotasPorMl: integer('gotas_por_ml').notNull().default(20),
  
  // Novos campos portados do plugin be4hope-fixed
  marca: text('marca'),
  volumeMl: integer('volume_ml').default(30),
  totalGotas: integer('total_gotas').default(900),
  cbdMgPorGota: numeric('cbd_mg_por_gota', { precision: 6, scale: 3 }),
  thcMgPorGota: numeric('thc_mg_por_gota', { precision: 6, scale: 3 }).default('0'),
  cbnMgPorGota: numeric('cbn_mg_por_gota', { precision: 6, scale: 3 }).default('0'),
  cbgMgPorGota: numeric('cbg_mg_por_gota', { precision: 6, scale: 3 }).default('0'),
  thcvMgPorGota: numeric('thcv_mg_por_gota', { precision: 6, scale: 3 }).default('0'),
  tipoEspectro: tipoEspectroEnum('tipo_espectro'),
  nanotecnologia: boolean('nanotecnologia').default(false),
  preco: numeric('preco', { precision: 10, scale: 2 }),
  ativo: boolean('ativo').default(true),
});
