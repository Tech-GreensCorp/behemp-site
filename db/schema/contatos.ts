import { pgTable, text, pgEnum } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';

/**
 * Enum de status de leitura de uma mensagem de contato.
 */
export const contatoStatusEnum = pgEnum('contato_status', [
  'nao_lida',
  'lida',
  'respondida',
]);

/**
 * Tabela de mensagens recebidas via formulário de contato público.
 * Visível apenas pelo admin em /admin/mensagens.
 */
export const contatos = pgTable('contatos', {
  ...baseColumns,
  nome: text('nome').notNull(),
  email: text('email').notNull(),
  assunto: text('assunto').notNull(),
  mensagem: text('mensagem').notNull(),
  statusLeitura: contatoStatusEnum('status_leitura').notNull().default('nao_lida'),
});
