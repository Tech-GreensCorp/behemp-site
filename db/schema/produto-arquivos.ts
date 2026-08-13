import { pgTable, text, index } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';
import { produtos } from './produtos';
import { produtoArquivoCategoriaEnum } from './enums';

/**
 * Arquivos anexados a um produto do catálogo: imagens, documentos
 * (bulas, laudos) e fórmulas. Armazenados no Vercel Blob (urlBlob),
 * não em S3.
 */
export const produtoArquivos = pgTable(
  'produto_arquivos',
  {
    ...baseColumns,
    produtoId: text('produto_id')
      .notNull()
      .references(() => produtos.id, { onDelete: 'cascade' }),
    categoria: produtoArquivoCategoriaEnum('categoria').notNull(),
    urlBlob: text('url_blob').notNull(),
    nomeArquivo: text('nome_arquivo'),
    mimetype: text('mimetype').notNull(),
    descricao: text('descricao'),
  },
  (table) => [index('produto_arquivos_produto_idx').on(table.produtoId)],
);
