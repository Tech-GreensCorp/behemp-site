import { text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

/**
 * Colunas padrão presentes em TODAS as tabelas do sistema.
 * - id: CUID2 gerado automaticamente
 * - createdAt: data de criação (preenchida automaticamente)
 * - updatedAt: data de atualização (preenchida automaticamente)
 */
export const baseColumns = {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * Coluna de soft delete para entidades que precisam de exclusão lógica.
 * Usada em entidades clínicas onde o histórico precisa ser preservado.
 */
export const softDeleteColumn = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};
