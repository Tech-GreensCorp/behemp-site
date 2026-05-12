import { pgTable, text, boolean } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';

/**
 * Tabela de e-mails de notificação — endereços cadastrados pelo admin
 * que recebem notificações de recompra (equipe financeira, etc.).
 */
export const emailsNotificacao = pgTable('emails_notificacao', {
  ...baseColumns,
  email: text('email').notNull(),
  nome: text('nome').notNull(),
  /** Categoria: 'financeiro', 'administrativo', 'geral' */
  categoria: text('categoria').notNull().default('financeiro'),
  ativo: boolean('ativo').notNull().default(true),
});
