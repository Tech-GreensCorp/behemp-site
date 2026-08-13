'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProdutosFiltroProps {
  buscaAtual?: string;
  linhaAtual?: string;
  linhas: readonly string[];
  /** Base da rota — /paciente/produtos ou /medico/produtos. */
  basePath: string;
}

export function ProdutosFiltro({
  buscaAtual = '',
  linhaAtual = '',
  linhas,
  basePath,
}: ProdutosFiltroProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [busca, setBusca] = useState(buscaAtual);

  const aplicarFiltro = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('pagina');
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      startTransition(() => {
        const qs = params.toString();
        router.push(`${basePath}${qs ? `?${qs}` : ''}`);
      });
    },
    [router, searchParams, basePath],
  );

  return (
    <div className="space-y-4">
      <div className="relative mx-auto max-w-lg">
        <Search
          size={16}
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
        />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && aplicarFiltro({ busca: busca.trim() })}
          placeholder="Buscar produto..."
          className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-secondary/40 h-12 w-full rounded-full border pr-11 pl-11 text-sm transition-shadow focus:ring-2 focus:outline-none"
        />
        {busca && (
          <button
            onClick={() => {
              setBusca('');
              aplicarFiltro({ busca: '' });
            }}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-4 -translate-y-1/2"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {linhas.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => aplicarFiltro({ linha: '' })}
            className={cn(
              'rounded-full border px-4 py-1.5 text-xs font-medium transition-all',
              !linhaAtual
                ? 'border-primary bg-primary text-white shadow-sm'
                : 'border-border bg-card text-foreground/70 hover:border-primary/40 hover:text-primary',
            )}
          >
            Todas as linhas
          </button>
          {linhas.map((linha) => (
            <button
              key={linha}
              onClick={() => aplicarFiltro({ linha })}
              className={cn(
                'rounded-full border px-4 py-1.5 text-xs font-medium transition-all',
                linhaAtual === linha
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : 'border-border bg-card text-foreground/70 hover:border-primary/40 hover:text-primary',
              )}
            >
              {linha}
            </button>
          ))}
        </div>
      )}

      {isPending && (
        <div className="flex justify-center">
          <div className="bg-muted h-1 w-24 overflow-hidden rounded-full">
            <div className="bg-primary h-full w-1/3 animate-[shimmer_1s_infinite] rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
}
