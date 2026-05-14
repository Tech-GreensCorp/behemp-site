'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X, Filter, SlidersHorizontal } from 'lucide-react';

/**
 * Filtros de invoice — Client Component interativo.
 * Controla tipo, status e busca textual via URL searchParams.
 */

const TIPOS = [
  { value: '', label: 'Todos', icon: '📋' },
  { value: 'donation', label: 'Doação', icon: '🎁' },
  { value: 'judicialization', label: 'Judicialização', icon: '⚖️' },
  { value: 'collab', label: 'Collab', icon: '🤝' },
  { value: 'retail', label: 'Varejo', icon: '🛒' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'completed', label: 'Completo' },
  { value: 'draft', label: 'Rascunho' },
];

interface InvoiceFiltersProps {
  tipoAtual?: string;
  statusAtual?: string;
  buscaAtual?: string;
}

export function InvoiceFilters({
  tipoAtual = '',
  statusAtual = '',
  buscaAtual = '',
}: InvoiceFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [busca, setBusca] = useState(buscaAtual);

  const createQueryString = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());

      // Sempre resetar página ao mudar filtros
      params.delete('pagina');

      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }

      return params.toString();
    },
    [searchParams],
  );

  const aplicarFiltro = (key: string, value: string) => {
    startTransition(() => {
      const qs = createQueryString({ [key]: value });
      router.push(`/admin/invoices${qs ? `?${qs}` : ''}`);
    });
  };

  const handleBusca = () => {
    aplicarFiltro('busca', busca.trim());
  };

  const handleBuscaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBusca();
  };

  const limparBusca = () => {
    setBusca('');
    aplicarFiltro('busca', '');
  };

  const hasActiveFilters = tipoAtual || statusAtual || buscaAtual;

  return (
    <div className="space-y-4">
      {/* Barra de busca + filtro de status */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Campo de busca */}
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="invoice-search"
            placeholder="Buscar por número, paciente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={handleBuscaKeyDown}
            className="h-10 pl-10 pr-10"
          />
          {busca && (
            <button
              onClick={limparBusca}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Botão buscar */}
        <Button
          onClick={handleBusca}
          variant="outline"
          size="sm"
          className="h-10 gap-2"
          disabled={isPending}
        >
          <Search size={14} />
          Buscar
        </Button>

        {/* Filtro de status */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-muted-foreground" />
          <div className="flex items-center rounded-lg border bg-background p-0.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => aplicarFiltro('status', opt.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  (statusAtual || '') === opt.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs de tipo */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter size={14} className="shrink-0 text-muted-foreground" />
        <div className="flex items-center gap-1.5">
          {TIPOS.map((tipo) => (
            <button
              key={tipo.value}
              onClick={() => aplicarFiltro('tipo', tipo.value)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                (tipoAtual || '') === tipo.value
                  ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
                  : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>{tipo.icon}</span>
              {tipo.label}
            </button>
          ))}
        </div>

        {/* Limpar filtros */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setBusca('');
              startTransition(() => router.push('/admin/invoices'));
            }}
            className="ml-auto flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            <X size={12} />
            Limpar tudo
          </button>
        )}
      </div>

      {/* Loading state */}
      {isPending && (
        <div className="flex items-center justify-center py-2">
          <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-[shimmer_1s_infinite] rounded-full bg-primary" />
          </div>
        </div>
      )}
    </div>
  );
}
