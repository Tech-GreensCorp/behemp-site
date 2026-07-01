import { notFound } from 'next/navigation';
import Link from 'next/link';
import { obterMedicoDetalhe } from '@/app/_actions/admin-medicos';
import { TabPacientesPaginada } from './tab-pacientes-paginada';
import { FormConfigAgenda } from '@/components/medicos/form-config-agenda';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Calendar,
  FileCheck,
  Mail,
  Phone,
  Route,
  Stethoscope,
  Users,
  Video,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const LABEL_JORNADA: Record<string, string> = {
  acolhimento: 'Acolhimento',
  avaliacao_medica: 'Avaliação Médica',
  burocracia_anvisa: 'Burocracia ANVISA',
  logistica: 'Logística',
  acompanhamento_continuo: 'Acompanhamento Contínuo',
};


const LABEL_STATUS_CONSULTA: Record<string, string> = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
};

const LABEL_STATUS_TRIAGEM: Record<string, string> = {
  pendente: 'Pendente',
  visualizada: 'Visualizada',
  respondida: 'Respondida',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MedicoDetalhePage({ params }: Props) {
  const { id } = await params;
  const res = await obterMedicoDetalhe(id);

  if (!res.sucesso || !res.dados) {
    notFound();
  }

  const { medico, pacientes, triagens, consultas, jornada } = res.dados;
  const totalJornada = jornada.reduce((sum, j) => sum + j.total, 0);

  return (
    <div className="space-y-6">
      {/* Botão voltar */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Voltar ao dashboard
      </Link>

      {/* Header do médico */}
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
          {medico.avatarUrl ? (
            <img
              src={medico.avatarUrl}
              alt={medico.nome}
              className="h-32 w-32 shrink-0 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Stethoscope size={48} className="text-primary/60" />
            </div>
          )}

          <div className="flex-1 space-y-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{medico.nome}</h1>
              <p className="text-sm font-semibold text-primary">{medico.especialidade}</p>
              <p className="mt-1 text-xs text-muted-foreground">{medico.crm}</p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Mail size={14} />
                {medico.email}
              </span>
              {medico.telefone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={14} />
                  {medico.telefone}
                </span>
              )}
              {medico.valorConsulta !== null && (
                <Badge variant="secondary">
                  Consulta: {medico.valorConsulta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Badge>
              )}
            </div>

            {medico.bio && (
              <p className="text-sm leading-relaxed text-muted-foreground">{medico.bio}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <Users size={20} className="text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Pacientes</p>
              <p className="text-xl font-bold">{pacientes.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <FileCheck size={20} className="text-amber-600" />
            <div>
              <p className="text-xs text-muted-foreground">Triagens</p>
              <p className="text-xl font-bold">{triagens.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <Calendar size={20} className="text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Consultas</p>
              <p className="text-xl font-bold">{consultas.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <Route size={20} className="text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">Em jornada</p>
              <p className="text-xl font-bold">{totalJornada}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pacientes" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pacientes">Pacientes</TabsTrigger>
          <TabsTrigger value="triagens">Triagens</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="jornada">Jornada</TabsTrigger>
          <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
        </TabsList>

        {/* Pacientes */}
        <TabsContent value="pacientes" className="mt-4">
          <TabPacientesPaginada medicoId={medico.id} />
        </TabsContent>

        {/* Triagens */}
        <TabsContent value="triagens" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {triagens.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma triagem associada a este médico.
                </p>
              ) : (
                <div className="divide-y divide-border/50">
                  {triagens.map((t) => (
                    <div key={t.triagemId} className="flex items-center justify-between p-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{t.nomeContato ?? 'Sem nome'}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.emailContato ?? t.telefoneContato ?? '—'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(t.criadoEm + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {LABEL_STATUS_TRIAGEM[t.statusVisualizacao] ?? t.statusVisualizacao}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agenda */}
        <TabsContent value="agenda" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {consultas.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma consulta agendada.
                </p>
              ) : (
                <div className="divide-y divide-border/50">
                  {consultas.map((c) => (
                    <div key={c.consultaId} className="flex items-center justify-between p-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.pacienteNome}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.pacienteEmail}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(c.dataHora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.googleMeetLink && (
                          <a
                            href={c.googleMeetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20"
                            title="Abrir Google Meet"
                          >
                            <Video size={14} />
                          </a>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {LABEL_STATUS_CONSULTA[c.status] ?? c.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Jornada */}
        <TabsContent value="jornada" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Distribuição por fase</CardTitle>
            </CardHeader>
            <CardContent>
              {jornada.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sem pacientes para analisar.
                </p>
              ) : (
                <div className="space-y-3">
                  {jornada.map((j) => {
                    const percentual = totalJornada > 0 ? (j.total / totalJornada) * 100 : 0;
                    return (
                      <div key={j.fase}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {LABEL_JORNADA[j.fase] ?? j.fase}
                          </span>
                          <span className="font-semibold">{j.total}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${percentual}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configurações */}
        <TabsContent value="configuracoes" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <FormConfigAgenda medicoId={medico.id} configAtual={medico.configAgenda} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
