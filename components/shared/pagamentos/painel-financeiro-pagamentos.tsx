'use client';

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Wallet,
  Clock3,
  Receipt,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadialBarChart,
  RadialBar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

/**
 * Visão financeira de `/admin/pagamentos` e `/medico/pagamentos` — v2, reformulada como
 * uma grade bento assimétrica em vez de "cards com gráfico dentro": hero em full-bleed
 * com o número sobreposto à área, comparativo em barras, e status como ANÉIS
 * concêntricos (`RadialBarChart`) — a metáfora de atividade/saúde, deliberada, não só
 * "outro tipo de gráfico".
 *
 * Zero dependência nova: Recharts já cobre tudo (Tremor, por baixo, também usa
 * Recharts — a diferença nunca foi a biblioteca). Zero cor nova: tudo vem de
 * `--chart-1..5`/`--destructive` (`app/globals.css`). ADR-0003 D-02: compor com o que
 * existe.
 *
 * O seletor 3M/6M é interatividade real (`useState`), não decorativo — mas fatia o
 * MESMO array de 6 meses que a Server Action já entrega; nenhuma query nova, nenhuma
 * regra de negócio muda.
 */

interface RecebidoMensalPonto {
  mes: string;
  total: number;
}

interface StatusDistribuicaoItem {
  status: string;
  quantidade: number;
}

interface ResumoFinanceiro {
  totalRecebido: string;
  totalPendente: string;
  quantidadePendente: number;
  quantidadePaga: number;
  quantidadeAtencao?: number;
}

interface PainelFinanceiroPagamentosProps {
  resumo: ResumoFinanceiro;
  evolucao: RecebidoMensalPonto[];
  distribuicaoStatus: StatusDistribuicaoItem[];
  /** Só o admin tem esse segmento — o médico não vê o funil de confirmação dos outros. */
  atencaoHref?: string;
  /** "você" (médico) vs "a plataforma" (admin) — só muda o texto, não a lógica. */
  escopo?: 'medico' | 'plataforma';
}

const STATUS_INFO: Record<string, { label: string; cor: string }> = {
  pago: { label: 'Pago', cor: 'var(--chart-2)' },
  pendente: { label: 'Pendente', cor: 'var(--chart-4)' },
  isento: { label: 'Isento', cor: 'var(--chart-3)' },
  cancelado: { label: 'Cancelado', cor: 'var(--chart-5)' },
  estornado: { label: 'Estornado', cor: 'var(--destructive)' },
};
const ORDEM_STATUS = ['pago', 'pendente', 'isento', 'cancelado', 'estornado'];

function formatarValor(v: string | number): string {
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function corTendencia(variacao: number): string {
  if (variacao > 0.5) return 'var(--chart-2)';
  if (variacao < -0.5) return 'var(--destructive)';
  return 'var(--muted-foreground)';
}

/* ── Chip de tendência (↑/↓ vs período anterior) ─────────────────── */
function ChipTendencia({ atual, anterior }: { atual: number; anterior: number }) {
  if (anterior <= 0) return null;
  const variacao = ((atual - anterior) / anterior) * 100;
  const positivo = variacao > 0.5;
  const negativo = variacao < -0.5;
  const Icone = positivo ? TrendingUp : negativo ? TrendingDown : Minus;
  const cor = corTendencia(variacao);

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums backdrop-blur-sm"
      style={{ backgroundColor: `color-mix(in oklab, ${cor} 16%, transparent)`, color: cor }}
    >
      <Icone size={12} strokeWidth={2.5} />
      {Math.abs(variacao).toFixed(0)}%
    </span>
  );
}

/* ── Tooltip rico — valor do mês + delta vs mês anterior ─────────── */
function TooltipHero({
  active,
  payload,
  label,
  serie,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  serie: RecebidoMensalPonto[];
}) {
  if (!active || !payload?.length) return null;
  const idx = serie.findIndex((s) => s.mes === label);
  const anterior = idx > 0 ? serie[idx - 1].total : null;
  const valor = payload[0].value;
  const delta = anterior && anterior > 0 ? ((valor - anterior) / anterior) * 100 : null;

  return (
    <div className="bg-card/95 border-border/60 min-w-[9rem] rounded-xl border px-3.5 py-2.5 shadow-lg backdrop-blur-md">
      <p className="text-muted-foreground text-[11px] font-medium">{label}</p>
      <p className="text-foreground mt-0.5 text-base font-bold tabular-nums">
        R$ {formatarValor(valor)}
      </p>
      {delta !== null && (
        <p
          className="mt-0.5 text-[11px] font-semibold tabular-nums"
          style={{ color: corTendencia(delta) }}
        >
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(0)}% vs {serie[idx - 1].mes}
        </p>
      )}
    </div>
  );
}

/* ── Seletor de período — interatividade real sobre o array já carregado ── */
function SeletorPeriodo({ valor, aoMudar }: { valor: 3 | 6; aoMudar: (v: 3 | 6) => void }) {
  return (
    <div className="bg-card/70 border-border/50 inline-flex items-center gap-0.5 rounded-full border p-0.5 backdrop-blur-sm">
      {([3, 6] as const).map((opt) => (
        <button
          key={opt}
          onClick={() => aoMudar(opt)}
          className={cn(
            'rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums transition-all',
            valor === opt
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {opt}M
        </button>
      ))}
    </div>
  );
}

export function PainelFinanceiroPagamentos({
  resumo,
  evolucao,
  distribuicaoStatus,
  atencaoHref,
  escopo = 'medico',
}: PainelFinanceiroPagamentosProps) {
  const gradientId = useId();
  const [periodo, setPeriodo] = useState<3 | 6>(6);

  const serie = useMemo(() => evolucao.slice(-periodo), [evolucao, periodo]);
  const temMovimento = serie.some((e) => e.total > 0);
  const atual = serie.at(-1)?.total ?? 0;
  const anterior = serie.at(-2)?.total ?? 0;

  const ordenados = ORDEM_STATUS.map((s) => distribuicaoStatus.find((d) => d.status === s)).filter(
    (d): d is StatusDistribuicaoItem => Boolean(d && d.quantidade > 0),
  );
  const totalStatus = ordenados.reduce((s, d) => s + d.quantidade, 0);

  const ticketMedio =
    resumo.quantidadePaga > 0 ? Number(resumo.totalRecebido) / resumo.quantidadePaga : 0;
  const totalPagoEPendente = resumo.quantidadePaga + resumo.quantidadePendente;
  const pctPendente =
    totalPagoEPendente > 0 ? (resumo.quantidadePendente / totalPagoEPendente) * 100 : 0;
  const donoTexto = escopo === 'medico' ? 'você' : 'a plataforma';

  return (
    <div className="animate-fade-up space-y-4">
      {/* ═══ Bento principal: hero full-bleed + (comparativo / anéis) ═══ */}
      <div className="grid gap-4 lg:grid-cols-12 lg:items-stretch">
        {/* ── Hero: número sobreposto à área, full-bleed ── */}
        <div className="border-border/50 bg-card relative flex min-h-[380px] flex-col overflow-hidden rounded-[1.75rem] border shadow-[var(--shadow-soft)] lg:col-span-7">
          <div
            className="pointer-events-none absolute -top-20 -right-16 h-72 w-72 rounded-full opacity-70 blur-3xl"
            style={{ background: 'color-mix(in oklab, var(--chart-1) 22%, transparent)' }}
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full opacity-50 blur-3xl"
            style={{ background: 'color-mix(in oklab, var(--chart-2) 16%, transparent)' }}
          />

          {/* Gráfico ocupa o card inteiro, de ponta a ponta — é o fundo, não um bloco à parte */}
          <div className="absolute inset-0">
            {temMovimento ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serie} margin={{ top: 0, right: 0, bottom: 8, left: 0 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.38} />
                      <stop offset="50%" stopColor="var(--chart-1)" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 10.5, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    dy={-4}
                  />
                  <Tooltip
                    content={<TooltipHero serie={serie} />}
                    cursor={{ stroke: 'var(--border)', strokeDasharray: '3 3' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="var(--chart-1)"
                    strokeWidth={2.75}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    activeDot={{
                      r: 6,
                      strokeWidth: 3,
                      stroke: 'var(--card)',
                      fill: 'var(--chart-1)',
                    }}
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
                <Wallet size={22} className="text-muted-foreground/40" />
                <p className="text-muted-foreground text-xs">Sem pagamentos confirmados ainda</p>
              </div>
            )}
          </div>

          {/* Scrim — só o suficiente pro texto continuar legível sobre a área */}
          <div className="from-card via-card/75 pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent" />

          {/* Conteúdo sobreposto ao gráfico */}
          <div className="relative z-10 flex flex-1 flex-col justify-between p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="bg-chart-2 absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
                    <span className="bg-chart-2 relative inline-flex h-1.5 w-1.5 rounded-full" />
                  </span>
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                    Recebido · {donoTexto}
                  </p>
                </div>
                <p className="font-heading mt-0.5 text-4xl font-bold tracking-tight tabular-nums sm:text-[2.75rem]">
                  R$ {formatarValor(resumo.totalRecebido)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ChipTendencia atual={atual} anterior={anterior} />
                <SeletorPeriodo valor={periodo} aoMudar={setPeriodo} />
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              {resumo.quantidadePaga} pagamento{resumo.quantidadePaga !== 1 ? 's' : ''} confirmado
              {resumo.quantidadePaga !== 1 ? 's' : ''} nos últimos {periodo} meses
            </p>
          </div>
        </div>

        {/* ── Coluna direita: comparativo em barras + anéis de status ── */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          {/* Comparativo mensal — barras, mês atual em destaque */}
          <div className="border-border/50 bg-card relative flex-1 overflow-hidden rounded-[1.75rem] border p-5 shadow-[var(--shadow-card)]">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Comparativo mensal
            </p>
            <div className="mt-1 h-[124px]">
              {temMovimento ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={serie}
                    margin={{ top: 6, right: 2, bottom: 0, left: 2 }}
                    barCategoryGap="30%"
                  >
                    <XAxis
                      dataKey="mes"
                      tick={{ fontSize: 10.5, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                      dy={4}
                    />
                    <Tooltip
                      content={<TooltipHero serie={serie} />}
                      cursor={{ fill: 'var(--muted)', radius: 8 }}
                    />
                    <Bar
                      dataKey="total"
                      radius={[7, 7, 7, 7]}
                      maxBarSize={20}
                      animationDuration={700}
                    >
                      {serie.map((_, i) => (
                        <Cell
                          key={`bar-${i}`}
                          fill={
                            i === serie.length - 1
                              ? 'var(--chart-1)'
                              : 'color-mix(in oklab, var(--chart-1) 25%, transparent)'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Activity size={18} className="text-muted-foreground/40" />
                </div>
              )}
            </div>
          </div>

          {/* Anéis concêntricos — distribuição por status (metáfora de atividade/saúde) */}
          <div className="border-border/50 bg-card relative flex-1 overflow-hidden rounded-[1.75rem] border p-5 shadow-[var(--shadow-card)]">
            <div
              className="pointer-events-none absolute -right-8 -bottom-8 h-32 w-32 rounded-full opacity-50 blur-3xl"
              style={{ background: 'color-mix(in oklab, var(--chart-3) 20%, transparent)' }}
            />
            <p className="text-muted-foreground relative z-10 text-[11px] font-semibold tracking-wide uppercase">
              Por status
            </p>

            {totalStatus === 0 ? (
              <div className="relative z-10 flex h-[124px] items-center justify-center">
                <p className="text-muted-foreground text-xs">Nenhum registro ainda</p>
              </div>
            ) : (
              <div className="relative z-10 mt-1 flex items-center gap-3">
                <div className="relative shrink-0" style={{ width: 108, height: 108 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      data={ordenados}
                      innerRadius="28%"
                      outerRadius="100%"
                      startAngle={90}
                      endAngle={-270}
                      barSize={7}
                    >
                      <RadialBar
                        dataKey="quantidade"
                        background={{ fill: 'var(--muted)' }}
                        cornerRadius={5}
                        animationDuration={800}
                        animationEasing="ease-out"
                      >
                        {ordenados.map((entry, i) => (
                          <Cell
                            key={`ring-${i}`}
                            fill={STATUS_INFO[entry.status]?.cor ?? 'var(--chart-5)'}
                          />
                        ))}
                      </RadialBar>
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold tabular-nums">{totalStatus}</span>
                    <span className="text-muted-foreground text-[8px] font-semibold tracking-wide uppercase">
                      total
                    </span>
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {ordenados.map((item) => {
                    const info = STATUS_INFO[item.status];
                    return (
                      <span
                        key={item.status}
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10.5px] font-semibold"
                        style={{
                          backgroundColor: `color-mix(in oklab, ${info?.cor ?? 'var(--chart-5)'} 12%, transparent)`,
                          color: info?.cor ?? 'var(--chart-5)',
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: info?.cor ?? 'var(--chart-5)' }}
                        />
                        {info?.label ?? item.status}
                        <span className="tabular-nums opacity-70">{item.quantidade}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Tira unificada — sem repetir chrome de card por métrica ═══ */}
      <div
        className={cn(
          'border-border/50 bg-card divide-border/60 grid grid-cols-1 divide-y overflow-hidden rounded-[1.75rem] border shadow-[var(--shadow-card)] sm:divide-x sm:divide-y-0',
          atencaoHref ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
        )}
      >
        <div className="flex items-center gap-3 p-5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'color-mix(in oklab, var(--chart-4) 15%, transparent)',
              color: 'var(--chart-4)',
            }}
          >
            <Clock3 size={18} strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Pendente
            </p>
            <p className="text-xl font-bold tabular-nums">
              R$ {formatarValor(resumo.totalPendente)}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className="bg-muted h-1 w-14 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pctPendente}%`, backgroundColor: 'var(--chart-4)' }}
                />
              </div>
              <p className="text-muted-foreground text-[11px]">
                {resumo.quantidadePendente} aguardando
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'color-mix(in oklab, var(--chart-3) 16%, transparent)',
              color: 'var(--chart-3)',
            }}
          >
            <Receipt size={18} strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Ticket médio
            </p>
            <p className="text-xl font-bold tabular-nums">R$ {formatarValor(ticketMedio)}</p>
            <p className="text-muted-foreground text-[11px]">por consulta paga</p>
          </div>
        </div>

        {atencaoHref && (
          <Link
            href={atencaoHref}
            className="hover:bg-muted/40 flex items-center gap-3 p-5 transition-colors"
          >
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                (resumo.quantidadeAtencao ?? 0) > 0 && 'animate-gentle-pulse',
              )}
              style={{
                backgroundColor: 'color-mix(in oklab, var(--destructive) 14%, transparent)',
                color: 'var(--destructive)',
              }}
            >
              <AlertTriangle size={18} strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                Precisa de atenção
              </p>
              <p className="text-xl font-bold tabular-nums">{resumo.quantidadeAtencao ?? 0}</p>
              <p className="text-muted-foreground text-[11px]">pagou, não confirmou</p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
