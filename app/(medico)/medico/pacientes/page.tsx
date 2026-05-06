'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Search01Icon,
  UserAdd01Icon,
  UserIcon,
  ArrowRight01Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';
import { listarPacientes } from '@/app/_actions/pacientes';

// ── Configurações de display ───────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  em_tratamento: { label: 'Em tratamento', variant: 'default' },
  aguardando_consulta: { label: 'Aguardando consulta', variant: 'secondary' },
  concluido: { label: 'Concluído', variant: 'outline' },
  arquivado: { label: 'Arquivado', variant: 'destructive' },
};

const TRATAMENTO_LABELS: Record<string, string> = {
  cbd: 'CBD',
  thc: 'THC',
  cbd_thc: 'CBD + THC',
};

interface Paciente {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  status: string;
  tratamentoTipo: string | null;
  createdAt: Date;
}

export default function PacientesPage() {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTratamento, setFiltroTratamento] = useState('todos');
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregarPacientes = useCallback(async () => {
    setCarregando(true);
    const resultado = await listarPacientes({
      busca: busca || undefined,
      status: filtroStatus,
      tratamento: filtroTratamento,
    });
    if (resultado.sucesso && resultado.dados) {
      setPacientes(resultado.dados);
    }
    setCarregando(false);
  }, [busca, filtroStatus, filtroTratamento]);

  // Debounce na busca
  useEffect(() => {
    const timer = setTimeout(() => {
      carregarPacientes();
    }, 300);
    return () => clearTimeout(timer);
  }, [carregarPacientes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-sm text-muted-foreground">
            {carregando ? 'Carregando...' : `${pacientes.length} paciente${pacientes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link href="/medico/pacientes/novo">
          <Button className="gap-2" nativeButton={false}>
            <HugeiconsIcon icon={UserAdd01Icon} size={16} />
            Novo paciente
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
          <div className="relative flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              size={16}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Buscar por nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v ?? 'todos')}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="em_tratamento">Em tratamento</SelectItem>
              <SelectItem value="aguardando_consulta">Aguardando consulta</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroTratamento} onValueChange={(v) => setFiltroTratamento(v ?? 'todos')}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Tratamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="cbd">CBD</SelectItem>
              <SelectItem value="thc">THC</SelectItem>
              <SelectItem value="cbd_thc">CBD + THC</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Lista */}
      {carregando ? (
        <div className="flex items-center justify-center py-16">
          <HugeiconsIcon icon={Loading03Icon} size={32} className="animate-spin text-primary" />
        </div>
      ) : pacientes.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HugeiconsIcon icon={UserIcon} size={48} className="mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium">Nenhum paciente encontrado</p>
            <p className="text-sm text-muted-foreground">
              {busca || filtroStatus !== 'todos' || filtroTratamento !== 'todos'
                ? 'Tente ajustar os filtros'
                : 'Comece cadastrando seu primeiro paciente'}
            </p>
            {!busca && filtroStatus === 'todos' && filtroTratamento === 'todos' && (
              <Link href="/medico/pacientes/novo" className="mt-4">
                <Button size="sm" className="gap-2" nativeButton={false}>
                  <HugeiconsIcon icon={UserAdd01Icon} size={14} />
                  Cadastrar paciente
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pacientes.map((paciente) => {
            const statusConfig = STATUS_LABELS[paciente.status] ?? STATUS_LABELS.aguardando_consulta;
            return (
              <Link key={paciente.id} href={`/medico/pacientes/${paciente.id}`}>
                <Card className="group border-0 shadow-sm transition-all hover:shadow-md">
                  <CardContent className="flex items-center gap-4 p-4">
                    {/* Inicial */}
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {paciente.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{paciente.nome}</p>
                      <p className="truncate text-sm text-muted-foreground">{paciente.email}</p>
                    </div>
                    <div className="hidden items-center gap-2 sm:flex">
                      {paciente.tratamentoTipo && (
                        <Badge variant="outline" className="text-xs">
                          {TRATAMENTO_LABELS[paciente.tratamentoTipo] ?? paciente.tratamentoTipo}
                        </Badge>
                      )}
                      <Badge variant={statusConfig.variant} className="text-xs">
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      size={16}
                      className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
                    />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
