import { pgTable, text, boolean, index } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';
import { users } from './users';
import { notificacaoTipoEnum } from './enums';

/**
 * Tabela de notificações — alertas para o usuário no sistema.
 * Usada para renovação de documentos, recompra, consultas e mensagens.
 */
export const notificacoes = pgTable(
  'notificacoes',
  {
    ...baseColumns,
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    tipo: notificacaoTipoEnum('tipo').notNull(),
    titulo: text('titulo').notNull(),
    mensagem: text('mensagem').notNull(),
    lida: boolean('lida').notNull().default(false),
    linkAcao: text('link_acao'),
  },
  (table) => [
    index('notificacoes_user_idx').on(table.userId),
    index('notificacoes_lida_idx').on(table.lida),
  ],
);
