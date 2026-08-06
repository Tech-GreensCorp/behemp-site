import { pgTable, text, index } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';
import { users } from './users';
import { grupoChatTipoEnum } from './enums';

/**
 * Tabela de grupos de chat — pode ser conversa direta (2 pessoas) ou grupo.
 */
export const gruposChat = pgTable('grupos_chat', {
  ...baseColumns,
  nome: text('nome'),
  tipo: grupoChatTipoEnum('tipo').notNull().default('direto'),
  criadoPor: text('criado_por')
    .notNull()
    .references(() => users.id),
});

/**
 * Tabela de participantes do grupo — relação N:N entre users e grupos.
 */
export const participantesGrupo = pgTable(
  'participantes_grupo',
  {
    ...baseColumns,
    grupoId: text('grupo_id')
      .notNull()
      .references(() => gruposChat.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    index('participantes_grupo_idx').on(table.grupoId),
    index('participantes_user_idx').on(table.userId),
  ],
);
