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
import { Search, X } from 'lucide-react';
import { LINHAS_PRODUTO } from '@/lib/catalogo/linhas';

/**
 * Filtros do catálogo de produtos (admin) — busca, linha e ordenação,
 * via URL searchParams.
 */

interface ProdutosFiltrosProps {
  buscaAtual?: string;
  linhaAtual?: string;
  ordenarAtual?: string;
}

export function ProdutosFiltros({
  buscaAtual = '',
  linhaAtual = '',
  ordenarAtual = 'recentes',
}: ProdutosFiltrosProps) {
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
        router.push(`/admin/produtos${qs ? `?${qs}` : ''}`);
      });
    },
    [router, searchParams],
  );

  const handleBusca = () => aplicarFiltro({ busca: busca.trim() });
  const limparBusca = () => {
    setBusca('');
    aplicarFiltro({ busca: '' });
  };

  const hasActiveFilters = buscaAtual || linhaAtual;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          size={16}
          className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
        />
        <Input
          placeholder="Buscar por nome ou SKU..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleBusca()}
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
        value={linhaAtual || 'todas'}
        onValueChange={(v) => v && aplicarFiltro({ linha: v === 'todas' ? '' : v })}
      >
        <SelectTrigger className="h-10 w-full sm:w-40">
          <SelectValue placeholder="Linha" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as linhas</SelectItem>
          {LINHAS_PRODUTO.map((linha) => (
            <SelectItem key={linha} value={linha}>
              {linha}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={ordenarAtual} onValueChange={(v) => v && aplicarFiltro({ ordenar: v })}>
        <SelectTrigger className="h-10 w-full sm:w-44">
          <SelectValue placeholder="Ordenar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recentes">Mais recentes</SelectItem>
          <SelectItem value="antigos">Mais antigos</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <button
          onClick={() => {
            setBusca('');
            startTransition(() => router.push('/admin/produtos'));
          }}
          className="text-muted-foreground hover:text-destructive flex items-center gap-1 text-xs whitespace-nowrap transition-colors"
        >
          <X size={12} />
          Limpar
        </button>
      )}
    </div>
  );
}
