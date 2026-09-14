'use client';

import { useId } from 'react';
import Link from 'next/link';
import {
  Wallet,
  Clock3,
  Receipt,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Radio,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

/**
 * Visão financeira de `/admin/pagamentos` e `/medico/pagamentos` — composição única
 * (hero com tendência + donut de status), redesenhada para o padrão "Âmbar" do produto
 * em vez do card achatado genérico de biblioteca de gráfico.
 *
 * Nada aqui é cor nova: todo tom vem de `--chart-1..5`/`--primary-soft`/`--destructive`
 * (`app/globals.css`), e a técnica de wash/glow/glass reaproveita o que já existe em
 * `.page-header-wash` e nos blobs de `app/(medico)/medico/perfil/page.tsx` — só que
 * aplicada aqui pela primeira vez a um card de métrica. ADR-0003 D-02: compor com o
 * que existe, não importar linguagem visual de outro produto.
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
  /** Só o admin tem esse card — o médico não vê o funil de confirmação dos outros. */
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

/* ── Chip de tendência (↑/↓ vs período anterior) ─────────────────── */
function ChipTendencia({ atual, anterior }: { atual: number; anterior: number }) {
  if (anterior <= 0) return null;
  const variacao = ((atual - anterior) / anterior) * 100;
  const positivo = variacao > 0.5;
  const negativo = variacao < -0.5;
  const Icone = positivo ? TrendingUp : negativo ? TrendingDown : Minus;
  const cor = positivo ? 'var(--chart-2)' : negativo ? 'var(--destructive)' : 'var(--muted-foreground)';

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums backdrop-blur-sm"
      style={{ backgroundColor: `color-mix(in oklab, ${cor} 14%, transparent)`, color: cor }}
    >
      <Icone size={12} strokeWidth={2.5} />
      {Math.abs(variacao).toFixed(0)}% vs mês anterior
    </span>
  );
}

/* ── Tooltip com leve blur, no lugar da caixa branca padrão ──────── */
function TooltipCustomizado({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/90 border-border/60 rounded-xl border px-3.5 py-2.5 shadow-lg backdrop-blur-md">
      <p className="text-muted-foreground text-[11px] font-medium">{label}</p>
      <p className="text-foreground mt-0.5 text-base font-bold tabular-nums">
        R$ {formatarValor(payload[0].value)}
      </p>
    </div>
  );
}

/* ── Pílula de métrica secundária — compacta, sem caixa de ícone grande ── */
function MetricaPill({
  icone: Icone,
  cor,
  label,
  valor,
  detalhe,
  href,
}: {
  icone: typeof Wallet;
  cor: string;
  label: string;
  valor: string;
  detalhe: string;
  href?: string;
}) {
  const conteudo = (
    <div className="flex items-center gap-3 px-1">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `color-mix(in oklab, ${cor} 14%, transparent)`, color: cor }}
      >
        <Icone size={17} strokeWidth={2.25} />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] leading-tight font-semibold tracking-wide uppercase">
          {label}
        </p>
        <p className="truncate text-base leading-tight font-bold tabular-nums">{valor}</p>
        <p className="text-muted-foreground truncate text-[11px] leading-tight">{detalhe}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="border-border/60 bg-card hover:border-border block rounded-2xl border py-3 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
      >
        {conteudo}
      </Link>
    );
  }

  return (
    <div className="border-border/60 bg-card rounded-2xl border py-3 shadow-[var(--shadow-card)]">
      {conteudo}
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

  const pontosComMovimento = evolucao.filter((e) => e.total > 0);
  const temEvolucao = pontosComMovimento.length > 0;
  const atual = evolucao.at(-1)?.total ?? 0;
  const anterior = evolucao.at(-2)?.total ?? 0;

  const ordenados = ORDEM_STATUS.map((s) => distribuicaoStatus.find((d) => d.status === s)).filter(
    (d): d is StatusDistribuicaoItem => Boolean(d && d.quantidade > 0),
  );
  const totalStatus = ordenados.reduce((s, d) => s + d.quantidade, 0);

  const ticketMedio = resumo.quantidadePaga > 0 ? Number(resumo.totalRecebido) / resumo.quantidadePaga : 0;
  const donoTexto = escopo === 'medico' ? 'você' : 'a plataforma';

  return (
    <div className="animate-fade-up space-y-4">
      {/* ═══ Tira de métricas secundárias — densa, sem caixa de ícone gigante ═══ */}
      <div
        className={cn(
          'grid grid-cols-2 gap-3',
          atencaoHref ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
        )}
      >
        <MetricaPill
          icone={Clock3}
          cor="var(--chart-4)"
          label="Pendente"
          valor={`R$ ${formatarValor(resumo.totalPendente)}`}
          detalhe={`${resumo.quantidadePendente} aguardando`}
        />
        <MetricaPill
          icone={Receipt}
          cor="var(--chart-3)"
          label="Ticket médio"
          valor={`R$ ${formatarValor(ticketMedio)}`}
          detalhe="por consulta paga"
        />
        {atencaoHref && (
          <MetricaPill
            icone={AlertTriangle}
            cor="var(--destructive)"
            label="Precisa de atenção"
            valor={String(resumo.quantidadeAtencao ?? 0)}
            detalhe="pagou, não confirmou"
            href={atencaoHref}
          />
        )}
      </div>

      {/* ═══ Hero (tendência) + Donut (status) — composição principal ═══ */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* ── Hero: valor recebido + área + comparação ── */}
        <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card shadow-[var(--shadow-soft)] lg:col-span-3">
          {/* Glow radial no canto — mesma técnica de app/(medico)/medico/perfil/page.tsx */}
          <div
            className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full opacity-70 blur-3xl"
            style={{ background: 'color-mix(in oklab, var(--chart-1) 20%, transparent)' }}
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-14 h-56 w-56 rounded-full opacity-60 blur-3xl"
            style={{ background: 'color-mix(in oklab, var(--chart-2) 16%, transparent)' }}
          />

          <div className="relative z-10 flex flex-col gap-1 p-6 pb-2 sm:p-7 sm:pb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="bg-chart-2 absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
                <span className="bg-chart-2 relative inline-flex h-2 w-2 rounded-full" />
              </span>
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Recebido · últimos 6 meses
              </p>
            </div>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-heading text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
                  R$ {formatarValor(resumo.totalRecebido)}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {resumo.quantidadePaga} pagamento{resumo.quantidadePaga !== 1 ? 's' : ''} confirmado
                  {resumo.quantidadePaga !== 1 ? 's' : ''} · {donoTexto}
                </p>
              </div>
              <ChipTendencia atual={atual} anterior={anterior} />
            </div>
          </div>

          <div className="relative z-10 h-[180px] w-full px-2 sm:h-[210px]">
            {temEvolucao ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolucao} margin={{ top: 12, right: 18, bottom: 0, left: 18 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.32} />
                      <stop offset="55%" stopColor="var(--chart-1)" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    dy={6}
                  />
                  <Tooltip content={<TooltipCustomizado />} cursor={{ stroke: 'var(--border)', strokeDasharray: '3 3' }} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="var(--chart-1)"
                    strokeWidth={2.75}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 3, stroke: 'var(--card)', fill: 'var(--chart-1)' }}
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
                <Wallet size={22} className="text-muted-foreground/50" />
                <p className="text-muted-foreground text-xs">
                  Sem pagamentos confirmados nos últimos 6 meses ainda
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Donut: distribuição por status ── */}
        <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card p-6 shadow-[var(--shadow-soft)] sm:p-7 lg:col-span-2">
          <div
            className="pointer-events-none absolute -top-10 -left-10 h-48 w-48 rounded-full opacity-60 blur-3xl"
            style={{ background: 'color-mix(in oklab, var(--chart-3) 18%, transparent)' }}
          />
          <div className="relative z-10">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Por status
            </p>
            <p className="font-heading mt-0.5 text-base font-semibold tracking-tight">
              Todos os pagamentos
            </p>

            {totalStatus === 0 ? (
              <div className="flex h-[176px] flex-col items-center justify-center gap-1.5 text-center">
                <Radio size={20} className="text-muted-foreground/50" />
                <p className="text-muted-foreground text-xs">Nenhum registro ainda</p>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-4">
                <div className="relative shrink-0" style={{ width: 132, height: 132 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ordenados}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={64}
                        paddingAngle={4}
                        dataKey="quantidade"
                        nameKey="status"
                        animationDuration={800}
                        animationEasing="ease-out"
                      >
                        {ordenados.map((entry, i) => (
                          <Cell
                            key={`slice-${i}`}
                            fill={STATUS_INFO[entry.status]?.cor ?? 'var(--chart-5)'}
                            stroke="var(--card)"
                            strokeWidth={3}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold tabular-nums">{totalStatus}</span>
                    <span className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase">
                      total
                    </span>
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  {ordenados.map((item) => {
                    const info = STATUS_INFO[item.status];
                    const pct = totalStatus > 0 ? (item.quantidade / totalStatus) * 100 : 0;
                    return (
                      <div key={item.status} className="min-w-0">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: info?.cor ?? 'var(--chart-5)' }}
                            />
                            <span className="truncate font-medium">{info?.label ?? item.status}</span>
                          </span>
                          <span className="text-muted-foreground shrink-0 tabular-nums">
                            {item.quantidade}
                          </span>
                        </div>
                        <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, backgroundColor: info?.cor ?? 'var(--chart-5)' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
