import { pgTable, text } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';
import { users } from './users';

/**
 * Tabela de médicos — perfil profissional vinculado a um usuário.
 * Contém dados do CRM, especialidade e credenciais do Google Calendar.
 */
export const medicos = pgTable('medicos', {
  ...baseColumns,
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  crm: text('crm').notNull(),
  especialidade: text('especialidade').notNull(),
  bio: text('bio'),
  googleCalendarId: text('google_calendar_id'),
  googleRefreshToken: text('google_refresh_token'), // Criptografado em produção
});
