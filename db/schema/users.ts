import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { userRoleEnum } from './enums';

/**
 * Tabela de usuários — base para todos os roles do sistema.
 * Cada usuário tem um único role: admin, medico ou paciente.
 */
export const users = pgTable(
  'users',
  {
    ...baseColumns,
    email: text('email').notNull(),
    nome: text('nome').notNull(),
    role: userRoleEnum('role').notNull().default('paciente'),
    telefone: text('telefone'),
    avatarUrl: text('avatar_url'),
    clerkId: text('clerk_id'),
    ...softDeleteColumn,
  },
  (table) => [uniqueIndex('users_email_idx').on(table.email)],
);
