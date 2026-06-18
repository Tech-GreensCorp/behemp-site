import { pgTable, text } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';

/**
 * Tabela para armazenar leads capturados antes do download de ebooks.
 */
export const leadsEbook = pgTable('leads_ebook', {
  ...baseColumns,
  nome: text('nome').notNull(),
  email: text('email').notNull(),
  telefone: text('telefone').notNull(),
  ebookId: text('ebook_id').notNull(),
  ebookTitle: text('ebook_title').notNull(),
});
