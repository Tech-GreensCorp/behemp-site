'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, SlidersHorizontal, Stethoscope } from 'lucide-react';

/**
 * Filtros de `/admin/teleconsulta` — mesmo padrão de URL searchParams de
 * `PagamentoFilters`, com um select de médico a mais (pedido explícito: "filtragem por
 * médicos"). Componente próprio em vez de estender o de pagamentos — telas diferentes,
 * evita acoplar as duas.
 */

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'agendada', label: 'Agendada' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'realizada', label: 'Realizada' },
  { value: 'cancelada', label: 'Cancelada' },
];

interface TeleconsultaFiltersProps {
  basePath: string;
  statusAtual?: string;
  buscaAtual?: string;
  medicoAtual?: string;
  medicos: Array<{ medicoId: string; nome: string }>;
}

export function TeleconsultaFilters({
  basePath,
  statusAtual = '',
  buscaAtual = '',
  medicoAtual = '',
  medicos,
}: TeleconsultaFiltersProps) {
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
      router.push(`${basePath}${qs ? `?${qs}` : ''}`);
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

  const hasActiveFilters = statusAtual || buscaAtual || medicoAtual;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
          />
          <Input
            placeholder="Buscar por paciente ou médico..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={handleBuscaKeyDown}
            className="h-10 pr-10 pl-10"
          />
          {busca && (
            <button
              onClick={limparBusca}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
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

        <Select
          value={medicoAtual || 'todos'}
          onValueChange={(val) => aplicarFiltro('medico', val === 'todos' ? '' : (val ?? ''))}
        >
          <SelectTrigger className="h-10 w-full sm:w-56">
            <Stethoscope size={14} className="text-muted-foreground shrink-0" />
            <SelectValue placeholder="Todos os médicos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os médicos</SelectItem>
            {medicos.map((m) => (
              <SelectItem key={m.medicoId} value={m.medicoId}>
                {m.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 overflow-x-auto">
          <SlidersHorizontal size={14} className="text-muted-foreground shrink-0" />
          <div className="bg-background flex items-center gap-0.5 rounded-lg border p-0.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => aplicarFiltro('status', opt.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
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
              startTransition(() => router.push(basePath));
            }}
            className="text-muted-foreground hover:text-destructive flex items-center gap-1 text-xs whitespace-nowrap transition-colors"
          >
            <X size={12} />
            Limpar tudo
          </button>
        )}
      </div>

      {isPending && (
        <div className="flex items-center justify-center py-2">
          <div className="bg-muted h-1 w-24 overflow-hidden rounded-full">
            <div className="bg-primary h-full w-1/3 animate-[shimmer_1s_infinite] rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
}
