'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X, SlidersHorizontal, AlertTriangle } from 'lucide-react';

/**
 * Filtros de pagamentos — Client Component interativo.
 * Controla status e busca textual via URL searchParams (mesmo padrão de InvoiceFilters).
 */

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'pago', label: 'Pago' },
  { value: 'isento', label: 'Isento' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'estornado', label: 'Estornado' },
];

interface PagamentoFiltersProps {
  statusAtual?: string;
  buscaAtual?: string;
  atencaoAtual?: boolean;
}

export function PagamentoFilters({
  statusAtual = '',
  buscaAtual = '',
  atencaoAtual = false,
}: PagamentoFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [busca, setBusca] = useState(buscaAtual);

  const createQueryString = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
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
      router.push(`/admin/pagamentos${qs ? `?${qs}` : ''}`);
    });
  };

  const handleBusca = () => aplicarFiltro('busca', busca.trim());

  const handleBuscaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBusca();
  };

  const limparBusca = () => {
    setBusca('');
    aplicarFiltro('busca', '');
  };

  const toggleAtencao = () => {
    aplicarFiltro('atencao', atencaoAtual ? '' : '1');
  };

  const hasActiveFilters = statusAtual || buscaAtual || atencaoAtual;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="pagamento-search"
            placeholder="Buscar por paciente, médico..."
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

        <button
          onClick={toggleAtencao}
          className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
            atencaoAtual
              ? 'border-red-300 bg-red-100 text-red-800'
              : 'border-border text-muted-foreground hover:border-red-200 hover:text-red-700'
          }`}
        >
          <AlertTriangle size={13} />
          Precisa de atenção
        </button>

        <div className="flex items-center gap-2 overflow-x-auto">
          <SlidersHorizontal size={14} className="shrink-0 text-muted-foreground" />
          <div className="flex items-center gap-0.5 rounded-lg border bg-background p-0.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => aplicarFiltro('status', opt.value)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
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

        {hasActiveFilters && (
          <button
            onClick={() => {
              setBusca('');
              startTransition(() => router.push('/admin/pagamentos'));
            }}
            className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            <X size={12} />
            Limpar tudo
          </button>
        )}
      </div>

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
