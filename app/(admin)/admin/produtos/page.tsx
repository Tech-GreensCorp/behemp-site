import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { listarProdutosAdmin } from '@/app/(admin)/_actions/produtos';
import { ProdutosFiltros } from '@/components/admin/produtos/produtos-filtros';
import { ProdutosPaginacao } from '@/components/admin/produtos/produtos-paginacao';
import { ProdutoLinhaAcoes } from '@/components/admin/produtos/produto-linha-acoes';
import { Plus, Package, Pencil, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { estiloLinha } from '@/lib/catalogo/linhas';

/**
 * Catálogo de produtos (admin) — Server Component com filtros via searchParams.
 */
export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const busca = params.busca || '';
  const linha = params.linha || '';
  const ordenar = params.ordenar === 'antigos' ? 'antigos' : 'recentes';
  const pagina = parseInt(params.pagina || '1', 10);
  const porPagina = 20;

  const resultado = await listarProdutosAdmin({
    busca: busca || undefined,
    linhaProduto: linha || undefined,
    ordenarPor: ordenar,
    pagina,
    porPagina,
  });

  const produtosList = resultado.dados?.produtos ?? [];
  const total = resultado.dados?.total ?? 0;
  const totalPaginas = resultado.dados?.totalPaginas ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Catálogo de Produtos</h1>
          <p className="text-muted-foreground mt-1">
            Vitrine institucional — a compra acontece na plataforma parceira.
          </p>
        </div>
        <Link href="/admin/produtos/novo">
          <Button className="gap-2">
            <Plus size={16} />
            Novo Produto
          </Button>
        </Link>
      </div>

      <ProdutosFiltros buscaAtual={busca} linhaAtual={linha} ordenarAtual={ordenar} />

      {produtosList.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package size={48} className="text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium">Nenhum produto encontrado</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {busca || linha
                ? 'Tente ajustar os filtros de busca.'
                : 'Cadastre o primeiro produto do catálogo.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs font-semibold tracking-wider uppercase">
                    <th className="px-6 py-3">Produto</th>
                    <th className="px-6 py-3">Preço</th>
                    <th className="px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {produtosList.map((p) => {
                    const linhaEstilo = estiloLinha(p.linhaProduto);
                    return (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-muted/30 relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                              {p.imagemUrl ? (
                                <Image
                                  src={p.imagemUrl}
                                  alt={p.nome}
                                  fill
                                  sizes="44px"
                                  className="object-contain p-1"
                                />
                              ) : (
                                <Package size={18} className="text-muted-foreground/40" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-foreground truncate text-sm font-semibold">
                                  {p.nome}
                                </span>
                                {p.deletedAt ? (
                                  <Badge variant="destructive">Excluído</Badge>
                                ) : !p.ativo ? (
                                  <Badge variant="secondary">Inativo</Badge>
                                ) : null}
                              </div>
                              <div className="mt-0.5 flex items-center gap-2">
                                {p.linhaProduto && (
                                  <span
                                    className={cn(
                                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide',
                                      linhaEstilo.badge,
                                    )}
                                  >
                                    {p.linhaProduto}
                                  </span>
                                )}
                                <span className="text-muted-foreground/70 font-mono text-[11px]">
                                  {p.sku}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="text-muted-foreground px-6 py-3 text-sm">
                          {p.preco ? `R$ ${Number(p.preco).toFixed(2)}` : '—'}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {!p.deletedAt && (
                              <Link href={`/admin/produtos/${p.id}`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Pencil size={14} />
                                </Button>
                              </Link>
                            )}
                            <a
                              href={`/paciente/produtos/${p.sku}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Visualizar como usuário logado"
                            >
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <ExternalLink size={14} />
                              </Button>
                            </a>
                            <ProdutoLinhaAcoes
                              produtoId={p.id}
                              nome={p.nome}
                              ativo={p.ativo}
                              excluido={!!p.deletedAt}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {totalPaginas > 1 && (
        <ProdutosPaginacao
          paginaAtual={pagina}
          totalPaginas={totalPaginas}
          totalRegistros={total}
        />
      )}
    </div>
  );
}
