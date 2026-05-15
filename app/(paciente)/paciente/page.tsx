'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Pill,
  FileText,
  Calendar,
  Stethoscope,
  MessageCircle,
  CheckCircle2,
  Clock,
  Route,
  ShieldCheck,
  Droplets,
  HeartPulse,
  BookOpen,
  ChevronRight,
  Loader2,
  UserX,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { obterDadosDashboard, type DadosDashboard } from '@/app/_actions/dashboard-paciente';

// ── Dicas de saúde (conteúdo estático informativo) ───────────

const DICAS = [
  {
    icone: Droplets,
    titulo: 'Hidratação',
    texto: 'Beba pelo menos 2L de água por dia para potencializar o efeito do medicamento.',
    cor: 'text-sky-500',
    bg: 'bg-sky-500/10',
  },
  {
    icone: Clock,
    titulo: 'Horário fixo',
    texto: 'Tome seu medicamento sempre no mesmo horário para manter níveis estáveis.',
    cor: 'text-violet-500',
    bg: 'bg-violet-500/10',
  },
  {
    icone: BookOpen,
    titulo: 'Registre seu progresso',
    texto: 'Anote sintomas e melhorias diariamente para compartilhar com seu médico.',
    cor: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
];

// ── Legendas humanas para enums de jornada/status ────────────

const LABEL_JORNADA: Record<string, string> = {
  acolhimento: 'Acolhimento',
  avaliacao_medica: 'Avaliação Médica',
  burocracia_anvisa: 'Burocracia ANVISA',
  logistica: 'Logística',
  acompanhamento_continuo: 'Acompanhamento Contínuo',
};

const LABEL_STATUS: Record<string, string> = {
  aguardando_consulta: 'Aguardando consulta',
  em_tratamento: 'Em tratamento',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
};

const LABEL_TIPO_CANABINOIDE: Record<string, string> = {
  cbd: 'CBD',
  thc: 'THC',
  cbd_thc: 'CBD + THC',
  full_spectrum: 'Full Spectrum',
  isolado: 'Isolado',
};

function formatarTipoCanabinoide(tipo: string): string {
  return LABEL_TIPO_CANABINOIDE[tipo] ?? tipo.toUpperCase();
}

export default function PacienteDashboardPage() {
  const { user } = useUser();
  const primeiroNome = user?.firstName ?? user?.username ?? 'Paciente';

  const [dados, setDados] = useState<DadosDashboard | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await obterDadosDashboard();
    if (res.sucesso && res.dados) setDados(res.dados);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Próximos passos dinâmicos baseados em dados reais ───────
  const proximosPassos = dados ? [
    !dados.proximaConsulta && !dados.medicamentoAtivo
      ? {
          id: 1,
          titulo: 'Agendar primeira consulta',
          descricao: 'Você ainda não tem consulta marcada',
          href: '/agendamento',
          urgente: true,
        }
      : null,
    dados.totalDocumentos === 0
      ? {
          id: 2,
          titulo: 'Enviar documentos',
          descricao: 'Nenhum documento cadastrado ainda',
          href: '/paciente/documentos',
          urgente: true,
        }
      : null,
    !dados.medicoNome
      ? {
          id: 3,
          titulo: 'Aguardando médico',
          descricao: 'Nenhum médico responsável atribuído ainda',
          href: '/paciente/chat',
          urgente: false,
        }
      : null,
    dados.mensagensNaoLidas > 0
      ? {
          id: 4,
          titulo: 'Mensagens não lidas',
          descricao: `${dados.mensagensNaoLidas} ${dados.mensagensNaoLidas === 1 ? 'mensagem aguarda' : 'mensagens aguardam'} sua resposta`,
          href: '/paciente/chat',
          urgente: false,
        }
      : null,
  ].filter(Boolean) : [];

  const med = dados?.medicamentoAtivo;
  const consulta = dados?.proximaConsulta;
  const jornadaLabel = dados ? (LABEL_JORNADA[dados.jornada.fase] ?? dados.jornada.fase) : '';
  const statusLabel = dados ? (LABEL_STATUS[dados.jornada.status] ?? dados.jornada.status) : '';

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          {carregando ? 'Carregando...' : `Olá, ${primeiroNome}! 👋`}
        </h1>
        <p className="mt-1 text-muted-foreground">Aqui está o resumo do seu tratamento</p>
      </div>

      {carregando ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* ── KPIs principais ─────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {/* Médico */}
            <Card className="border-border/40 shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Stethoscope className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Médico responsável</p>
                  <p className="truncate text-sm font-medium">
                    {dados?.medicoNome ?? (
                      <span className="text-muted-foreground italic">Não atribuído</span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Medicamento */}
            <Card className="border-border/40 shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                  <Pill className="h-5 w-5 text-violet-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Medicamento</p>
                  <p className="truncate text-sm font-medium">
                    {med ? formatarTipoCanabinoide(med.tipoCanabinoide) : (
                      <span className="text-muted-foreground italic">Nenhum prescrito</span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Documentos */}
            <Card className="border-border/40 shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                  <FileText className="h-5 w-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Documentos</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{dados?.totalDocumentos ?? 0} enviado{dados?.totalDocumentos !== 1 ? 's' : ''}</p>
                    {dados?.totalDocumentos === 0 && (
                      <Badge variant="secondary" className="h-5 text-[10px]">⚠</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mensagens */}
            <Card className="border-border/40 shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                  <MessageCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Mensagens</p>
                  <p className="text-sm font-medium">
                    {dados?.mensagensNaoLidas
                      ? `${dados.mensagensNaoLidas} não lida${dados.mensagensNaoLidas > 1 ? 's' : ''}`
                      : 'Em dia'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Grid: Medicamento + Próxima consulta ────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Medicamento atual */}
            <Card className="border-border/40 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Pill className="h-5 w-5 text-primary" />
                  Medicamento Atual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!med ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                      <Pill className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium">Nenhum medicamento prescrito</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Seu médico irá configurar sua dosagem em breve.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-lg font-semibold">{formatarTipoCanabinoide(med.tipoCanabinoide)}</p>
                      <p className="text-sm text-muted-foreground">{med.novaDosagem} — {med.frequencia}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {med.concentracaoTHC && (
                        <div className="rounded-xl bg-muted/50 px-3 py-2">
                          <p className="text-muted-foreground">Concentração THC</p>
                          <p className="font-semibold">{med.concentracaoTHC}</p>
                        </div>
                      )}
                      {med.concentracaoCBD && (
                        <div className="rounded-xl bg-muted/50 px-3 py-2">
                          <p className="text-muted-foreground">Concentração CBD</p>
                          <p className="font-semibold">{med.concentracaoCBD}</p>
                        </div>
                      )}
                      {med.viaAdministracao && (
                        <div className="rounded-xl bg-muted/50 px-3 py-2">
                          <p className="text-muted-foreground">Via</p>
                          <p className="font-semibold">{med.viaAdministracao}</p>
                        </div>
                      )}
                      <div className="rounded-xl bg-muted/50 px-3 py-2">
                        <p className="text-muted-foreground">Último ajuste</p>
                        <p className="font-semibold">
                          {format(new Date(med.dataAjuste + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>

                    {med.proximaRevisao && (
                      <div className="rounded-xl bg-primary/5 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium text-primary">Próxima revisão</span>
                          </div>
                          <span className="text-sm font-bold text-primary">
                            {format(new Date(med.proximaRevisao + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    )}

                    <Link
                      href="/paciente/medicamentos"
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      Ver todos meus medicamentos
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Próxima consulta */}
            <Card className="border-border/40 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-5 w-5 text-primary" />
                  Próxima Consulta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!consulta ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                      <Calendar className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium">Nenhuma consulta agendada</p>
                    <Link
                      href="/agendamento"
                      className="mt-3 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      Agendar agora
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-lg font-semibold capitalize">
                        {format(new Date(consulta.dataHora), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        às {format(new Date(consulta.dataHora), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>

                    <div className="rounded-xl bg-muted/50 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Stethoscope className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">com</span>
                        <span className="font-medium">{consulta.medicoNome}</span>
                      </div>
                    </div>

                    {consulta.meetLink ? (
                      <a
                        href={consulta.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        <Video className="h-4 w-4" />
                        Acessar Google Meet
                      </a>
                    ) : (
                      <Badge variant="secondary" className="w-full justify-center py-1.5">
                        Link do Meet em breve
                      </Badge>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Grid: Jornada + Próximos passos ─────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Jornada / Status */}
            <Card className="border-border/40 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Route className="h-5 w-5 text-primary" />
                  Sua Jornada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl bg-primary/5 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Fase atual</p>
                  <p className="mt-1 text-lg font-bold text-primary">{jornadaLabel}</p>
                </div>

                <div className="rounded-xl bg-muted/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="mt-1 text-sm font-semibold">{statusLabel}</p>
                </div>

                {dados?.medicoNome ? (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      Seu tratamento está sendo acompanhado por {dados.medicoNome}.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <UserX className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Nenhum médico responsável atribuído ainda. Entre em contato com a equipe.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Próximos passos */}
            <Card className="border-border/40 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Próximos Passos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {proximosPassos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500/40" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      Tudo em dia!
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nenhuma ação pendente no momento.
                    </p>
                  </div>
                ) : (
                  proximosPassos.map((passo, i) => (
                    <Link
                      key={passo!.id}
                      href={passo!.href}
                      className="flex items-start gap-3 rounded-xl border border-border/60 p-4 transition-colors hover:bg-accent/50"
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          passo!.urgente
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{passo!.titulo}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{passo!.descricao}</p>
                      </div>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Dicas de saúde ─────────────────────────────────── */}
          <Card className="border-border/40 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HeartPulse className="h-5 w-5 text-primary" />
                Dicas para o seu Tratamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                {DICAS.map((dica, index) => {
                  const Icon = dica.icone;
                  return (
                    <div key={index} className="flex gap-3">
                      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', dica.bg)}>
                        <Icon className={cn('h-4 w-4', dica.cor)} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{dica.titulo}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{dica.texto}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
