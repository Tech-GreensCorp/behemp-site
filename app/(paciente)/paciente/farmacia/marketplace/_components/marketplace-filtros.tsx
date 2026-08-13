'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { CategoriaProduto } from '../../_lib/produtos';

interface MarketplaceFiltrosProps {
  categorias: CategoriaProduto[];
  categoriaAtual?: string;
  buscaAtual?: string;
}

export function MarketplaceFiltros({
  categorias,
  categoriaAtual = '',
  buscaAtual = '',
}: MarketplaceFiltrosProps) {
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
        router.push(`/paciente/farmacia/marketplace${qs ? `?${qs}` : ''}`);
      });
    },
    [router, searchParams],
  );

  const handleBuscaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') aplicarFiltro({ busca: busca.trim() });
  };

  const limparBusca = () => {
    setBusca('');
    aplicarFiltro({ busca: '' });
  };

  const hasActiveFilters = Boolean(categoriaAtual || buscaAtual);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar produtos, marcas..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={handleBuscaKeyDown}
          onBlur={() => aplicarFiltro({ busca: busca.trim() })}
          className="h-11 rounded-full border-border/40 bg-white pl-10 pr-10 text-sm"
        />
        {busca && (
          <button
            onClick={limparBusca}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => aplicarFiltro({ categoria: '' })}
          className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-bold transition-all ${
            !categoriaAtual
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-border/40 bg-white text-muted-foreground hover:bg-muted'
          }`}
        >
          Todos
        </button>
        {categorias.map((categoria) => (
          <button
            key={categoria.slug}
            onClick={() => aplicarFiltro({ categoria: categoria.slug })}
            className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-bold transition-all ${
              categoriaAtual === categoria.slug
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border/40 bg-white text-muted-foreground hover:bg-muted'
            }`}
          >
            {categoria.nome}
          </button>
        ))}

        {hasActiveFilters && (
          <button
            onClick={() => {
              setBusca('');
              startTransition(() => router.push('/paciente/farmacia/marketplace'));
            }}
            className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
          >
            <X className="h-3 w-3" />
            Limpar filtros
          </button>
        )}
      </div>

      {isPending && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 animate-[shimmer_1s_infinite] rounded-full bg-primary" />
        </div>
      )}
    </div>
  );
}
