import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { estiloLinha } from '@/lib/catalogo/linhas';
import type { ProdutoApi } from '@/lib/catalogo/mapear-produto';

interface ProdutoCardProps {
  produto: ProdutoApi;
  /** Base do link de detalhe — /paciente/produtos ou /medico/produtos. */
  basePath: string;
}

/**
 * Preço fica só no detalhe do produto, não no card:
 * é um valor de referência opcional (o valor real é definido na
 * plataforma parceira), e antecipá-lo no card criaria expectativa de
 * preço "oficial" num contexto regulatoriamente sensível. O card foca
 * em identificação do produto; o CTA leva para os detalhes e a compra.
 */
export function ProdutoCard({ produto, basePath }: ProdutoCardProps) {
  const imagem = produto.files.find((f) => f.category === 'products_images');
  const linhaEstilo = estiloLinha(produto.productLine);

  return (
    <Link
      href={`${basePath}/${produto.sku}`}
      className="group border-border bg-card flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="bg-muted/30 relative flex h-52 items-center justify-center overflow-hidden p-6">
        {imagem ? (
          <Image
            src={imagem.fileUrl}
            alt={produto.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <Package size={40} className="text-muted-foreground/30" />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6">
        {produto.productLine && (
          <span
            className={cn(
              'inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase',
              linhaEstilo.badge,
            )}
          >
            {produto.productLine}
          </span>
        )}

        <h3 className="font-display text-lg leading-snug font-semibold">{produto.name}</h3>

        {produto.description.length > 0 && (
          <ul className="space-y-1">
            {produto.description.slice(0, 2).map((linha, idx) => (
              <li
                key={idx}
                className="text-muted-foreground line-clamp-2 flex gap-1.5 text-sm leading-relaxed"
              >
                <span className="bg-muted-foreground/40 mt-1.5 h-1 w-1 shrink-0 rounded-full" />
                {linha}
              </li>
            ))}
          </ul>
        )}

        <div className="border-border/50 mt-auto flex items-center justify-between border-t pt-4">
          <span className="text-primary inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            Ver detalhes
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
