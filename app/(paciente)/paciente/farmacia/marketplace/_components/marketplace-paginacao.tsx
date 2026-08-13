'use client';

import { useCallback, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MarketplacePaginacaoProps {
  paginaAtual: number;
  totalPaginas: number;
  totalRegistros: number;
  porPagina: number;
}

export function MarketplacePaginacao({
  paginaAtual,
  totalPaginas,
  totalRegistros,
  porPagina,
}: MarketplacePaginacaoProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const irParaPagina = useCallback(
    (pagina: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (pagina > 1) params.set('pagina', String(pagina));
      else params.delete('pagina');

      startTransition(() => {
        const qs = params.toString();
        router.push(`/paciente/farmacia/marketplace${qs ? `?${qs}` : ''}`);
      });
    },
    [router, searchParams],
  );

  const inicio = (paginaAtual - 1) * porPagina + 1;
  const fim = Math.min(paginaAtual * porPagina, totalRegistros);

  const gerarPaginas = (): (number | '...')[] => {
    const paginas: (number | '...')[] = [];
    const maxVisivel = 5;

    if (totalPaginas <= maxVisivel + 2) {
      for (let i = 1; i <= totalPaginas; i++) paginas.push(i);
    } else {
      paginas.push(1);
      const inicioRange = Math.max(2, paginaAtual - 1);
      const fimRange = Math.min(totalPaginas - 1, paginaAtual + 1);
      if (inicioRange > 2) paginas.push('...');
      for (let i = inicioRange; i <= fimRange; i++) paginas.push(i);
      if (fimRange < totalPaginas - 1) paginas.push('...');
      paginas.push(totalPaginas);
    }

    return paginas;
  };

  return (
    <div className="flex flex-col items-center gap-4 border-t border-border/20 pt-6 sm:flex-row sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Mostrando <span className="font-bold text-foreground">{inicio}</span>–
        <span className="font-bold text-foreground">{fim}</span> de{' '}
        <span className="font-bold text-foreground">{totalRegistros}</span> produtos
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => irParaPagina(paginaAtual - 1)}
          disabled={paginaAtual === 1 || isPending}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-0.5">
          {gerarPaginas().map((p, idx) =>
            p === '...' ? (
              <span
                key={`dots-${idx}`}
                className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground"
              >
                ···
              </span>
            ) : (
              <button
                key={p}
                onClick={() => irParaPagina(p)}
                disabled={isPending}
                className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-bold transition-all ${
                  p === paginaAtual
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {p}
              </button>
            ),
          )}
        </div>

        <button
          onClick={() => irParaPagina(paginaAtual + 1)}
          disabled={paginaAtual === totalPaginas || isPending}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label="Próxima página"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
