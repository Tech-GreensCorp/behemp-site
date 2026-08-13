import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, FileText, Package, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buscarProdutoPublicoPorSku } from '@/lib/catalogo/consultas';
import { mapearProdutoParaApi } from '@/lib/catalogo/mapear-produto';
import { estiloLinha, isLinhaProduto, SOBRE_LINHA } from '@/lib/catalogo/linhas';

const LABEL_DOCUMENTO: Record<'coa' | 'ficha_tecnica' | 'ficha_informativa', string> = {
  coa: 'COA (Certificado de Análise)',
  ficha_tecnica: 'Ficha Técnica',
  ficha_informativa: 'Ficha Informativa',
};

export async function gerarMetadataProduto(sku: string): Promise<Metadata> {
  const resultado = await buscarProdutoPublicoPorSku(sku);
  if (!resultado) return { title: 'Produto não encontrado — Be4Hope' };

  const produto = mapearProdutoParaApi(resultado.produto, resultado.arquivos);
  return {
    title: `${produto.name} — Be4Hope`,
    description:
      produto.description[0] ??
      'Especificações técnicas do produto no catálogo institucional Be4Hope.',
  };
}

interface ProdutoDetalheProps {
  sku: string;
  /** Base da rota de "voltar ao catálogo" — /paciente/produtos ou /medico/produtos. */
  basePath: string;
}

/**
 * Corpo do detalhe de um produto — imagem, descrição, CTA de compra,
 * documentos, fórmula e "Sobre a linha". Reaproveitado pelas áreas
 * autenticadas de paciente e médico — a única diferença entre elas é o
 * `basePath` dos links; auth/role ficam por conta do layout que renderiza.
 * Não há mais versão pública deste detalhe.
 */
export async function ProdutoDetalhe({ sku, basePath }: ProdutoDetalheProps) {
  const resultado = await buscarProdutoPublicoPorSku(sku);
  if (!resultado) notFound();

  const produto = mapearProdutoParaApi(resultado.produto, resultado.arquivos);
  const imagem = resultado.arquivos.find((a) => a.categoria === 'imagem');
  const formula = resultado.arquivos.find((a) => a.categoria === 'formula');
  const documentos = resultado.arquivos.filter(
    (a): a is typeof a & { categoria: 'coa' | 'ficha_tecnica' | 'ficha_informativa' } =>
      a.categoria === 'coa' ||
      a.categoria === 'ficha_tecnica' ||
      a.categoria === 'ficha_informativa',
  );
  const linhaEstilo = estiloLinha(produto.productLine);
  const sobreLinha = isLinhaProduto(produto.productLine) ? SOBRE_LINHA[produto.productLine] : null;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
      <Link
        href={basePath}
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1.5 text-sm font-medium"
      >
        <ArrowLeft size={14} />
        Voltar ao catálogo
      </Link>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Imagens: principal em destaque, fórmula menor abaixo à esquerda */}
        <div className="flex flex-col gap-4">
          <div className="border-border bg-muted/30 relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border p-8 shadow-sm">
            {imagem ? (
              <Image
                src={imagem.urlBlob}
                alt={produto.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain p-6"
                priority
              />
            ) : (
              <Package size={64} className="text-muted-foreground/30" />
            )}
          </div>

          {formula && (
            <div className="w-32 sm:w-40">
              <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-widest uppercase">
                Fórmula
              </p>
              <Image
                src={formula.urlBlob}
                alt={`Fórmula de ${produto.name}`}
                width={320}
                height={320}
                className="h-auto w-full object-contain"
              />
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex flex-col">
          {produto.productLine && (
            <span
              className={cn(
                'mb-4 inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] font-bold tracking-widest uppercase',
                linhaEstilo.badge,
              )}
            >
              {produto.productLine}
            </span>
          )}
          <h1 className="font-display text-3xl leading-tight font-bold sm:text-4xl">
            {produto.name}
          </h1>

          {produto.description.length > 0 && (
            <ul className="text-muted-foreground mt-6 space-y-2.5 text-sm leading-relaxed">
              {produto.description.map((linha, idx) => (
                <li key={idx} className="flex gap-2.5">
                  <span className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                  {linha}
                </li>
              ))}
            </ul>
          )}

          {produto.price !== null && (
            <p className="mt-6 text-2xl font-bold">R$ {produto.price.toFixed(2)}</p>
          )}

          <a
            href={produto.purchaseUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="bg-primary hover:bg-primary/90 mt-5 inline-flex h-12 w-fit items-center justify-center gap-2 rounded-full px-8 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:shadow-lg"
          >
            Comprar
            <ExternalLink size={16} />
          </a>

          <p className="text-muted-foreground mt-3 max-w-md text-xs leading-relaxed">
            A compra e o pagamento são processados integralmente pela plataforma parceira. A Be4Hope
            não realiza venda direta neste site.
          </p>

          {documentos.length > 0 && (
            <div className="border-border/50 mt-8 space-y-2 border-t pt-6">
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Documentos
              </p>
              <div className="flex flex-wrap gap-2">
                {documentos.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.urlBlob}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/40 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
                  >
                    <FileText size={14} className="text-primary shrink-0" />
                    {LABEL_DOCUMENTO[doc.categoria]}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="border-border/60 bg-muted/30 text-muted-foreground mt-8 flex items-start gap-2 rounded-xl border p-4 text-xs leading-relaxed">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <p>
              Este material é informativo e não substitui orientação médica. O uso de produtos à
              base de Cannabis no Brasil depende de prescrição e autorização regulatória (ANVISA)
              aplicáveis ao caso de cada paciente.
            </p>
          </div>
        </div>
      </div>

      {sobreLinha && (
        <div className="border-border bg-card mt-12 rounded-2xl border px-8 py-10">
          <span className="text-muted-foreground mb-3 inline-block text-[11px] font-semibold tracking-widest uppercase">
            Sobre a linha
          </span>
          <h2 className="font-display text-2xl font-bold">{produto.productLine}</h2>
          <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-relaxed">
            {sobreLinha}
          </p>
        </div>
      )}
    </div>
  );
}
