import { pgTable, text, numeric } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';

/**
 * Singleton de configuração do pagamento de teleconsulta.
 * Deve conter apenas 1 linha.
 *
 * O valor vai integralmente para o médico (a Be4Hope não retém comissão), então só
 * existe um valor padrão a configurar — sem percentual de split.
 */
export const pagamentosConfig = pgTable('pagamentos_config', {
  ...baseColumns,
  valorConsultaPadrao: numeric('valor_consulta_padrao', { precision: 10, scale: 2 })
    .notNull()
    .default('150.00'),
  moedaPadrao: text('moeda_padrao').notNull().default('BRL'),
});
