import type { produtos, produtoArquivos } from '@/db/schema';

/**
 * Mapeia entidades do catálogo (schema em português) para o contrato
 * público da API (chaves em inglês), consumido pelo site institucional
 * e por integrações externas.
 *
 * Divergências intencionais em relação ao contrato original pedido:
 * - `id` é CUID2 (texto), não UUID — todo o banco usa CUID2 (db/schema/_helpers.ts).
 * - arquivo usa `blobKey`/`fileUrl` em vez de `s3Key` — o projeto usa Vercel Blob,
 *   não S3; nomear o campo "s3Key" seria enganoso.
 */

type Produto = typeof produtos.$inferSelect;
type ProdutoArquivo = typeof produtoArquivos.$inferSelect;

export interface ProdutoArquivoApi {
  id: string;
  blobKey: string;
  category: 'products_images' | 'products_documents' | 'products_formulas';
  description: string | null;
  productId: string;
  mimetype: string;
  fileUrl: string;
}

export interface ProdutoApi {
  id: string;
  sku: string;
  name: string;
  productLine: string | null;
  description: string[];
  price: number | null;
  purchaseUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  files: ProdutoArquivoApi[];
}

const CATEGORIA_PARA_API: Record<ProdutoArquivo['categoria'], ProdutoArquivoApi['category']> = {
  imagem: 'products_images',
  formula: 'products_formulas',
  coa: 'products_documents',
  ficha_tecnica: 'products_documents',
  ficha_informativa: 'products_documents',
};

export function mapearArquivoParaApi(arquivo: ProdutoArquivo): ProdutoArquivoApi {
  return {
    id: arquivo.id,
    blobKey: arquivo.urlBlob,
    category: CATEGORIA_PARA_API[arquivo.categoria],
    description: arquivo.descricao,
    productId: arquivo.produtoId,
    mimetype: arquivo.mimetype,
    fileUrl: arquivo.urlBlob,
  };
}

export function mapearProdutoParaApi(
  produto: Produto,
  arquivos: ProdutoArquivo[] = [],
): ProdutoApi {
  return {
    id: produto.id,
    sku: produto.sku,
    name: produto.nome,
    productLine: produto.linhaProduto,
    description: produto.descricao,
    price: produto.preco !== null ? Number(produto.preco) : null,
    purchaseUrl: produto.urlCompra,
    isActive: produto.ativo,
    createdAt: produto.createdAt.toISOString(),
    updatedAt: produto.updatedAt.toISOString(),
    deletedAt: produto.deletedAt ? produto.deletedAt.toISOString() : null,
    deletedBy: produto.excluidoPor,
    files: arquivos.map(mapearArquivoParaApi),
  };
}

export interface PaginacaoApi {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function montarPaginacaoApi(
  currentPage: number,
  pageSize: number,
  totalItems: number,
): PaginacaoApi {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  };
}
