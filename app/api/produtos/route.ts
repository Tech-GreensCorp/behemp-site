import { NextRequest, NextResponse } from 'next/server';
import { listarProdutosPublico } from '@/lib/catalogo/consultas';
import { mapearProdutoParaApi, montarPaginacaoApi } from '@/lib/catalogo/mapear-produto';

/**
 * Catálogo de produtos (vendidos em plataforma externa).
 * Requer sessão ativa — ver middleware.ts (removida da lista de rotas
 * públicas). Qualquer role autenticado pode consultar, sem checagem
 * adicional aqui. Retorna apenas produtos ativos e não excluídos.
 *
 * Query params: page, pageSize, search, productLine
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize')) || 12));
  const search = searchParams.get('search')?.trim() || undefined;
  const productLine = searchParams.get('productLine')?.trim() || undefined;

  const resultado = await listarProdutosPublico({
    busca: search,
    linhaProduto: productLine,
    pagina: page,
    porPagina: pageSize,
  });

  const data = resultado.itens.map((produto) =>
    mapearProdutoParaApi(produto, resultado.arquivosPorProduto(produto.id)),
  );

  return NextResponse.json({
    data,
    pagination: montarPaginacaoApi(resultado.pagina, resultado.porPagina, resultado.total),
  });
}
