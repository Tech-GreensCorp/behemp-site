import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, PackageSearch } from 'lucide-react';
import { ProdutoCard } from '../_components/produto-card';
import { MarketplaceFiltros } from './_components/marketplace-filtros';
import { MarketplacePaginacao } from './_components/marketplace-paginacao';
import { listarCategorias, listarProdutos, obterCategoria } from '../_lib/produtos';

export const metadata: Metadata = {
  title: 'Marketplace | Nossa Farmácia | Be4Hope',
};

const POR_PAGINA = 12;

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;

  const busca = params.busca?.trim() || '';
  const categoria = params.categoria || '';
  const pagina = parseInt(params.pagina || '1', 10);

  const resultado = listarProdutos({
    busca: busca || undefined,
    categoria: categoria || undefined,
    pagina,
    porPagina: POR_PAGINA,
  });

  const categorias = listarCategorias();
  const categoriaInfo = categoria ? obterCategoria(categoria) : undefined;

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <Link
          href="/paciente/farmacia"
          className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Nossa Farmácia
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {categoriaInfo ? categoriaInfo.nome : 'Todos os produtos'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {categoriaInfo ? categoriaInfo.descricao : 'Explore o catálogo completo da Nossa Farmácia.'}
        </p>
      </div>

      <div className="animate-fade-up delay-75">
        <MarketplaceFiltros categorias={categorias} categoriaAtual={categoria} buscaAtual={busca} />
      </div>

      {resultado.itens.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/20 bg-white py-16 text-center sm:rounded-3xl">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <PackageSearch className="h-8 w-8 text-primary/40" />
          </div>
          <h2 className="font-display text-lg font-bold text-foreground">Nenhum produto encontrado</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Tente ajustar a busca ou remover os filtros de categoria.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 animate-fade-up delay-150 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {resultado.itens.map((produto) => (
              <ProdutoCard key={produto.id} produto={produto} />
            ))}
          </div>

          {resultado.totalPaginas > 1 && (
            <MarketplacePaginacao
              paginaAtual={resultado.paginaAtual}
              totalPaginas={resultado.totalPaginas}
              totalRegistros={resultado.total}
              porPagina={POR_PAGINA}
            />
          )}
        </>
      )}
    </div>
  );
}
