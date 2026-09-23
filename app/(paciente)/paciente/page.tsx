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
  Sparkles,
  CalendarClock,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { format, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { obterDadosDashboard, type DadosDashboard } from '@/app/_actions/dashboard-paciente';
import { AvisoDaProcuracao } from '@/components/paciente/AvisoDaProcuracao';
import { AvisoDeCadastroPendente } from '@/components/paciente/AvisoDeCadastroPendente';
import { AvisoDeEnderecoPendente } from '@/components/paciente/AvisoDeEnderecoPendente';
import { AvisoDoQueNaoChegou } from '@/components/paciente/AvisoDoQueNaoChegou';
import { AnvisaCard } from './_components/anvisa-card';

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

/**
 * Ordem real das fases — `db/schema/enums.ts` (`jornadaFaseEnum`), não presumida. É o
 * mesmo fluxo Kanban que o admin/médico já enxergam; aqui vira stepper horizontal.
 */
const JORNADA_ORDEM = [
  'acolhimento',
  'avaliacao_medica',
  'burocracia_anvisa',
  'logistica',
  'acompanhamento_continuo',
] as const;

function saudacaoPorHorario(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function descreverProximaConsulta(dataHora: string): string {
  const data = new Date(dataHora);
  const dias = differenceInCalendarDays(data, new Date());
  const hora = format(data, 'HH:mm', { locale: ptBR });
  if (dias <= 0) return `hoje às ${hora}`;
  if (dias === 1) return `amanhã às ${hora}`;
  return `em ${dias} dias, às ${hora}`;
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
  const indiceJornada = dados
    ? JORNADA_ORDEM.indexOf(dados.jornada.fase as (typeof JORNADA_ORDEM)[number])
    : -1;

  // Resumo dinâmico do hero — preserva a descrição original como estado de carregamento.
  const resumoHero = !dados
    ? 'Acompanhe suas consultas, medicamentos e documentos.'
    : consulta
      ? `Sua próxima consulta é ${descreverProximaConsulta(consulta.dataHora)}.`
      : proximosPassos.length > 0
        ? `Você tem ${proximosPassos.length} pendência${proximosPassos.length > 1 ? 's' : ''} para colocar em dia.`
        : 'Tudo certo por aqui — seu tratamento está em dia.';

  return (
    <div className="space-y-6 sm:space-y-10">
      {/* ═══════════════ HERO — saudação + panorama do dia ═══════════════ */}
      <div
        className="animate-fade-up relative overflow-hidden rounded-[1.75rem] p-6 text-white shadow-[var(--shadow-soft)] sm:p-8 lg:p-10"
        style={{
          background:
            'linear-gradient(135deg, var(--primary) 0%, color-mix(in oklab, var(--primary) 80%, black) 58%, color-mix(in oklab, var(--secondary) 55%, var(--primary) 45%) 100%)',
        }}
      >
        {/* Orbs decorativos — só cor derivada de token, nada de hex novo */}
        <div
          className="pointer-events-none absolute -top-24 -right-10 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: 'color-mix(in oklab, var(--sun) 65%, transparent)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full opacity-30 blur-3xl"
          style={{ background: 'color-mix(in oklab, white 55%, transparent)' }}
        />

        {/* Traço de pulso — assinatura recorrente do sistema Âmbar, bem sutil aqui */}
        <svg
          className="animate-gentle-pulse pointer-events-none absolute right-0 bottom-0 w-56 opacity-[0.18] sm:w-72"
          viewBox="0 0 300 60"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M0 32 L55 32 L70 12 L86 52 L100 32 L300 32"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-bold tracking-[0.25em] text-white/70 uppercase">
              <Sparkles size={12} />
              Área do Paciente
            </p>
            <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {carregando ? 'Carregando...' : `${saudacaoPorHorario()}, ${primeiroNome}`}
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85">{resumoHero}</p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[11px] font-semibold tracking-wide text-white/60 uppercase">
                Hoje
              </p>
              <p className="text-sm font-bold capitalize">
                {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/30 bg-white/10 shadow-lg backdrop-blur-md">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-bold">{primeiroNome.charAt(0).toUpperCase()}</span>
              )}
            </div>
          </div>
        </div>

        {/* Chips de vidro — panorama rápido, sem repetir os KPIs de baixo */}
        {dados && (
          <div className="relative z-10 mt-6 flex flex-wrap gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
              <Route size={13} />
              {jornadaLabel}
            </span>
            {proximosPassos.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
                <CheckCircle2 size={13} />
                {proximosPassos.length} pendência{proximosPassos.length > 1 ? 's' : ''}
              </span>
            )}
            {dados.mensagensNaoLidas > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
                <MessageCircle size={13} />
                {dados.mensagensNaoLidas} mensagem{dados.mensagensNaoLidas > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
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
          {/* ── Teleconsulta ao vivo — vidro + glow vermelho ────── */}
          {teleconsultaAtiva && (
            <div className="animate-fade-up relative overflow-hidden rounded-[1.75rem] border-2 border-red-500/50 bg-red-50/70 p-5 shadow-lg backdrop-blur-sm sm:p-6">
              <div
                className="pointer-events-none absolute -top-16 -right-10 h-52 w-52 rounded-full opacity-40 blur-3xl"
                style={{ background: 'color-mix(in oklab, #ef4444 45%, transparent)' }}
              />
              <div className="relative z-10 mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-display text-base leading-tight font-bold text-red-700">
                    Teleconsulta ao vivo
                  </p>
                  <p className="mt-0.5 text-sm text-red-600">
                    Dr(a). {teleconsultaAtiva.medicoNome} está esperando você
                  </p>
                </div>
              </div>
              <Link
                href={`/paciente/teleconsulta/${teleconsultaAtiva.roomId}`}
                className="relative z-10"
              >
                <Button className="w-full gap-2 rounded-xl bg-red-600 font-bold text-white shadow-md hover:bg-red-700">
                  <Video className="h-4 w-4" />
                  Entrar Agora
                </Button>
              </Link>
            </div>
          )}

          {/* ── Pós-consulta recém-realizada — vidro + glow verde ─── */}
          {dados?.consultaRecenteRealizada && !dados.teleconsultaAtiva && (
            <div className="animate-fade-up relative overflow-hidden rounded-[1.75rem] border-2 border-green-500/40 bg-green-50/60 p-5 shadow-sm backdrop-blur-sm sm:p-6">
              <div className="relative z-10 mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-green-800">Consulta realizada!</p>
                  <p className="text-sm text-green-700">
                    com Dr(a). {dados.consultaRecenteRealizada.medicoNome}
                  </p>
                </div>
              </div>
              {dados.consultaRecenteRealizada.temPrescricao ? (
                <Link href="/paciente/anvisa" className="relative z-10">
                  <Button className="w-full gap-2 rounded-xl bg-green-600 text-white hover:bg-green-700">
                    <ShieldCheck className="h-4 w-4" />
                    Iniciar Autorização ANVISA
                  </Button>
                </Link>
              ) : (
                <p className="relative z-10 text-center text-xs text-green-700">
                  Aguardando emissão da prescrição pelo médico...
                </p>
              )}
            </div>
          )}

          {/*
            ── P2: o aviso da procuração ──────────────────────
            🔴 FICA DEPOIS DO PÓS-CONSULTA e antes dos KPIs, de propósito. "Sua consulta
            acabou e a prescrição está pronta" é mais urgente; os KPIs são resumo, e resumo
            não compete com uma pendência que trava o tratamento.

            ⚠️ AVISA, NÃO BLOQUEIA (ADR-0016 D-06). O componente decide sozinho se aparece —
            passar `precisaDaProcuracao` falso simplesmente não renderiza nada.

            🔴 VEM ANTES DA PROCURAÇÃO, e a ordem importa (ADR-0022, D-02): quem tem cadastro
            pela metade não tem o que autorizar ainda. Mandá-lo à procuração primeiro seria
            pedir um passo que depende do anterior.

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

          <AvisoDeEnderecoPendente
            enderecoPendente={dados?.enderecoPendente ?? false}
            onSalvo={carregar}
          />

          {/* ═══ Bento principal: consulta em destaque + medicamento/jornada ═══ */}
          <div className="animate-fade-up grid gap-4 delay-75 lg:grid-cols-12 lg:items-stretch">
            {/* ── Próxima consulta — painel hero full-bleed ── */}
            <div className="border-border/50 bg-card relative flex min-h-[320px] flex-col justify-between overflow-hidden rounded-[1.75rem] border p-6 shadow-[var(--shadow-soft)] sm:p-7 lg:col-span-7">
              <div
                className="pointer-events-none absolute -top-20 -right-16 h-72 w-72 rounded-full opacity-60 blur-3xl"
                style={{ background: 'color-mix(in oklab, var(--primary) 20%, transparent)' }}
              />
              <div
                className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full opacity-40 blur-3xl"
                style={{ background: 'color-mix(in oklab, var(--chart-3) 22%, transparent)' }}
              />

              <div className="relative z-10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-2xl">
                    <Calendar className="text-primary h-5 w-5" />
                  </div>
                  <h2 className="font-display text-foreground text-lg font-bold">
                    Próxima Consulta
                  </h2>
                </div>
                {consulta && (
                  <span className="text-primary bg-primary/10 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold">
                    <CalendarClock size={13} />
                    {descreverProximaConsulta(consulta.dataHora)}
                  </span>
                )}
              </div>

              {!consulta ? (
                <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-8 text-center">
                  <div className="bg-muted/50 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
                    <Calendar className="text-muted-foreground/30 h-8 w-8" />
                  </div>
                  <p className="text-foreground text-base font-bold">Nenhuma consulta agendada</p>
                  <p className="text-muted-foreground mt-1 max-w-xs text-sm">
                    Marque sua primeira consulta e comece o acompanhamento com um especialista.
                  </p>
                  <Link href="/paciente/agendamento" className="mt-5">
                    <Button className="gap-2 rounded-xl px-6">
                      Agendar agora
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="relative z-10 mt-6 space-y-4">
                  <p className="font-display text-foreground text-3xl font-bold capitalize sm:text-4xl">
                    {format(new Date(consulta.dataHora), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="bg-muted/40 border-border/30 inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm">
                      <Clock className="text-muted-foreground h-4 w-4" />
                      {format(new Date(consulta.dataHora), 'HH:mm', { locale: ptBR })}
                    </span>
                    <span className="bg-muted/40 border-border/30 inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm">
                      <Stethoscope className="text-muted-foreground h-4 w-4" />
                      {consulta.medicoNome}
                    </span>
                  </div>

                  {consulta.meetLink ? (
                    <a
                      href={consulta.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold shadow-md transition-colors sm:w-auto sm:px-8"
                    >
                      <Video className="h-4 w-4" />
                      Acessar Google Meet
                    </a>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="w-full justify-center rounded-2xl py-2.5 text-xs font-bold sm:w-auto sm:px-6"
                    >
                      Link do Meet em breve
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* ── Coluna direita: medicamento + jornada ── */}
            <div className="flex flex-col gap-4 lg:col-span-5">
              {/* Medicamento atual — compacto */}
              <Card className="border-border/20 grain flex-1 overflow-hidden rounded-[1.75rem] border bg-white shadow-sm">
                <CardContent className="space-y-3.5 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-500/10">
                      <Pill className="h-4.5 w-4.5 text-violet-600" />
                    </div>
                    <h2 className="font-display text-foreground text-base font-bold">
                      Medicamento Atual
                    </h2>
                  </div>

                  {!med ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <p className="text-foreground text-sm font-bold">
                        Nenhum medicamento prescrito
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
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

                      <div className="flex flex-wrap gap-1.5">
                        {med.concentracaoTHC && (
                          <span className="bg-muted/40 border-border/20 rounded-full border px-2.5 py-1 text-[11px] font-semibold">
                            THC {med.concentracaoTHC}
                          </span>
                        )}
                        {med.concentracaoCBD && (
                          <span className="bg-muted/40 border-border/20 rounded-full border px-2.5 py-1 text-[11px] font-semibold">
                            CBD {med.concentracaoCBD}
                          </span>
                        )}
                        {med.viaAdministracao && (
                          <span className="bg-muted/40 border-border/20 rounded-full border px-2.5 py-1 text-[11px] font-semibold">
                            {med.viaAdministracao}
                          </span>
                        )}
                      </div>

                      {med.proximaRevisao && (
                        <div className="bg-primary/5 border-primary/10 flex items-center justify-between rounded-xl border px-3.5 py-2.5">
                          <span className="text-primary text-xs font-bold">Próxima revisão</span>
                          <span className="text-primary text-xs font-bold">
                            {format(new Date(med.proximaRevisao + 'T00:00:00'), 'dd/MM/yyyy', {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      )}

                      <Link
                        href="/paciente/medicamentos"
                        className="group text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-bold"
                      >
                        Ver todos meus medicamentos
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* ── Minha Autorização ANVISA (Monitoramento) ────────── */}
              {dados?.autorizacaoAnvisa && <AnvisaCard autorizacao={dados.autorizacaoAnvisa} />}

              {/* Jornada — stepper horizontal compacto */}
              <Card className="border-border/20 grain flex-1 overflow-hidden rounded-[1.75rem] border bg-white shadow-sm">
                <CardContent className="space-y-3.5 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-2xl">
                        <Route className="text-primary h-4.5 w-4.5" />
                      </div>
                      <h2 className="font-display text-foreground text-base font-bold">
                        Sua Jornada
                      </h2>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[11px] font-bold">
                      {statusLabel}
                    </Badge>
                  </div>

                  {/* Stepper — mesma linguagem visual do wizard de agendamento */}
                  <div className="flex items-center gap-1.5 py-1">
                    {JORNADA_ORDEM.map((fase, i) => (
                      <div key={fase} className="flex flex-1 items-center gap-1.5">
                        <div
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all',
                            i < indiceJornada
                              ? 'bg-primary text-primary-foreground'
                              : i === indiceJornada
                                ? 'bg-primary text-primary-foreground ring-primary/20 ring-4'
                                : 'bg-muted text-muted-foreground',
                          )}
                          title={LABEL_JORNADA[fase]}
                        >
                          {i < indiceJornada ? <CheckCircle2 size={13} /> : i + 1}
                        </div>
                        {i < JORNADA_ORDEM.length - 1 && (
                          <div
                            className={cn(
                              'h-1 flex-1 rounded-full transition-colors',
                              i < indiceJornada ? 'bg-primary' : 'bg-border',
                            )}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-primary text-sm font-bold">{jornadaLabel}</p>

                  {dados?.medicoNome ? (
                    <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <p className="text-xs leading-relaxed text-emerald-700 dark:text-emerald-400">
                        Acompanhado por <strong>{dados.medicoNome}</strong>.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                      <UserX className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                        Nenhum médico responsável atribuído ainda.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Tira unificada: médico · documentos · mensagens ── */}
          <div className="animate-fade-up border-border/50 bg-card divide-border/60 grid grid-cols-1 divide-y overflow-hidden rounded-[1.75rem] border shadow-[var(--shadow-card)] delay-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="flex items-center gap-3 p-5">
              <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <Stethoscope className="text-primary h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                  Médico
                </p>
                <p
                  className={cn(
                    'mt-0.5 truncate text-sm font-bold',
                    !dados?.medicoNome && 'text-muted-foreground font-normal italic',
                  )}
                >
                  {dados?.medicoNome ?? 'Não atribuído'}
                </p>
              </div>
            </div>

            <Link
              href="/paciente/documentos"
              className="hover:bg-muted/40 flex items-center gap-3 p-5 transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                <FileText className="h-4.5 w-4.5 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                  Documentos
                </p>
                <p className="mt-0.5 text-sm font-bold">
                  {dados?.totalDocumentos ?? 0} enviado{dados?.totalDocumentos !== 1 ? 's' : ''}
                </p>
              </div>
              <ChevronRight className="text-muted-foreground/40 h-4 w-4 shrink-0" />
            </Link>

            <Link
              href="/paciente/chat"
              className="hover:bg-muted/40 flex items-center gap-3 p-5 transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                <MessageCircle className="h-4.5 w-4.5 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                  Mensagens
                </p>
                <p className="mt-0.5 text-sm font-bold">
                  {dados?.mensagensNaoLidas
                    ? `${dados.mensagensNaoLidas} não lida${dados.mensagensNaoLidas > 1 ? 's' : ''}`
                    : 'Em dia'}
                </p>
              </div>
              <ChevronRight className="text-muted-foreground/40 h-4 w-4 shrink-0" />
            </Link>
          </div>

          {/* ── Próximos passos — timeline vertical conectada ── */}
          {proximosPassos.length > 0 && (
            <div className="animate-fade-up delay-150">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10">
                  <CheckCircle2 className="h-4 w-4 text-amber-600" />
                </div>
                <h2 className="font-display text-foreground text-lg font-bold">Próximos Passos</h2>
              </div>
              <div className="border-border/50 bg-card divide-border/50 overflow-hidden rounded-[1.75rem] border shadow-sm">
                {proximosPassos.map((passo, i) => (
                  <Link
                    key={passo!.id}
                    href={passo!.href}
                    className={cn(
                      'group hover:bg-muted/30 flex items-start gap-4 p-4 transition-colors sm:p-5',
                      i !== proximosPassos.length - 1 && 'border-border/50 border-b',
                    )}
                  >
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                          passo!.urgente
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        {i + 1}
                      </div>
                      {i !== proximosPassos.length - 1 && (
                        <div className="bg-border mt-1 h-full min-h-[0.75rem] w-0.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                      <p className="text-foreground text-sm leading-tight font-bold">
                        {passo!.titulo}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                        {passo!.descricao}
                      </p>
                    </div>
                    <ChevronRight className="text-muted-foreground/40 group-hover:text-primary mt-1.5 h-4 w-4 shrink-0 transition-all group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Dicas para o Tratamento — spotlight individual ── */}
          <div className="animate-fade-up delay-200">
            <div className="mb-4 flex items-center gap-2">
              <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-xl">
                <HeartPulse className="text-primary h-4 w-4" />
              </div>
              <h2 className="font-display text-foreground text-lg font-bold">
                Dicas para o seu Tratamento
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {DICAS.map((dica, index) => {
                const Icon = dica.icone;
                return (
                  <div
                    key={index}
                    className={cn(
                      'border-border/20 relative overflow-hidden rounded-[1.75rem] border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                    )}
                  >
                    <div
                      className={cn(
                        'pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-50 blur-2xl',
                        dica.bg,
                      )}
                    />
                    <div className="relative z-10">
                      <div
                        className={cn(
                          'flex h-11 w-11 items-center justify-center rounded-2xl',
                          dica.bg,
                        )}
                      >
                        <Icon className={cn('h-5 w-5', dica.cor)} />
                      </div>
                      <p className="text-foreground mt-3 text-sm font-bold">{dica.titulo}</p>
                      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                        {dica.texto}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
