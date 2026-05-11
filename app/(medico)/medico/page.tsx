import { obterKpisMedico, listarPacientes, obterDadosGraficosDashboard } from '@/app/_actions/pacientes';
import { obterDadosUsuario } from '@/lib/auth';
import { DashboardCharts } from '@/components/medico/dashboard-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Pill,
  Stethoscope,
  UserPlus,
  Users,
} from 'lucide-react';

/**
 * Dashboard do médico — Server Component com dados reais do banco.
 * KPIs carregados diretamente das Server Actions.
 */
export default async function MedicoDashboardPage() {
  const [usuarioResult, kpisResult, pacientesResult, graficosResult] = await Promise.all([
    obterDadosUsuario(),
    obterKpisMedico(),
    listarPacientes({ status: 'todos' }),
    obterDadosGraficosDashboard(),
  ]);

  const usuario = usuarioResult;
  const kpis = kpisResult.dados;
  const pacientes = (pacientesResult.dados ?? []).slice(0, 5); // Últimos 5
  const graficos = graficosResult.sucesso ? graficosResult.dados : null;

  const primeiroNome = usuario?.nome?.split(' ')[0] ?? 'Doutor(a)';

  const cards = [
    {
      label: 'Total de Pacientes',
      valor: kpis?.totalPacientes ?? 0,
      icon: Users,
      cor: 'bg-primary/10 text-primary',
    },
    {
      label: 'Aguardando Consulta',
      valor: kpis?.aguardandoConsulta ?? 0,
      icon: Clock,
      cor: 'bg-amber-500/10 text-amber-600',
    },
    {
      label: 'Em Tratamento',
      valor: kpis?.emTratamento ?? 0,
      icon: Pill,
      cor: 'bg-violet-500/10 text-violet-600',
    },
    {
      label: 'Concluídos',
      valor: kpis?.concluidos ?? 0,
      icon: CheckCircle2,
      cor: 'bg-emerald-500/10 text-emerald-600',
    },
  ];

  const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    aguardando_consulta: { label: 'Aguardando', variant: 'secondary' },
    em_tratamento: { label: 'Em tratamento', variant: 'default' },
    concluido: { label: 'Concluído', variant: 'outline' },
    arquivado: { label: 'Arquivado', variant: 'destructive' },
  };

  const TRATAMENTO_LABEL: Record<string, string> = {
    cbd: 'CBD',
    thc: 'THC',
    cbd_thc: 'CBD + THC',
  };

  return (
    <div className="space-y-8">
      {/* Header com saudação */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Olá, {primeiroNome} 👋
          </h1>
          <p className="mt-1 text-muted-foreground">
            Visão geral dos seus pacientes e tratamentos
          </p>
        </div>
        <Link href="/medico/pacientes/novo">
          <Button className="gap-2">
            <UserPlus size={16} />
            Novo paciente
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.cor}`}>
                {(() => { const DynIcon = card.icon; return <DynIcon size={24} />; })()}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-bold">{card.valor}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráficos do Dashboard */}
      <DashboardCharts dados={graficos ?? undefined} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pacientes recentes */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pacientes Recentes</CardTitle>
            <Link href="/medico/pacientes">
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                Ver todos
                <ChevronRight size={14} />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {pacientes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Users size={28} className="text-muted-foreground" />
                </div>
                <p className="font-medium">Nenhum paciente ainda</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Comece cadastrando seu primeiro paciente
                </p>
                <Link href="/medico/pacientes/novo" className="mt-4">
                  <Button size="sm" className="gap-2">
                    <UserPlus size={14} />
                    Cadastrar paciente
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {pacientes.map((paciente) => {
                  const statusConfig = STATUS_CONFIG[paciente.status] ?? STATUS_CONFIG.aguardando_consulta;
                  return (
                    <Link
                      key={paciente.id}
                      href={`/medico/pacientes/${paciente.id}`}
                      className="flex items-center gap-4 py-3 transition-colors hover:text-primary"
                    >
                      {/* Avatar inicial */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {paciente.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{paciente.nome}</p>
                        <p className="text-xs text-muted-foreground">{paciente.email}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {paciente.tratamentoTipo && (
                          <span className="hidden text-xs text-muted-foreground sm:block">
                            {TRATAMENTO_LABEL[paciente.tratamentoTipo] ?? paciente.tratamentoTipo}
                          </span>
                        )}
                        <Badge variant={statusConfig.variant} className="text-xs">
                          {statusConfig.label}
                        </Badge>
                      </div>
                      <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Perfil do médico */}
      {usuario && (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary/10">
              {usuario.avatarUrl ? (
                <img src={usuario.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <Stethoscope size={28} className="text-primary" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold">{usuario.nome}</p>
              <p className="text-sm text-muted-foreground">{usuario.email}</p>
            </div>
            <Link href="/medico/configuracoes">
              <Button variant="outline" size="sm">
                Editar perfil
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
