import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatarPreco, type Produto } from '../_lib/produtos';

export function ProdutoCard({ produto }: { produto: Produto }) {
  return (
    <Link href={`/paciente/farmacia/produtos/${produto.id}`} className="group block h-full">
      <Card className="h-full overflow-hidden rounded-2xl border border-border/20 bg-white p-0 shadow-sm transition-shadow duration-300 hover:shadow-md">
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          <Image
            src={produto.imagem}
            alt={produto.nome}
            fill
            sizes="(min-width: 1280px) 20vw, (min-width: 768px) 33vw, 50vw"
            className="object-cover"
          />
          {produto.badges[0] && (
            <Badge className="absolute left-3 top-3 rounded-full bg-primary text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
              {produto.badges[0]}
            </Badge>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-3 sm:gap-2 sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {produto.marca}
          </p>
          <h3 className="font-display line-clamp-2 text-sm font-bold leading-snug text-foreground">
            {produto.nome}
          </h3>
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {produto.descricaoCurta}
          </p>

          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              {produto.precoOriginal && (
                <p className="text-xs text-muted-foreground/60 line-through">
                  {formatarPreco(produto.precoOriginal)}
                </p>
              )}
              {produto.disponibilidade === 'sob_consulta' ? (
                <p className="text-sm font-bold text-foreground">Sob consulta</p>
              ) : (
                <p className="text-base font-bold text-primary">{formatarPreco(produto.preco)}</p>
              )}
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
