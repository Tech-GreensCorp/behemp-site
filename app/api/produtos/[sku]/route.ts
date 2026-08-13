import { NextResponse } from 'next/server';
import { buscarProdutoPublicoPorSku } from '@/lib/catalogo/consultas';
import { mapearProdutoParaApi } from '@/lib/catalogo/mapear-produto';

/**
 * Detalhe de um produto por SKU.
 * Requer sessão ativa — ver middleware.ts (removida da lista de rotas
 * públicas). Retorna apenas se ativo e não excluído.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;

  const resultado = await buscarProdutoPublicoPorSku(sku);
  if (!resultado) {
    return NextResponse.json({ erro: 'Produto não encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    data: mapearProdutoParaApi(resultado.produto, resultado.arquivos),
  });
}
