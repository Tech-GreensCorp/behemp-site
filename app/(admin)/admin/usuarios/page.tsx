'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listarUsuariosAdmin } from '@/app/(admin)/_actions/usuarios';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Shield,
  Stethoscope,
  User,
  Users,
} from 'lucide-react';

/**
 * Página de administração de usuários — dados reais do banco.
 * Paginação server-side, busca com debounce e ordenação dinâmica.
 */

interface Usuario {
  id: string;
  clerkId: string;
  nome: string;
  email: string;
  role: string | null;
  createdAt: Date;
}

const ROLE_CONFIG: Record<string, {
  label: string;
  variant: 'default' | 'secondary' | 'outline';
  icon: typeof User;
  cor: string;
}> = {
  admin: { label: 'Admin', variant: 'default', icon: Shield, cor: 'bg-red-500/10 text-red-600' },
  medico: { label: 'Médico', variant: 'secondary', icon: Stethoscope, cor: 'bg-primary/10 text-primary' },
  paciente: { label: 'Paciente', variant: 'outline', icon: User, cor: 'bg-emerald-500/10 text-emerald-600' },
};

type OrdenacaoKey = 'nome-asc' | 'nome-desc' | 'email-asc' | 'email-desc' | 'createdAt-desc' | 'createdAt-asc';

const ORDENACAO_OPCOES: { value: OrdenacaoKey; label: string }[] = [
  { value: 'createdAt-desc', label: 'Mais recentes' },
  { value: 'createdAt-asc', label: 'Mais antigos' },
  { value: 'nome-asc', label: 'Nome (A → Z)' },
  { value: 'nome-desc', label: 'Nome (Z → A)' },
  { value: 'email-asc', label: 'E-mail (A → Z)' },
  { value: 'email-desc', label: 'E-mail (Z → A)' },
];

const POR_PAGINA_OPCOES = [10, 20, 50];

function parseOrdenacao(key: OrdenacaoKey) {
  const [ordenarPor, direcao] = key.split('-') as ['nome' | 'email' | 'createdAt', 'asc' | 'desc'];
  return { ordenarPor, direcao };
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [filtroRole, setFiltroRole] = useState<string | undefined>();
  const [ordenacao, setOrdenacao] = useState<OrdenacaoKey>('createdAt-desc');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const [totalFiltrado, setTotalFiltrado] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [stats, setStats] = useState({ total: 0, admins: 0, medicos: 0, pacientes: 0 });

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
  }, [filtroRole, ordenacao, porPagina]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { ordenarPor, direcao } = parseOrdenacao(ordenacao);
    const res = await listarUsuariosAdmin({
      busca: buscaDebounced || undefined,
      role: filtroRole,
      pagina,
      porPagina,
      ordenarPor,
      direcao,
    });
    if (res.sucesso && res.dados) {
      setUsuarios(res.dados.usuarios as Usuario[]);
      setTotalFiltrado(res.dados.totalFiltrado);
      setTotalPaginas(res.dados.totalPaginas);
      setStats({
        total: res.dados.total,
        ...res.dados.porRole,
      });
    }
    setCarregando(false);
  }, [buscaDebounced, filtroRole, ordenacao, pagina, porPagina]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          {stats.total} usuários registrados na plataforma
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Total', valor: stats.total, icon: Users, cor: 'bg-muted text-foreground' },
          { label: 'Admins', valor: stats.admins, icon: Shield, cor: 'bg-red-500/10 text-red-600' },
          { label: 'Médicos', valor: stats.medicos, icon: Stethoscope, cor: 'bg-primary/10 text-primary' },
          { label: 'Pacientes', valor: stats.pacientes, icon: User, cor: 'bg-emerald-500/10 text-emerald-600' },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kpi.cor}`}>
                {(() => { const DynIcon = kpi.icon; return <DynIcon size={18} />; })()}
              </div>
              <div>
                <p className="text-2xl font-bold">{kpi.valor}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Busca */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
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

      {/* Filtros de role */}
      <div className="flex gap-2">
        {['admin', 'medico', 'paciente'].map((role) => (
          <Button
            key={role}
            variant={filtroRole === role ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltroRole(filtroRole === role ? undefined : role)}
          >
            {ROLE_CONFIG[role].label}
          </Button>
        ))}
        {filtroRole && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFiltroRole(undefined)}
            className="text-muted-foreground"
          >
            Limpar
          </Button>
        )}
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : usuarios.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users size={40} className="mb-3 text-muted-foreground/40" />
            <p className="text-lg font-medium">Nenhum usuário encontrado</p>
            {(buscaDebounced || filtroRole) && (
              <p className="mt-1 text-sm text-muted-foreground">
                Tente ajustar os filtros de busca
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {usuarios.map((user) => {
            const config = ROLE_CONFIG[user.role ?? 'paciente'];
            return (
              <Card key={user.id} className="border-0 shadow-sm transition-all hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${config?.cor ?? 'bg-muted'}`}>
                    {(() => { const DynIcon = config?.icon ?? User; return <DynIcon size={20} />; })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{user.nome}</p>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <Badge variant={config?.variant ?? 'outline'}>
                    {config?.label ?? 'Desconhecido'}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Paginação */}
      {totalPaginas > 0 && !carregando && usuarios.length > 0 && (
        <div className="flex flex-col items-center gap-4 pt-2 sm:flex-row sm:justify-between">
          {/* Info + itens por página */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {totalFiltrado} resultado{totalFiltrado !== 1 ? 's' : ''}
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
    </div>
  );
}
