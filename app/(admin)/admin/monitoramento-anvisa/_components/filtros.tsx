'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { useState } from 'react';

export function MonitoramentoFiltros() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get('status') || 'todos';
  const qParam = searchParams.get('q') || '';

  const [q, setQ] = useState(qParam);

  const applyFilters = (status: string, query: string) => {
    const params = new URLSearchParams();
    if (status && status !== 'todos') params.set('status', status);
    if (query) params.set('q', query);
    router.push(`/admin/monitoramento-anvisa?${params.toString()}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(statusParam, q);
  };

  const handleStatusChange = (val: string | null) => {
    if (val) applyFilters(val, q);
  };

  const handleClear = () => {
    setQ('');
    router.push('/admin/monitoramento-anvisa');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
    >
      <div className="relative w-full sm:w-64">
        <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Buscar paciente..."
          className="w-full pl-8"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Select value={statusParam} onValueChange={(val) => handleStatusChange(val as string | null)}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os status</SelectItem>
          <SelectItem value="normal">Normal (&gt;90 dias)</SelectItem>
          <SelectItem value="atencao">Atenção (≤90 dias)</SelectItem>
          <SelectItem value="critico">Crítico (≤30 dias)</SelectItem>
          <SelectItem value="expirado">Expirado (&lt;0 dias)</SelectItem>
        </SelectContent>
      </Select>

      {(qParam || statusParam !== 'todos') && (
        <Button
          type="button"
          variant="ghost"
          onClick={handleClear}
          size="icon"
          title="Limpar Filtros"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
}
