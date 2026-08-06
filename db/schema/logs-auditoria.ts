import { pgTable, text, jsonb, index } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';
import { users } from './users';

/**
 * Tabela de logs de auditoria — registro de todas as ações sobre dados sensíveis.
 * Obrigatório pela LGPD para dados clínicos.
 * Nunca apagar registros desta tabela.
 */
export const logsAuditoria = pgTable(
  'logs_auditoria',
  {
    ...baseColumns,
    userId: text('user_id').references(() => users.id),
    acao: text('acao').notNull(), // 'criar', 'atualizar', 'visualizar', 'deletar'
    entidade: text('entidade').notNull(), // Nome da tabela afetada
    entidadeId: text('entidade_id'), // ID do registro afetado
    dadosAntes: jsonb('dados_antes'), // Snapshot antes da alteração
    dadosDepois: jsonb('dados_depois'), // Snapshot depois da alteração
    ip: text('ip'),
  },
  (table) => [
    index('logs_auditoria_user_idx').on(table.userId),
    index('logs_auditoria_entidade_idx').on(table.entidade),
    index('logs_auditoria_acao_idx').on(table.acao),
  ],
);
