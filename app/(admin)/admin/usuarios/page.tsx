'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Loading03Icon,
  UserIcon,
  Stethoscope02Icon,
  SecurityCheckIcon,
  UserMultiple02Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons';
import { listarUsuariosAdmin } from '@/app/(admin)/_actions/usuarios';

/**
 * Página de administração de usuários — dados reais do banco.
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
  icon: typeof UserIcon;
  cor: string;
}> = {
  admin: { label: 'Admin', variant: 'default', icon: SecurityCheckIcon, cor: 'bg-red-500/10 text-red-600' },
  medico: { label: 'Médico', variant: 'secondary', icon: Stethoscope02Icon, cor: 'bg-primary/10 text-primary' },
  paciente: { label: 'Paciente', variant: 'outline', icon: UserIcon, cor: 'bg-emerald-500/10 text-emerald-600' },
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroRole, setFiltroRole] = useState<string | undefined>();
  const [stats, setStats] = useState({ total: 0, admins: 0, medicos: 0, pacientes: 0 });

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarUsuariosAdmin({
      busca: busca || undefined,
      role: filtroRole,
    });
    if (res.sucesso && res.dados) {
      setUsuarios(res.dados.usuarios as Usuario[]);
      setStats({
        total: res.dados.total,
        ...res.dados.porRole,
      });
    }
    setCarregando(false);
  }, [busca, filtroRole]);

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
          { label: 'Total', valor: stats.total, icon: UserMultiple02Icon, cor: 'bg-muted text-foreground' },
          { label: 'Admins', valor: stats.admins, icon: SecurityCheckIcon, cor: 'bg-red-500/10 text-red-600' },
          { label: 'Médicos', valor: stats.medicos, icon: Stethoscope02Icon, cor: 'bg-primary/10 text-primary' },
          { label: 'Pacientes', valor: stats.pacientes, icon: UserIcon, cor: 'bg-emerald-500/10 text-emerald-600' },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kpi.cor}`}>
                <HugeiconsIcon icon={kpi.icon} size={18} />
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
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="pl-9"
          />
        </div>
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
        </div>
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="flex justify-center py-12">
          <HugeiconsIcon icon={Loading03Icon} size={32} className="animate-spin text-primary" />
        </div>
      ) : usuarios.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HugeiconsIcon icon={UserMultiple02Icon} size={40} className="mb-3 text-muted-foreground/40" />
            <p className="text-lg font-medium">Nenhum usuário encontrado</p>
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
                    <HugeiconsIcon icon={config?.icon ?? UserIcon} size={20} />
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
    </div>
  );
}
