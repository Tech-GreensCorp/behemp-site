import { Package } from 'lucide-react';
import { listarProdutosPublico } from '@/lib/catalogo/consultas';
import { mapearProdutoParaApi } from '@/lib/catalogo/mapear-produto';
import { LINHAS_PRODUTO } from '@/lib/catalogo/linhas';
import { ProdutoCard } from './produto-card';
import { ProdutosFiltro } from './produtos-filtro';

const POR_PAGINA = 12;

interface CatalogoProdutosProps {
  searchParams: { [key: string]: string | undefined };
  /** Base das rotas de filtro/paginação/detalhe — /paciente/produtos ou /medico/produtos. */
  basePath: string;
}

/**
 * Corpo do catálogo de produtos (listagem, busca, filtro por linha, paginação).
 * Reaproveitado pelas áreas autenticadas de paciente e médico — a única
 * diferença entre elas é o `basePath` usado para montar os links; auth/role
 * ficam por conta do layout que renderiza (app/(paciente) e app/(medico)).
 * Não há mais versão pública deste catálogo.
 */
export async function CatalogoProdutos({ searchParams, basePath }: CatalogoProdutosProps) {
  const busca = searchParams.busca || '';
  const linha = searchParams.linha || '';
  const pagina = parseInt(searchParams.pagina || '1', 10);

  const resultado = await listarProdutosPublico({
    busca: busca || undefined,
    linhaProduto: linha || undefined,
    pagina,
    porPagina: POR_PAGINA,
  });

  const produtosApi = resultado.itens.map((p) =>
    mapearProdutoParaApi(p, resultado.arquivosPorProduto(p.id)),
  );
  const totalPaginas = Math.max(1, Math.ceil(resultado.total / POR_PAGINA));

  return (
    <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <span className="bg-secondary/10 text-secondary mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-widest uppercase">
          <Package size={12} />
          Catálogo institucional
        </span>
        <h1 className="font-display text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
          Nossos <span className="text-accent-italic">produtos.</span>
        </h1>
        <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-base leading-relaxed">
          Especificações técnicas dos produtos à base de Cannabis medicinal que acompanhamos. A
          compra é realizada diretamente em nossa plataforma parceira — a Be4Hope não realiza venda
          direta.
        </p>
      </div>

      <div className="mb-10">
        <ProdutosFiltro
          buscaAtual={busca}
          linhaAtual={linha}
          linhas={LINHAS_PRODUTO}
          basePath={basePath}
        />
      </div>

      {produtosApi.length === 0 ? (
        <div className="text-muted-foreground py-24 text-center text-sm">
          Nenhum produto encontrado{busca ? ' para esta busca' : ''}.
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {produtosApi.map((produto) => (
            <ProdutoCard key={produto.id} produto={produto} basePath={basePath} />
          ))}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="mt-12 flex items-center justify-center gap-2">
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`?${new URLSearchParams({ ...(busca && { busca }), ...(linha && { linha }), pagina: String(p) }).toString()}`}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all ${
                p === pagina
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
