'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

/**
 * Componente de paginação para invoices.
 * Navegação via URL searchParams (server-side rendering preservado).
 */

interface InvoicePaginationProps {
  paginaAtual: number;
  totalPaginas: number;
  totalRegistros: number;
  porPagina: number;
  tipoAtual?: string;
  statusAtual?: string;
  buscaAtual?: string;
}

export function InvoicePagination({
  paginaAtual,
  totalPaginas,
  totalRegistros,
  porPagina,
  tipoAtual,
  statusAtual,
  buscaAtual,
}: InvoicePaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const irParaPagina = useCallback(
    (pagina: number) => {
      const params = new URLSearchParams(searchParams.toString());

      if (pagina > 1) {
        params.set('pagina', String(pagina));
      } else {
        params.delete('pagina');
      }

      startTransition(() => {
        const qs = params.toString();
        router.push(`/admin/invoices${qs ? `?${qs}` : ''}`);
      });
    },
    [router, searchParams],
  );

  // Calcular range de registros exibidos
  const inicio = (paginaAtual - 1) * porPagina + 1;
  const fim = Math.min(paginaAtual * porPagina, totalRegistros);

  // Gerar números de página visíveis (máximo 5 ao redor da atual)
  const gerarPaginas = (): (number | '...')[] => {
    const paginas: (number | '...')[] = [];
    const maxVisivel = 5;

    if (totalPaginas <= maxVisivel + 2) {
      // Mostrar todas
      for (let i = 1; i <= totalPaginas; i++) paginas.push(i);
    } else {
      // Sempre mostrar primeira
      paginas.push(1);

      const inicioRange = Math.max(2, paginaAtual - 1);
      const fimRange = Math.min(totalPaginas - 1, paginaAtual + 1);

      if (inicioRange > 2) paginas.push('...');

      for (let i = inicioRange; i <= fimRange; i++) {
        paginas.push(i);
      }

      if (fimRange < totalPaginas - 1) paginas.push('...');

      // Sempre mostrar última
      paginas.push(totalPaginas);
    }

    return paginas;
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
      {/* Info de registros */}
      <p className="text-sm text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{inicio}</span>–
        <span className="font-medium text-foreground">{fim}</span> de{' '}
        <span className="font-medium text-foreground">{totalRegistros}</span> invoices
      </p>

      {/* Controles de paginação */}
      <div className="flex items-center gap-1">
        {/* Primeira página */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 sm:flex"
          disabled={paginaAtual === 1 || isPending}
          onClick={() => irParaPagina(1)}
          title="Primeira página"
        >
          <ChevronsLeft size={14} />
        </Button>

        {/* Página anterior */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={paginaAtual === 1 || isPending}
          onClick={() => irParaPagina(paginaAtual - 1)}
          title="Página anterior"
        >
          <ChevronLeft size={14} />
        </Button>

        {/* Números de página */}
        <div className="flex items-center gap-0.5">
          {gerarPaginas().map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`dots-${idx}`}
                  className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground"
                >
                  ···
                </span>
              );
            }

            return (
              <button
                key={p}
                onClick={() => irParaPagina(p)}
                disabled={isPending}
                className={`flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2 text-xs font-medium transition-all ${
                  p === paginaAtual
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Próxima página */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={paginaAtual === totalPaginas || isPending}
          onClick={() => irParaPagina(paginaAtual + 1)}
          title="Próxima página"
        >
          <ChevronRight size={14} />
        </Button>

        {/* Última página */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 sm:flex"
          disabled={paginaAtual === totalPaginas || isPending}
          onClick={() => irParaPagina(totalPaginas)}
          title="Última página"
        >
          <ChevronsRight size={14} />
        </Button>
      </div>
    </div>
  );
}
