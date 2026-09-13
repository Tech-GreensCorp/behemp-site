'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { getPusherClient } from '@/lib/integrations/pusher/client';
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
import { AvisoDaProcuracao } from '@/components/paciente/AvisoDaProcuracao';
import { AvisoDeCadastroPendente } from '@/components/paciente/AvisoDeCadastroPendente';
import { AvisoDoQueNaoChegou } from '@/components/paciente/AvisoDoQueNaoChegou';

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
  const router = useRouter();

  const [dados, setDados] = useState<DadosDashboard | null>(null);
  const [carregando, setCarregando] = useState(true);
  /** `null` = nada falhou. Texto = a consulta falhou, e a tela precisa dizer isso. */
  const [falhaAoCarregar, setFalhaAoCarregar] = useState<string | null>(null);

  const [teleconsultaAtiva, setTeleconsultaAtiva] = useState<{
    roomId: string;
    medicoNome: string;
  } | null>(null);

  /**
   * 🔴 G18 (ADR-0022 §24) — AUSÊNCIA DE DADO E FALHA DA CONSULTA NÃO SÃO A MESMA COISA.
   *
   * A versão anterior fazia `if (res.sucesso && res.dados) setDados(...)` e **descartava o
   * erro**. Quando a action falhava, `dados` ficava `null`, `carregando` virava `false`, e a
   * tela renderizava o estado vazio — idêntico ao de quem realmente não tem nada.
   *
   * ⚠️ É metade do relato do dono em 12/09: _"eu entrei na conta e vim na área de meus
   * documentos: nenhum dos documentos que eu enviei chegaram"_. Ninguém — nem ele, nem nós —
   * tinha como saber se era ausência de dado ou falha da consulta. **São coisas diferentes, e a
   * tela mostrava a mesma.**
   *
   * É o R6 da ADR-0022 aplicado ao painel: não basta não quebrar, tem que **dizer**.
   */
  const carregar = useCallback(async () => {
    setCarregando(true);
    setFalhaAoCarregar(null);
    const res = await obterDadosDashboard();
    if (res.sucesso && res.dados) {
      setDados(res.dados);
    } else {
      // O motivo vem da action, que já devolve texto seguro (sem stack, sem dado pessoal).
      setFalhaAoCarregar(res.erro ?? 'Não conseguimos carregar seus dados agora.');
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (dados?.teleconsultaAtiva) {
      setTeleconsultaAtiva(dados.teleconsultaAtiva);
    }
  }, [dados?.teleconsultaAtiva]);

  useEffect(() => {
    if (!dados?.userId) return;

    const pusher = getPusherClient();
    const handleTeleconsultaIniciada = (data: { roomId: string; medicoNome: string }) => {
      setTeleconsultaAtiva({ roomId: data.roomId, medicoNome: data.medicoNome });
      toast('🔴 Sua teleconsulta está começando!', {
        duration: 10000,
        action: {
          label: 'Entrar Agora',
          onClick: () => router.push(`/paciente/teleconsulta/${data.roomId}`),
        },
      });
    };

    const channel = pusher.subscribe(`private-user-${dados.userId}`);
    channel.bind('teleconsulta:iniciada', handleTeleconsultaIniciada);

    return () => {
      channel.unbind('teleconsulta:iniciada', handleTeleconsultaIniciada);
      pusher.unsubscribe(`private-user-${dados.userId}`);
    };
  }, [dados?.userId, router]);

  // ── Próximos passos dinâmicos baseados em dados reais ───────
  const proximosPassos = dados
    ? [
        !dados.proximaConsulta && !dados.medicamentoAtivo
          ? {
              id: 1,
              titulo: 'Agendar primeira consulta',
              descricao: 'Você ainda não tem consulta marcada',
              href: '/paciente/agendamento',
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
      ].filter(Boolean)
    : [];

  const med = dados?.medicamentoAtivo;
  const consulta = dados?.proximaConsulta;
  const jornadaLabel = dados ? (LABEL_JORNADA[dados.jornada.fase] ?? dados.jornada.fase) : '';
  const statusLabel = dados ? (LABEL_STATUS[dados.jornada.status] ?? dados.jornada.status) : '';

  return (
    <div className="space-y-6 sm:space-y-10">
      {/* ── Header Editorial ── */}
      <div className="animate-fade-up">
        <p className="text-primary mb-2 text-xs font-semibold tracking-[0.25em] uppercase sm:mb-4">
          Área do Paciente
        </p>
        <h1 className="font-display text-foreground text-3xl leading-[1.1] font-bold tracking-tight sm:text-5xl">
          {carregando ? (
            'Carregando...'
          ) : (
            <>
              Olá, <span>{primeiroNome}</span>
            </>
          )}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed sm:mt-4 sm:text-base">
          Acompanhe suas consultas, medicamentos e documentos.
        </p>
      </div>

      {/*
        🔴 G18 — A FALHA SE ANUNCIA, e diz que o problema é NOSSO.
        Sem isto, a tela vazia afirmava "você não tem nada" quando a verdade era "não
        conseguimos perguntar". Dizer de quem é o problema evita que o paciente comece a
        conversa tendo de provar que enviou algo — é a mesma regra do S8.4.
      */}
      {!carregando && falhaAoCarregar && (
        <div
          className="animate-fade-in rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-4"
          role="alert"
        >
          <p className="text-foreground text-sm leading-relaxed">
            <strong>Não conseguimos carregar seus dados agora.</strong> O problema é nosso, não seu
            — o que você enviou continua guardado.
          </p>
          <p className="text-muted-foreground mt-1 text-sm">{falhaAoCarregar}</p>
          <Button className="mt-3 h-11 rounded-xl" onClick={carregar} type="button">
            Tentar de novo
          </Button>
        </div>
      )}

      {carregando ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Card TELECONSULTA AO VIVO ─────────────────────── */}
          {teleconsultaAtiva && (
            <div className="animate-fade-up">
              <Card className="overflow-hidden rounded-2xl border-2 border-red-500/60 bg-red-50/80 shadow-lg">
                <CardContent className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
                      <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-base leading-tight font-bold text-red-700">
                        🔴 Teleconsulta ao Vivo!
                      </p>
                      <p className="mt-0.5 text-sm text-red-600">
                        Dr(a). {teleconsultaAtiva.medicoNome} está esperando você
                      </p>
                    </div>
                  </div>
                  <Link href={`/paciente/teleconsulta/${teleconsultaAtiva.roomId}`}>
                    <Button className="w-full gap-2 rounded-xl bg-red-600 font-bold text-white shadow-md hover:bg-red-700">
                      <Video className="h-4 w-4" />
                      Entrar Agora
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Card PÓS-CONSULTA (Recém-realizada) ───────────── */}
          {dados?.consultaRecenteRealizada && !dados.teleconsultaAtiva && (
            <div className="animate-fade-up">
              <Card className="rounded-2xl border-2 border-green-500/40 bg-green-50/50">
                <CardContent className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-bold text-green-800">✅ Consulta realizada!</p>
                      <p className="text-sm text-green-700">
                        com Dr(a). {dados.consultaRecenteRealizada.medicoNome}
                      </p>
                    </div>
                  </div>
                  {dados.consultaRecenteRealizada.temPrescricao ? (
                    <Link href="/paciente/anvisa">
                      <Button className="w-full gap-2 rounded-xl bg-green-600 text-white hover:bg-green-700">
                        <ShieldCheck className="h-4 w-4" />
                        Iniciar Autorização ANVISA
                      </Button>
                    </Link>
                  ) : (
                    <p className="text-center text-xs text-green-700">
                      Aguardando emissão da prescrição pelo médico...
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/*
            ── P2: o aviso da procuração ──────────────────────
            🔴 FICA DEPOIS DO PÓS-CONSULTA e antes dos KPIs, de propósito. "Sua consulta
            acabou e a prescrição está pronta" é mais urgente; os KPIs são resumo, e resumo
            não compete com uma pendência que trava o tratamento.

            ⚠️ AVISA, NÃO BLOQUEIA (ADR-0016 D-06). O componente decide sozinho se aparece —
            passar `precisaDaProcuracao` falso simplesmente não renderiza nada.
          */}
          {/*
            🔴 VEM ANTES DA PROCURAÇÃO, e a ordem importa (ADR-0022, D-02): quem tem cadastro
            pela metade não tem o que autorizar ainda. Mandá-lo à procuração primeiro seria
            pedir um passo que depende do anterior.
          */}
          {/*
            🔴 VEM PRIMEIRO DE TODOS (ADR-0022 R6): documento que o parceiro entregou e não
            chegou é problema NOSSO. Cobrar o paciente por ele — que é o que os avisos abaixo
            fazem — seria pedir que ele pague por uma falha nossa.
          */}
          <AvisoDoQueNaoChegou
            ponto={dados?.situacao?.ponto ?? ''}
            porque={dados?.situacao?.porque ?? ''}
          />

          <AvisoDeCadastroPendente cadastro={dados?.cadastroPendente ?? null} />

          <AvisoDaProcuracao precisaDaProcuracao={dados?.precisaDaProcuracao ?? false} />

          {/* ── KPIs principais ── */}
          <div className="animate-fade-up grid grid-cols-2 gap-3 delay-75 lg:grid-cols-4">
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
                <Card
                  key={kpi.label}
                  className="border-border/20 grain overflow-hidden rounded-2xl border bg-white shadow-sm"
                >
                  <CardContent className="flex items-center gap-3 p-3 sm:p-4">
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                        kpi.bg,
                      )}
                    >
                      <Icon className={cn('h-4 w-4', kpi.cor)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-muted-foreground/60 text-[10px] font-bold tracking-wider uppercase sm:text-xs">
                        {kpi.label}
                      </p>
                      <p
                        className={cn(
                          'mt-0.5 truncate text-sm font-semibold',
                          kpi.vazio && 'text-muted-foreground italic',
                        )}
                      >
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
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10">
                  <CheckCircle2 className="h-4 w-4 text-amber-600" />
                </div>
                <h2 className="font-display text-foreground text-lg font-bold">Próximos Passos</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {proximosPassos.map((passo, i) => (
                  <Link
                    key={passo!.id}
                    href={passo!.href}
                    className={cn(
                      'group grain flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4 transition-all hover:shadow-md sm:gap-4 sm:rounded-3xl sm:p-5',
                      passo!.urgente
                        ? 'border-amber-500/30 hover:border-amber-500/50'
                        : 'border-border/20 hover:border-primary/30',
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
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground text-sm leading-tight font-bold">
                        {passo!.titulo}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                        {passo!.descricao}
                      </p>
                    </div>
                    <ChevronRight className="text-muted-foreground/40 group-hover:text-primary mt-0.5 h-4 w-4 shrink-0 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Grid: Próxima consulta + Medicamento ────────────── */}
          <div className="animate-fade-up grid gap-6 delay-150 lg:grid-cols-2">
            {/* Próxima consulta (PRIORIDADE 2) */}
            <Card className="border-border/20 grain overflow-hidden rounded-2xl border bg-white shadow-sm sm:rounded-3xl">
              <CardContent className="space-y-4 p-4 sm:space-y-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-2xl">
                    <Calendar className="text-primary h-5 w-5" />
                  </div>
                  <h2 className="font-display text-foreground text-lg font-bold">
                    Próxima Consulta
                  </h2>
                </div>

                {!consulta ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="bg-muted/50 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
                      <Calendar className="text-muted-foreground/30 h-7 w-7" />
                    </div>
                    <p className="text-foreground text-sm font-bold">Nenhuma consulta agendada</p>
                    <Link
                      href="/paciente/agendamento"
                      className="text-primary mt-3 flex items-center gap-1.5 text-xs font-bold hover:underline"
                    >
                      Agendar agora
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="bg-primary/5 border-primary/10 rounded-2xl border p-4">
                      <p className="text-foreground text-lg font-bold capitalize">
                        {format(new Date(consulta.dataHora), "EEEE, dd 'de' MMMM", {
                          locale: ptBR,
                        })}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-sm">
                        às {format(new Date(consulta.dataHora), 'HH:mm', { locale: ptBR })}
                      </p>
                    </div>

                    <div className="bg-muted/30 border-border/10 flex items-center gap-3 rounded-2xl border px-4 py-3">
                      <Stethoscope className="text-muted-foreground/60 h-4 w-4" />
                      <span className="text-muted-foreground text-sm">com</span>
                      <span className="text-foreground text-sm font-bold">
                        {consulta.medicoNome}
                      </span>
                    </div>

                    {consulta.meetLink ? (
                      <a
                        href={consulta.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold shadow-md transition-colors"
                      >
                        <Video className="h-4 w-4" />
                        Acessar Google Meet
                      </a>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="w-full justify-center rounded-2xl py-2 text-xs font-bold"
                      >
                        Link do Meet em breve
                      </Badge>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Medicamento atual (PRIORIDADE 3) */}
            <Card className="border-border/20 grain overflow-hidden rounded-2xl border bg-white shadow-sm sm:rounded-3xl">
              <CardContent className="space-y-4 p-4 sm:space-y-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10">
                    <Pill className="h-5 w-5 text-violet-600" />
                  </div>
                  <h2 className="font-display text-foreground text-lg font-bold">
                    Medicamento Atual
                  </h2>
                </div>

                {!med ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="bg-muted/50 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
                      <Pill className="text-muted-foreground/30 h-7 w-7" />
                    </div>
                    <p className="text-foreground text-sm font-bold">
                      Nenhum medicamento prescrito
                    </p>
                    <p className="text-muted-foreground mt-1.5 max-w-xs text-xs">
                      Seu médico irá configurar sua dosagem em breve.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-foreground text-xl font-bold">
                        {formatarTipoCanabinoide(med.tipoCanabinoide)}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-sm">
                        {med.novaDosagem} — {med.frequencia}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {med.concentracaoTHC && (
                        <div className="bg-muted/30 border-border/10 rounded-2xl border px-4 py-3">
                          <p className="text-muted-foreground/60 text-[10px] font-bold tracking-wider uppercase">
                            THC
                          </p>
                          <p className="text-foreground mt-0.5 font-bold">{med.concentracaoTHC}</p>
                        </div>
                      )}
                      {med.concentracaoCBD && (
                        <div className="bg-muted/30 border-border/10 rounded-2xl border px-4 py-3">
                          <p className="text-muted-foreground/60 text-[10px] font-bold tracking-wider uppercase">
                            CBD
                          </p>
                          <p className="text-foreground mt-0.5 font-bold">{med.concentracaoCBD}</p>
                        </div>
                      )}
                      {med.viaAdministracao && (
                        <div className="bg-muted/30 border-border/10 rounded-2xl border px-4 py-3">
                          <p className="text-muted-foreground/60 text-[10px] font-bold tracking-wider uppercase">
                            Via
                          </p>
                          <p className="text-foreground mt-0.5 font-bold">{med.viaAdministracao}</p>
                        </div>
                      )}
                      <div className="bg-muted/30 border-border/10 rounded-2xl border px-4 py-3">
                        <p className="text-muted-foreground/60 text-[10px] font-bold tracking-wider uppercase">
                          Último ajuste
                        </p>
                        <p className="text-foreground mt-0.5 font-bold">
                          {format(new Date(med.dataAjuste + 'T00:00:00'), 'dd/MM/yyyy', {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>

                    {med.proximaRevisao && (
                      <div className="bg-primary/5 border-primary/10 rounded-2xl border px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="text-primary h-4 w-4" />
                            <span className="text-primary text-sm font-bold">Próxima revisão</span>
                          </div>
                          <span className="text-primary text-sm font-bold">
                            {format(new Date(med.proximaRevisao + 'T00:00:00'), 'dd/MM/yyyy', {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </div>
                    )}

                    <Link
                      href="/paciente/medicamentos"
                      className="group border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/30 flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition-all"
                    >
                      Ver todos meus medicamentos
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Jornada / Status (PRIORIDADE 4) ───────────────── */}
          <Card className="border-border/20 grain animate-fade-up overflow-hidden rounded-2xl border bg-white shadow-sm delay-200 sm:rounded-3xl">
            <CardContent className="space-y-4 p-4 sm:space-y-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-2xl">
                  <Route className="text-primary h-5 w-5" />
                </div>
                <h2 className="font-display text-foreground text-lg font-bold">Sua Jornada</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-primary/5 border-primary/10 rounded-2xl border p-4">
                  <p className="text-muted-foreground/60 text-[10px] font-bold tracking-wider uppercase">
                    Fase atual
                  </p>
                  <p className="text-primary mt-1.5 text-lg font-bold">{jornadaLabel}</p>
                </div>

                <div className="bg-muted/30 border-border/10 rounded-2xl border p-4">
                  <p className="text-muted-foreground/60 text-[10px] font-bold tracking-wider uppercase">
                    Status
                  </p>
                  <p className="text-foreground mt-1.5 text-lg font-bold">{statusLabel}</p>
                </div>
              </div>

              {dados?.medicoNome ? (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm leading-relaxed text-emerald-700 dark:text-emerald-400">
                    Seu tratamento está sendo acompanhado por <strong>{dados.medicoNome}</strong>.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <UserX className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <p className="text-sm leading-relaxed text-amber-700 dark:text-amber-400">
                    Nenhum médico responsável atribuído ainda. Entre em contato com a equipe.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Dicas para o Tratamento ── */}
          <Card className="border-border/20 grain animate-fade-up overflow-hidden rounded-2xl border bg-white shadow-sm delay-300 sm:rounded-3xl">
            <CardContent className="space-y-4 p-4 sm:space-y-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-2xl">
                  <HeartPulse className="text-primary h-5 w-5" />
                </div>
                <h2 className="font-display text-foreground text-lg font-bold">
                  Dicas para o seu Tratamento
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {DICAS.map((dica, index) => {
                  const Icon = dica.icone;
                  return (
                    <div key={index} className="flex items-start gap-3">
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                          dica.bg,
                        )}
                      >
                        <Icon className={cn('h-4 w-4', dica.cor)} />
                      </div>
                      <div>
                        <p className="text-foreground text-sm font-bold">{dica.titulo}</p>
                        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                          {dica.texto}
                        </p>
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
