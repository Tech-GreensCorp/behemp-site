import { db } from '@/lib/db';
import { produtos, produtoArquivos } from '@/db/schema';
import { and, eq, ilike, inArray, isNull, sql } from 'drizzle-orm';

/**
 * Consultas do catálogo de produtos — compartilhadas entre a rota JSON
 * (/api/produtos, autenticada) e as Server Components de paciente/médico,
 * para não duplicar a lógica de filtro (ativo=true AND deletedAt IS NULL).
 */

export interface ListarProdutosPublicoParams {
  busca?: string;
  linhaProduto?: string;
  pagina?: number;
  porPagina?: number;
}

export async function listarProdutosPublico(params: ListarProdutosPublicoParams) {
  const pagina = Math.max(1, params.pagina ?? 1);
  const porPagina = Math.min(50, Math.max(1, params.porPagina ?? 12));

  const condicoes = [eq(produtos.ativo, true), isNull(produtos.deletedAt)];
  if (params.busca) condicoes.push(ilike(produtos.nome, `%${params.busca}%`));
  if (params.linhaProduto) condicoes.push(eq(produtos.linhaProduto, params.linhaProduto));
  const whereClause = and(...condicoes);

  const [itens, [{ count }]] = await Promise.all([
    db
      .select()
      .from(produtos)
      .where(whereClause)
      .orderBy(produtos.nome)
      .limit(porPagina)
      .offset((pagina - 1) * porPagina),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(produtos)
      .where(whereClause),
  ]);

  const arquivos = itens.length
    ? await db
        .select()
        .from(produtoArquivos)
        .where(
          inArray(
            produtoArquivos.produtoId,
            itens.map((p) => p.id),
          ),
        )
    : [];

  return {
    itens,
    arquivosPorProduto: (produtoId: string) => arquivos.filter((a) => a.produtoId === produtoId),
    total: count,
    pagina,
    porPagina,
  };
}

export async function buscarProdutoPublicoPorSku(sku: string) {
  const [produto] = await db
    .select()
    .from(produtos)
    .where(and(eq(produtos.sku, sku), eq(produtos.ativo, true), isNull(produtos.deletedAt)))
    .limit(1);

  if (!produto) return null;

  const arquivos = await db
    .select()
    .from(produtoArquivos)
    .where(eq(produtoArquivos.produtoId, produto.id));

  return { produto, arquivos };
}
