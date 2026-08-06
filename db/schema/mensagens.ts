import { pgTable, text, jsonb, index } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { gruposChat } from './grupos-chat';
import { users } from './users';

/**
 * Tabela de mensagens — mensagens enviadas nos grupos de chat.
 * O campo lidaPor é um array JSONB com os IDs dos usuários que leram a mensagem.
 */
export const mensagens = pgTable(
  'mensagens',
  {
    ...baseColumns,
    grupoId: text('grupo_id')
      .notNull()
      .references(() => gruposChat.id),
    autorId: text('autor_id')
      .notNull()
      .references(() => users.id),
    conteudo: text('conteudo').notNull(),
    lidaPor: jsonb('lida_por').$type<string[]>().default([]),
    ...softDeleteColumn,
  },
  (table) => [
    index('mensagens_grupo_idx').on(table.grupoId),
    index('mensagens_autor_idx').on(table.autorId),
  ],
);
