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
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ShieldCheck,
  Droplets,
  HeartPulse,
  BookOpen,
  ChevronRight,
  Star,
  Loader2,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
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
    dados.medicamentoAtivo && dados.medicamentoAtivo.diasRestantes <= 15
      ? {
          id: 1,
          titulo: 'Solicitar recompra',
          descricao: `Seu medicamento acaba em ${dados.medicamentoAtivo.diasRestantes} dias`,
          href: '/paciente/recompra',
          urgente: dados.medicamentoAtivo.diasRestantes <= 7,
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
                  <p className="text-xs text-muted-foreground">Medicamento ativo</p>
                  <p className="truncate text-sm font-medium">
                    {med ? med.nome : (
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

          {/* ── Grid: Medicamento + Próximos passos ─────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Medicamento ativo */}
            <Card className="border-border/40 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Pill className="h-5 w-5 text-primary" />
                  Medicamento Ativo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
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
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{med.nome}</p>
                        <p className="text-sm text-muted-foreground">{med.gotasPorDia} gotas/dia — {med.mlFrasco}ml</p>
                      </div>
                      {med.diasRestantes <= 15 && (
                        <Badge variant="secondary" className="shrink-0">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Recompra em breve
                        </Badge>
                      )}
                    </div>

                    {/* Barra de consumo */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Consumo do frasco</span>
                        <span className={cn(med.percentualConsumo >= 75 ? 'font-medium text-amber-600' : '')}>
                          {med.percentualConsumo}%
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-700',
                            med.percentualConsumo >= 75
                              ? 'bg-gradient-to-r from-amber-500 to-red-500'
                              : 'bg-gradient-to-r from-primary to-primary/70',
                          )}
                          style={{ width: `${med.percentualConsumo}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {med.diasRestantes} dias restantes de medicamento
                      </p>
                    </div>

                    {/* Dias em tratamento */}
                    <div className="rounded-xl bg-primary/5 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HeartPulse className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-primary">
                            Dias em tratamento
                          </span>
                        </div>
                        <span className="text-sm font-bold text-primary">
                          {med.diasEmTratamento} dias
                        </span>
                      </div>
                    </div>

                    <Link
                      href="/paciente/recompra"
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      Solicitar recompra
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </>
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

          {/* ── Status do tratamento ─────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Visão geral */}
            <Card className="border-border/40 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Status do Tratamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {med ? (
                  <>
                    <div className="flex items-center gap-4 rounded-xl bg-primary/5 px-4 py-3">
                      <Star className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">{med.diasEmTratamento} dias em tratamento</p>
                        <p className="text-xs text-muted-foreground">Continue assim!</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-primary">{med.diasEmTratamento}</p>
                        <p className="text-xs text-muted-foreground">dias ativos</p>
                      </div>
                      <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-amber-600">{med.diasRestantes}</p>
                        <p className="text-xs text-muted-foreground">dias de med.</p>
                      </div>
                      <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-emerald-600">{dados?.totalDocumentos}</p>
                        <p className="text-xs text-muted-foreground">documentos</p>
                      </div>
                      <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-violet-600">{dados?.mensagensNaoLidas ?? 0}</p>
                        <p className="text-xs text-muted-foreground">msg. não lidas</p>
                      </div>
                    </div>

                    {dados?.medicoNome && (
                      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">
                          Seu tratamento está ativo e sendo acompanhado por {dados.medicoNome}.
                        </p>
                      </div>
                    )}
                    {!dados?.medicoNome && (
                      <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                        <UserX className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Nenhum médico responsável atribuído ainda. Entre em contato com a equipe.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm font-medium">Tratamento não iniciado</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Os dados aparecerão aqui quando seu médico prescrever o medicamento.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dicas de saúde */}
            <Card className="border-border/40 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <HeartPulse className="h-5 w-5 text-primary" />
                  Dicas para o seu Tratamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
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
          </div>
        </>
      )}
    </div>
  );
}
