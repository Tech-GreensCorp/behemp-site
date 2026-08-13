'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ProdutosPaginacaoProps {
  paginaAtual: number;
  totalPaginas: number;
  totalRegistros: number;
}

export function ProdutosPaginacao({
  paginaAtual,
  totalPaginas,
  totalRegistros,
}: ProdutosPaginacaoProps) {
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
        router.push(`/admin/produtos${qs ? `?${qs}` : ''}`);
      });
    },
    [router, searchParams],
  );

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
      <p className="text-muted-foreground text-sm">
        Página <span className="text-foreground font-medium">{paginaAtual}</span> de{' '}
        <span className="text-foreground font-medium">{totalPaginas}</span> · {totalRegistros}{' '}
        produto{totalRegistros !== 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={paginaAtual <= 1 || isPending}
          onClick={() => irParaPagina(paginaAtual - 1)}
        >
          <ChevronLeft size={14} />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={paginaAtual >= totalPaginas || isPending}
          onClick={() => irParaPagina(paginaAtual + 1)}
        >
          Próximo
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
