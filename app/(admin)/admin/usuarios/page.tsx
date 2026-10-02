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
import { useUser } from '@clerk/nextjs';
import { listarUsuariosAdmin } from '@/app/(admin)/_actions/usuarios';
import { DialogoEditarUsuario } from './_components/dialogo-editar-usuario';
import { DialogoExcluirUsuario } from './_components/dialogo-excluir-usuario';
import { DialogoCriarAdmin } from './_components/dialogo-criar-admin';
import { PageHeader } from '@/components/shared/page-header';
import { PaginationBar } from '@/components/shared/pagination-bar';
import { DataList, DataRow, DataEmpty } from '@/components/shared/data-list';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Loader2,
  Pencil,
  Search,
  Shield,
  ShieldPlus,
  Stethoscope,
  Trash2,
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
  telefone: string | null;
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
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [excluindo, setExcluindo] = useState<Usuario | null>(null);
  const [criandoAdmin, setCriandoAdmin] = useState(false);
  const { user: euMesmo } = useUser();

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
      <PageHeader
        eyebrow="Controle"
        title="Usuários"
        description={`${stats.total} usuários registrados na plataforma`}
        actions={
          <Button onClick={() => setCriandoAdmin(true)}>
            <ShieldPlus size={16} className="mr-1.5" />
            Novo admin
          </Button>
        }
      />

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
        <DataEmpty
          icon={<Users size={24} />}
          title="Nenhum usuário encontrado"
          description={(buscaDebounced || filtroRole) ? 'Tente ajustar os filtros de busca' : undefined}
        />
      ) : (
        <DataList>
          {usuarios.map((user) => {
            const config = ROLE_CONFIG[user.role ?? 'paciente'];
            const Icon = config?.icon ?? User;
            return (
              <DataRow
                key={user.id}
                icon={
                  <div className={`flex h-full w-full items-center justify-center rounded-full ${config?.cor ?? 'bg-muted'}`}>
                    <Icon size={18} />
                  </div>
                }
                title={user.nome}
                subtitle={user.email}
                meta={new Date(user.createdAt).toLocaleDateString('pt-BR')}
                trailing={
                  <>
                    <Badge variant={config?.variant ?? 'outline'}>{config?.label ?? 'Desconhecido'}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Editar usuário"
                      aria-label={`Editar ${user.nome}`}
                      onClick={() => setEditando(user)}
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      title={
                        user.clerkId && user.clerkId === euMesmo?.id
                          ? 'Você não pode apagar a sua própria conta'
                          : 'Apagar conta'
                      }
                      aria-label={`Apagar conta de ${user.nome}`}
                      disabled={!!user.clerkId && user.clerkId === euMesmo?.id}
                      onClick={() => setExcluindo(user)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </>
                }
              />
            );
          })}
        </DataList>
      )}

      {/* Paginação */}
      {totalPaginas > 0 && !carregando && usuarios.length > 0 && (
        <PaginationBar
          page={pagina}
          totalPages={totalPaginas}
          onPageChange={setPagina}
          totalItems={totalFiltrado}
          pageSize={porPagina}
          onPageSizeChange={setPorPagina}
          pageSizeOptions={POR_PAGINA_OPCOES}
        />
      )}

      {editando && (
        <DialogoEditarUsuario
          key={editando.id}
          usuario={editando}
          onFechar={() => setEditando(null)}
          onSalvo={carregar}
        />
      )}
      {criandoAdmin && (
        <DialogoCriarAdmin onFechar={() => setCriandoAdmin(false)} onCriado={carregar} />
      )}
      {excluindo && (
        <DialogoExcluirUsuario
          key={excluindo.id}
          usuario={excluindo}
          onFechar={() => setExcluindo(null)}
          onApagado={() => {
            // Apagou o último da página? Volta uma página em vez de mostrar página vazia.
            if (usuarios.length === 1 && pagina > 1) setPagina(pagina - 1);
            else carregar();
          }}
        />
      )}
    </div>
  );
}
