import { pgTable, text, numeric, boolean, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { users } from './users';

/**
 * Catálogo de produtos vendidos em plataforma externa.
 * Este site é institucional e não realiza venda direta — cada produto
 * aponta para `urlCompra`, a página de compra na plataforma parceira.
 *
 * Não confundir com `medicamentos`: aquela tabela é clínica (dosagens,
 * prescrições); esta é comercial/institucional (catálogo público).
 */
export const produtos = pgTable(
  'produtos',
  {
    ...baseColumns,
    sku: text('sku').notNull(),
    nome: text('nome').notNull(),
    linhaProduto: text('linha_produto'),
    descricao: jsonb('descricao').$type<string[]>().notNull().default([]),
    preco: numeric('preco', { precision: 10, scale: 2 }),
    urlCompra: text('url_compra').notNull(),
    ativo: boolean('ativo').notNull().default(true),
    ...softDeleteColumn,
    // Exceção pontual ao padrão de softDeleteColumn (só deletedAt): a auditoria
    // (logsAuditoria) já registra quem fez cada ação, mas exigiria join extra
    // toda vez que o admin listar produtos excluídos. Guardamos aqui direto.
    excluidoPor: text('excluido_por').references(() => users.id),
  },
  (table) => [
    uniqueIndex('produtos_sku_idx').on(table.sku),
    index('produtos_linha_produto_idx').on(table.linhaProduto),
    index('produtos_ativo_idx').on(table.ativo),
  ],
);
