'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent } from '@/components/ui/card';
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
    cor: 'text-sky-600',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
  },
  {
    icone: Clock,
    titulo: 'Horário fixo',
    texto: 'Tome seu medicamento sempre no mesmo horário para manter níveis estáveis.',
    cor: 'text-violet-600',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  {
    icone: BookOpen,
    titulo: 'Registre seu progresso',
    texto: 'Anote sintomas e melhorias diariamente para compartilhar com seu médico.',
    cor: 'text-emerald-600',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
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
    <div className="space-y-6 sm:space-y-10">
      {/* ── Header Editorial ── */}
      <div className="animate-fade-up">
        <p className="text-primary mb-2 sm:mb-4 text-xs font-semibold tracking-[0.25em] uppercase">
          Área do Paciente
        </p>
        <h1 className="font-display text-3xl leading-[1.1] font-bold tracking-tight sm:text-5xl text-foreground">
          {carregando ? 'Carregando...' : (
            <>Olá, <span>{primeiroNome}</span></>
          )}
        </h1>
        <p className="text-muted-foreground mt-2 sm:mt-4 max-w-2xl text-sm sm:text-base leading-relaxed">
          Acompanhe suas consultas, medicamentos e documentos.
        </p>
      </div>

      {carregando ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* ── KPIs principais ── */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 animate-fade-up delay-75">
            {[
              {
                label: 'Médico',
                valor: dados?.medicoNome ?? 'Não atribuído',
                vazio: !dados?.medicoNome,
                icone: Stethoscope,
                cor: 'text-primary',
                bg: 'bg-primary/10',
              },
              {
                label: 'Medicamento',
                valor: med ? formatarTipoCanabinoide(med.tipoCanabinoide) : 'Nenhum prescrito',
                vazio: !med,
                icone: Pill,
                cor: 'text-violet-600',
                bg: 'bg-violet-500/10',
              },
              {
                label: 'Documentos',
                valor: `${dados?.totalDocumentos ?? 0} enviado${dados?.totalDocumentos !== 1 ? 's' : ''}`,
                vazio: dados?.totalDocumentos === 0,
                icone: FileText,
                cor: 'text-amber-600',
                bg: 'bg-amber-500/10',
              },
              {
                label: 'Mensagens',
                valor: dados?.mensagensNaoLidas
                  ? `${dados.mensagensNaoLidas} não lida${dados.mensagensNaoLidas > 1 ? 's' : ''}`
                  : 'Em dia',
                vazio: false,
                icone: MessageCircle,
                cor: 'text-emerald-600',
                bg: 'bg-emerald-500/10',
              },
            ].map((kpi) => {
              const Icon = kpi.icone;
              return (
                <Card key={kpi.label} className="border border-border/20 bg-white shadow-sm rounded-2xl grain overflow-hidden">
                  <CardContent className="flex items-center gap-3 p-3 sm:p-4">
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', kpi.bg)}>
                      <Icon className={cn('h-4 w-4', kpi.cor)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs text-muted-foreground/60 font-bold uppercase tracking-wider">{kpi.label}</p>
                      <p className={cn('truncate text-sm font-semibold mt-0.5', kpi.vazio && 'text-muted-foreground italic')}>
                        {kpi.valor}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ── Próximos passos (PRIORIDADE 1) ─────────────────── */}
          {proximosPassos.length > 0 && (
            <div className="animate-fade-up delay-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10">
                  <CheckCircle2 className="h-4 w-4 text-amber-600" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">Próximos Passos</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {proximosPassos.map((passo, i) => (
                  <Link
                    key={passo!.id}
                    href={passo!.href}
                    className={cn(
                      "group flex items-start gap-3 sm:gap-4 rounded-2xl sm:rounded-3xl border p-4 sm:p-5 transition-all hover:shadow-md bg-white grain cursor-pointer",
                      passo!.urgente ? "border-amber-500/30 hover:border-amber-500/50" : "border-border/20 hover:border-primary/30"
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold',
                        passo!.urgente
                          ? 'bg-amber-500/10 text-amber-600'
                          : 'bg-primary/10 text-primary',
                      )}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-tight text-foreground">{passo!.titulo}</p>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{passo!.descricao}</p>
                    </div>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Grid: Próxima consulta + Medicamento ────────────── */}
          <div className="grid gap-6 lg:grid-cols-2 animate-fade-up delay-150">

            {/* Próxima consulta (PRIORIDADE 2) */}
            <Card className="border border-border/20 bg-white shadow-sm rounded-2xl sm:rounded-3xl grain overflow-hidden">
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="font-display text-lg font-bold text-foreground">Próxima Consulta</h2>
                </div>

                {!consulta ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
                      <Calendar className="h-7 w-7 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm font-bold text-foreground">Nenhuma consulta agendada</p>
                    <Link
                      href="/agendamento"
                      className="mt-3 flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                    >
                      Agendar agora
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl bg-primary/5 border border-primary/10 p-4">
                      <p className="text-lg font-bold text-foreground capitalize">
                        {format(new Date(consulta.dataHora), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        às {format(new Date(consulta.dataHora), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl bg-muted/30 border border-border/10 px-4 py-3">
                      <Stethoscope className="h-4 w-4 text-muted-foreground/60" />
                      <span className="text-sm text-muted-foreground">com</span>
                      <span className="text-sm font-bold text-foreground">{consulta.medicoNome}</span>
                    </div>

                    {consulta.meetLink ? (
                      <a
                        href={consulta.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 shadow-md"
                      >
                        <Video className="h-4 w-4" />
                        Acessar Google Meet
                      </a>
                    ) : (
                      <Badge variant="secondary" className="w-full justify-center py-2 rounded-2xl text-xs font-bold">
                        Link do Meet em breve
                      </Badge>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Medicamento atual (PRIORIDADE 3) */}
            <Card className="border border-border/20 bg-white shadow-sm rounded-2xl sm:rounded-3xl grain overflow-hidden">
              <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10">
                    <Pill className="h-5 w-5 text-violet-600" />
                  </div>
                  <h2 className="font-display text-lg font-bold text-foreground">Medicamento Atual</h2>
                </div>

                {!med ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
                      <Pill className="h-7 w-7 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm font-bold text-foreground">Nenhum medicamento prescrito</p>
                    <p className="mt-1.5 text-xs text-muted-foreground max-w-xs">
                      Seu médico irá configurar sua dosagem em breve.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-xl font-bold text-foreground">{formatarTipoCanabinoide(med.tipoCanabinoide)}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{med.novaDosagem} — {med.frequencia}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {med.concentracaoTHC && (
                        <div className="rounded-2xl bg-muted/30 border border-border/10 px-4 py-3">
                          <p className="text-muted-foreground/60 font-bold uppercase tracking-wider text-[10px]">THC</p>
                          <p className="font-bold text-foreground mt-0.5">{med.concentracaoTHC}</p>
                        </div>
                      )}
                      {med.concentracaoCBD && (
                        <div className="rounded-2xl bg-muted/30 border border-border/10 px-4 py-3">
                          <p className="text-muted-foreground/60 font-bold uppercase tracking-wider text-[10px]">CBD</p>
                          <p className="font-bold text-foreground mt-0.5">{med.concentracaoCBD}</p>
                        </div>
                      )}
                      {med.viaAdministracao && (
                        <div className="rounded-2xl bg-muted/30 border border-border/10 px-4 py-3">
                          <p className="text-muted-foreground/60 font-bold uppercase tracking-wider text-[10px]">Via</p>
                          <p className="font-bold text-foreground mt-0.5">{med.viaAdministracao}</p>
                        </div>
                      )}
                      <div className="rounded-2xl bg-muted/30 border border-border/10 px-4 py-3">
                        <p className="text-muted-foreground/60 font-bold uppercase tracking-wider text-[10px]">Último ajuste</p>
                        <p className="font-bold text-foreground mt-0.5">
                          {format(new Date(med.dataAjuste + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>

                    {med.proximaRevisao && (
                      <div className="rounded-2xl bg-primary/5 border border-primary/10 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            <span className="text-sm font-bold text-primary">Próxima revisão</span>
                          </div>
                          <span className="text-sm font-bold text-primary">
                            {format(new Date(med.proximaRevisao + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    )}

                    <Link
                      href="/paciente/medicamentos"
                      className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-bold text-primary transition-all hover:bg-primary/10 hover:border-primary/30"
                    >
                      Ver todos meus medicamentos
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Jornada / Status (PRIORIDADE 4) ───────────────── */}
          <Card className="border border-border/20 bg-white shadow-sm rounded-2xl sm:rounded-3xl grain overflow-hidden animate-fade-up delay-200">
            <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                  <Route className="h-5 w-5 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">Sua Jornada</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-primary/5 border border-primary/10 p-4">
                  <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider">Fase atual</p>
                  <p className="mt-1.5 text-lg font-bold text-primary">{jornadaLabel}</p>
                </div>

                <div className="rounded-2xl bg-muted/30 border border-border/10 p-4">
                  <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider">Status</p>
                  <p className="mt-1.5 text-lg font-bold text-foreground">{statusLabel}</p>
                </div>
              </div>

              {dados?.medicoNome ? (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 leading-relaxed">
                    Seu tratamento está sendo acompanhado por <strong>{dados.medicoNome}</strong>.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <UserX className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                    Nenhum médico responsável atribuído ainda. Entre em contato com a equipe.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Dicas para o Tratamento ── */}
          <Card className="border border-border/20 bg-white shadow-sm rounded-2xl sm:rounded-3xl grain overflow-hidden animate-fade-up delay-300">
            <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                  <HeartPulse className="h-5 w-5 text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">Dicas para o seu Tratamento</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {DICAS.map((dica, index) => {
                  const Icon = dica.icone;
                  return (
                    <div key={index} className="flex gap-3 items-start">
                      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', dica.bg)}>
                        <Icon className={cn('h-4 w-4', dica.cor)} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{dica.titulo}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{dica.texto}</p>
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
