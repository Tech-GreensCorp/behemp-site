import { pgTable, text, boolean, jsonb } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';

/**
 * Singleton de configuração para o sistema de alertas.
 * Deve conter apenas 1 linha.
 */
export const alertasConfig = pgTable('alertas_config', {
  ...baseColumns,
  marcosMedicacaoDias: jsonb('marcos_medicacao_dias').notNull().default([40, 30, 10]),
  marcosLicencaDias: jsonb('marcos_licenca_dias').notNull().default([60, 30]),
  digestHorario: text('digest_horario').notNull().default('08:00'),
  digestAtivo: boolean('digest_ativo').notNull().default(true),
  notificarPaciente: boolean('notificar_paciente').notNull().default(true),
});
