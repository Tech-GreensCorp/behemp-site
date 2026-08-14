import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ProdutoCard } from '../../_components/produto-card';
import { ComprarCta } from './_components/comprar-cta';
import {
  formatarPreco,
  listarProdutosRelacionados,
  obterCategoria,
  obterProdutoPorId,
} from '../../_lib/produtos';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const produto = obterProdutoPorId(id);
  return { title: produto ? `${produto.nome} | Nossa Farmácia | Be4Hope` : 'Produto | Be4Hope' };
}

export default async function ProdutoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const produto = obterProdutoPorId(id);

  if (!produto) {
    notFound();
  }

  const categoria = obterCategoria(produto.categoria);
  const relacionados = listarProdutosRelacionados(produto, 4);
  const disponivel = produto.disponibilidade === 'disponivel';

  return (
    <div className="space-y-10">
      {/* ── Breadcrumb ── */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground animate-fade-up">
        <Link href="/paciente/farmacia" className="hover:text-primary">
          Nossa Farmácia
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          href={`/paciente/farmacia/marketplace?categoria=${produto.categoria}`}
          className="hover:text-primary"
        >
          {categoria?.nome ?? 'Produtos'}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="line-clamp-1 text-foreground">{produto.nome}</span>
      </div>

      {/* ── Conteúdo principal ── */}
      <div className="grid gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-12 animate-fade-up delay-75">
        <div className="lg:sticky lg:top-8 lg:self-start">
          <Card className="relative aspect-square overflow-hidden rounded-2xl border border-border/20 bg-primary-soft p-0 shadow-sm sm:rounded-3xl">
            <Image
              src={produto.imagem}
              alt={produto.nome}
              fill
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-contain p-10 sm:p-14"
              priority
            />
            {produto.badges[0] && (
              <Badge className="absolute left-4 top-4 rounded-full bg-primary text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
                {produto.badges[0]}
              </Badge>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {produto.marca}
              </p>
              {categoria && (
                <Badge variant="outline" className="rounded-full text-[10px] font-bold">
                  {categoria.nome}
                </Badge>
              )}
            </div>
            <h1 className="font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl">
              {produto.nome}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {produto.descricao}
            </p>
          </div>

          <div className="flex items-end gap-3 border-y border-border/20 py-5">
            <div>
              {produto.precoOriginal && (
                <p className="text-sm text-muted-foreground/60 line-through">
                  {formatarPreco(produto.precoOriginal)}
                </p>
              )}
              {disponivel ? (
                <p className="font-display text-2xl font-bold text-primary sm:text-3xl">
                  {formatarPreco(produto.preco)}
                </p>
              ) : (
                <p className="font-display text-xl font-bold text-foreground sm:text-2xl">Sob consulta</p>
              )}
            </div>
            {produto.precoOriginal && disponivel && (
              <Badge className="mb-1.5 rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">
                Economia de {formatarPreco(produto.precoOriginal - produto.preco)}
              </Badge>
            )}
          </div>

          {produto.destaques.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                Informações do produto
              </p>
              <ul className="space-y-2">
                {produto.destaques.map((destaque) => (
                  <li key={destaque} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {destaque}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ComprarCta produto={produto.nome} disponivel={disponivel} />

          <p className="text-center text-[11px] text-muted-foreground">
            Venda sob prescrição médica. A disponibilidade final é confirmada com a sua prescrição vigente.
          </p>
        </div>
      </div>

      {/* ── Produtos relacionados ── */}
      {relacionados.length > 0 && (
        <div className="space-y-5 border-t border-border/20 pt-8 animate-fade-up delay-150">
          <h2 className="font-display text-lg font-bold text-foreground sm:text-xl">
            Você também pode gostar
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {relacionados.map((relacionado) => (
              <ProdutoCard key={relacionado.id} produto={relacionado} />
            ))}
          </div>
        </div>
      )}

      <Link
        href="/paciente/farmacia/marketplace"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para o marketplace
      </Link>
    </div>
  );
}
