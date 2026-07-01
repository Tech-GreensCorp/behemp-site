'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listarPacientesMedicoPaginado } from '@/app/_actions/admin-medicos';
import type { PacienteDoMedico } from '@/app/_actions/admin-medicos';
import {
  ArrowDownAZ,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Tab de pacientes paginada com busca e ordenação.
 * Substitui a listagem estática na página de detalhe do médico.
 */

const LABEL_JORNADA: Record<string, string> = {
  acolhimento: 'Acolhimento',
  avaliacao_medica: 'Avaliação Médica',
  burocracia_anvisa: 'Burocracia ANVISA',
  logistica: 'Logística',
  acompanhamento_continuo: 'Acompanhamento Contínuo',
};

const LABEL_STATUS_PACIENTE: Record<string, string> = {
  aguardando_consulta: 'Aguardando consulta',
  em_tratamento: 'Em tratamento',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
};

type OrdenacaoKey = 'nome-asc' | 'nome-desc' | 'criadoEm-desc' | 'criadoEm-asc';

const ORDENACAO_OPCOES: { value: OrdenacaoKey; label: string }[] = [
  { value: 'criadoEm-desc', label: 'Mais recentes' },
  { value: 'criadoEm-asc', label: 'Mais antigos' },
  { value: 'nome-asc', label: 'Nome (A → Z)' },
  { value: 'nome-desc', label: 'Nome (Z → A)' },
];

const POR_PAGINA_OPCOES = [10, 20, 50];

function parseOrdenacao(key: OrdenacaoKey) {
  const [ordenarPor, direcao] = key.split('-') as ['nome' | 'criadoEm', 'asc' | 'desc'];
  return { ordenarPor, direcao };
}

interface TabPacientesPaginadaProps {
  medicoId: string;
}

export function TabPacientesPaginada({ medicoId }: TabPacientesPaginadaProps) {
  const [pacientes, setPacientes] = useState<PacienteDoMedico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [ordenacao, setOrdenacao] = useState<OrdenacaoKey>('criadoEm-desc');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce da busca
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setBuscaDebounced(busca);
      setPagina(1);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [busca]);

  // Reset de página ao trocar filtros
  useEffect(() => {
    setPagina(1);
  }, [ordenacao, porPagina]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { ordenarPor, direcao } = parseOrdenacao(ordenacao);
    const res = await listarPacientesMedicoPaginado({
      medicoId,
      busca: buscaDebounced || undefined,
      pagina,
      porPagina,
      ordenarPor,
      direcao,
    });
    if (res.sucesso && res.dados) {
      setPacientes(res.dados.pacientes);
      setTotal(res.dados.total);
      setTotalPaginas(res.dados.totalPaginas);
    }
    setCarregando(false);
  }, [medicoId, buscaDebounced, ordenacao, pagina, porPagina]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="space-y-4 p-4">
        {/* Filtros */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Busca */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar paciente por nome..."
              className="pl-9"
            />
          </div>

          {/* Ordenação */}
          <Select
            value={ordenacao}
            onValueChange={(val) => { if (val) setOrdenacao(val as OrdenacaoKey); }}
          >
            <SelectTrigger className="w-full sm:w-48">
              <ArrowDownAZ size={14} className="shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              {ORDENACAO_OPCOES.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lista */}
        {carregando ? (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : pacientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Users size={40} className="mb-3 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">
              {buscaDebounced ? 'Nenhum paciente encontrado' : 'Nenhum paciente atribuído'}
            </p>
            {buscaDebounced && (
              <p className="mt-1 text-sm text-muted-foreground">
                Tente ajustar os filtros de busca
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {pacientes.map((p) => (
              <div key={p.pacienteId} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Desde {format(new Date(p.criadoEm + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {LABEL_STATUS_PACIENTE[p.status] ?? p.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {LABEL_JORNADA[p.jornadaFase] ?? p.jornadaFase}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginação */}
        {totalPaginas > 0 && !carregando && pacientes.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            {/* Info + itens por página */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>
                {total} paciente{total !== 1 ? 's' : ''}
              </span>
              <span className="text-border">·</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">Exibir</span>
                <Select
                  value={String(porPagina)}
                  onValueChange={(val) => { if (val) setPorPagina(Number(val)); }}
                >
                  <SelectTrigger size="sm" className="w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POR_PAGINA_OPCOES.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs">por página</span>
              </div>
            </div>

            {/* Controles de página */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                className="gap-1"
              >
                <ChevronLeft size={14} />
                Anterior
              </Button>
              <span className="min-w-[6rem] text-center text-sm tabular-nums text-muted-foreground">
                Página {pagina} de {totalPaginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                className="gap-1"
              >
                Próximo
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
