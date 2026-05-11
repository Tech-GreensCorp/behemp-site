import { obterKpisAdmin, obterAtividadeRecente } from '@/app/_actions/admin';
import { listarTriagens } from '@/app/(public)/_actions/triagem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  Clock,
  FileCheck,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Dashboard administrativo — Server Component com dados reais do banco.
 */
export default async function AdminDashboardPage() {
  const [kpisResult, atividadeResult, triagensResult] = await Promise.all([
    obterKpisAdmin(),
    obterAtividadeRecente(),
    listarTriagens(),
  ]);

  const kpis = kpisResult.dados;
  const atividades = atividadeResult.dados ?? [];
  const triagens = triagensResult.dados ?? [];
  const triagensPendentes = triagens.filter((t) => t.statusVisualizacao === 'pendente');

  const cards: { label: string; valor: number; icon: LucideIcon; cor: string; urgente?: boolean }[] = [
    {
      label: 'Total de Usuários',
      valor: kpis?.totalUsuarios ?? 0,
      icon: Users,
      cor: 'bg-primary/10 text-primary',
    },
    {
      label: 'Médicos Ativos',
      valor: kpis?.totalMedicos ?? 0,
      icon: Stethoscope,
      cor: 'bg-violet-500/10 text-violet-600',
    },
    {
      label: 'Triagens Pendentes',
      valor: kpis?.triagensPendentes ?? 0,
      icon: FileCheck,
      cor: 'bg-amber-500/10 text-amber-600',
      urgente: (kpis?.triagensPendentes ?? 0) > 0,
    },
    {
      label: 'Pacientes no Sistema',
      valor: kpis?.totalPacientes ?? 0,
      icon: ShieldCheck,
      cor: 'bg-emerald-500/10 text-emerald-600',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Visão Geral</h1>
          <p className="mt-1 text-muted-foreground">
            Painel administrativo da plataforma Be4Hope
          </p>
        </div>
        <form action="/admin">
          <Button variant="outline" size="sm" className="gap-2" type="submit">
            <RefreshCw size={14} />
            Atualizar
          </Button>
        </form>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
          <Card
            key={card.label}
            className={`border-0 shadow-sm ${card.urgente ? 'ring-1 ring-amber-400/40' : ''}`}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.cor}`}>
                <Icon size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-bold">{card.valor}</p>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Distribuição por Role */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                label: 'Administradores',
                valor: kpis?.porRole.admins ?? 0,
                cor: 'bg-primary',
                total: kpis?.totalUsuarios ?? 1,
              },
              {
                label: 'Médicos',
                valor: kpis?.porRole.medicos ?? 0,
                cor: 'bg-violet-500',
                total: kpis?.totalUsuarios ?? 1,
              },
              {
                label: 'Pacientes',
                valor: kpis?.porRole.pacientes ?? 0,
                cor: 'bg-emerald-500',
                total: kpis?.totalUsuarios ?? 1,
              },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-semibold">{item.valor}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${item.cor}`}
                    style={{
                      width: item.total > 0 ? `${(item.valor / item.total) * 100}%` : '0%',
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Atividade Recente — triagens */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Triagens Recentes</CardTitle>
            <Link href="/admin/triagens">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                Ver todas →
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {triagensPendentes.length === 0 && atividades.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade recente.</p>
            ) : (
              <>
                {triagensPendentes.slice(0, 4).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                    <span className="flex-1 truncate text-muted-foreground">
                      Nova triagem — {t.nomeContato || 'Sem nome'}
                    </span>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      Pendente
                    </Badge>
                  </div>
                ))}
                {atividades.slice(0, 4 - triagensPendentes.slice(0, 4).length).map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div
                      className={`h-2 w-2 shrink-0 rounded-full ${a.urgente ? 'bg-amber-500' : 'bg-primary'}`}
                    />
                    <span className="flex-1 truncate text-muted-foreground">{a.descricao}</span>
                    <CheckCircle2 size={14} className="shrink-0 text-muted-foreground" />
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumo rápido de status das triagens */}
      {triagens.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Status das Triagens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: 'Pendentes', valor: triagens.filter((t) => t.statusVisualizacao === 'pendente').length, cor: 'text-amber-600' },
                { label: 'Visualizadas', valor: triagens.filter((t) => t.statusVisualizacao === 'visualizada').length, cor: 'text-blue-600' },
                { label: 'Respondidas', valor: triagens.filter((t) => t.statusVisualizacao === 'respondida').length, cor: 'text-emerald-600' },
              ].map((item) => (
                <div key={item.label}>
                  <p className={`text-3xl font-bold ${item.cor}`}>{item.valor}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
