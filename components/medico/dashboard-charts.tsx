'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from 'recharts';
import {
  FlaskConical,
  Activity,
  TrendingUp,
  Users,
} from 'lucide-react';

/**
 * Dashboard Charts — Organic / Editorial Caloroso
 *
 * Design anchor: Organic
 * Palette: terracotta #E63946, moss #2D4F3C, clay #C69B7B,
 *          peach #D4A388, stone #8A7F73, sand #F5F2ED
 * Typography: Fraunces (headings), Epilogue (body)
 * Structure: rounded-2xl, soft shadows, warm grain
 * Differentiator: cada card de gráfico tem uma faixa colorida sutil no topo
 *   que comunica a identidade do dado via cor — sem ícones genéricos.
 *   Legendas customizadas em HTML para máxima legibilidade.
 *
 * Recebe dados via props do Server Component (sem fetch client-side).
 */

/* ── Paleta alinhada ao design system ──────────────── */
const PALETA = {
  terracotta: '#E63946',
  moss: '#2D4F3C',
  clay: '#C69B7B',
  peach: '#D4A388',
  stone: '#8A7F73',
  sand: '#F5F2ED',
  cardBg: '#FFFFFF',
  foreground: '#1A1612',
  muted: '#8A7F73',
  border: '#DDD8D1',
};

/* Cores dos tratamentos usando paleta orgânica */
const CORES_TRATAMENTO: Record<string, string> = {
  CBD: PALETA.moss,
  THC: PALETA.terracotta,
  'CBD + THC': PALETA.clay,
  'Não definido': PALETA.stone,
};

const CORES_TRATAMENTO_ARR = [PALETA.moss, PALETA.terracotta, PALETA.clay, PALETA.stone];

/* Cores dos status usando paleta orgânica */
const CORES_STATUS: Record<string, string> = {
  'Aguardando Consulta': '#D4A388',
  'Em Tratamento': '#2D4F3C',
  'Concluído': '#E63946',
  'Arquivado': '#8A7F73',
};

const CORES_STATUS_ARR = [PALETA.peach, PALETA.moss, PALETA.terracotta, PALETA.stone];

/* ── Interface ─────────────────────────────────────── */
interface DadosGraficos {
  tratamentos: Array<{ tipo: string; quantidade: number }>;
  statusDistribuicao: Array<{ status: string; quantidade: number }>;
  evolucaoMensal: Array<{ mes: string; pacientes: number }>;
}

interface DashboardChartsProps {
  dados?: DadosGraficos;
}

/* ── Custom Tooltip ────────────────────────────────── */
function ChartTooltip({
  active,
  payload,
  label,
  labelKey = 'name',
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; payload: Record<string, string> }>;
  label?: string;
  labelKey?: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const displayLabel = label || item.payload[labelKey] || item.name;

  return (
    <div
      className="rounded-xl border px-4 py-3 shadow-lg"
      style={{
        backgroundColor: PALETA.cardBg,
        borderColor: PALETA.border,
      }}
    >
      <p className="text-xs font-medium" style={{ color: PALETA.muted }}>
        {displayLabel}
      </p>
      <p className="mt-0.5 text-lg font-bold" style={{ color: PALETA.foreground }}>
        {item.value.toLocaleString('pt-BR')}
      </p>
    </div>
  );
}

/* ── Custom Legend (Pie) ───────────────────────────── */
function PieLegend({
  data,
}: {
  data: Array<{ status: string; quantidade: number }>;
}) {
  const total = data.reduce((s, d) => s + d.quantidade, 0);

  return (
    <div className="flex flex-col gap-2.5 pl-2">
      {data.map((item) => {
        const cor = CORES_STATUS[item.status] ?? PALETA.stone;
        const pct = total > 0 ? ((item.quantidade / total) * 100).toFixed(0) : '0';
        return (
          <div key={item.status} className="flex items-center gap-3">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: cor }}
            />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium text-foreground">
                {item.status}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {pct}%
                </span>
                <span className="text-xs text-muted-foreground">
                  ({item.quantidade})
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Componente principal ──────────────────────────── */
export function DashboardCharts({ dados }: DashboardChartsProps) {
  if (!dados) {
    return (
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Users size={24} className="text-muted-foreground" />
          </div>
          <p className="font-heading text-lg font-semibold">
            Dados insuficientes para gráficos
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre pacientes para visualizar as estatísticas
          </p>
        </CardContent>
      </Card>
    );
  }

  const temDadosTratamento = dados.tratamentos.length > 0;
  const temDadosStatus = dados.statusDistribuicao.length > 0;
  const temDadosEvolucao = dados.evolucaoMensal.length > 0;

  if (!temDadosTratamento && !temDadosStatus && !temDadosEvolucao) {
    return (
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Activity size={24} className="text-muted-foreground" />
          </div>
          <p className="font-heading text-lg font-semibold">
            Dados insuficientes para gráficos
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre pacientes para visualizar as estatísticas
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══ Linha 1: Barras + Pizza lado a lado ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── Gráfico de Barras — Tipos de Tratamento ── */}
        {temDadosTratamento && (
          <Card className="group relative overflow-hidden rounded-2xl border-0 shadow-sm transition-shadow duration-300 hover:shadow-md">
            {/* Faixa decorativa topo — Organic differentiator */}
            <div
              className="h-1 w-full"
              style={{
                background: `linear-gradient(90deg, ${PALETA.moss}, ${PALETA.clay})`,
              }}
            />
            <div className="px-6 pt-5 pb-1">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${PALETA.moss}14` }}
                >
                  <FlaskConical size={18} style={{ color: PALETA.moss }} />
                </div>
                <div>
                  <h3 className="font-heading text-base font-semibold tracking-tight">
                    Tipos de Tratamento
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Distribuição por fitocanabinóide
                  </p>
                </div>
              </div>
            </div>
            <CardContent className="px-4 pt-2 pb-5">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart
                  data={dados.tratamentos}
                  margin={{ left: 0, right: 8, top: 12, bottom: 0 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={PALETA.border}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="tipo"
                    tick={{ fontSize: 11, fill: PALETA.muted, fontFamily: 'var(--font-epilogue)' }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: PALETA.muted }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={36}
                  />
                  <Tooltip
                    content={<ChartTooltip labelKey="tipo" />}
                    cursor={{ fill: `${PALETA.sand}`, radius: 8 }}
                  />
                  <Bar
                    dataKey="quantidade"
                    name="Pacientes"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={52}
                    animationDuration={800}
                    animationEasing="ease-out"
                  >
                    {dados.tratamentos.map((entry, i) => (
                      <Cell
                        key={`bar-${i}`}
                        fill={CORES_TRATAMENTO[entry.tipo] ?? CORES_TRATAMENTO_ARR[i % CORES_TRATAMENTO_ARR.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Legenda customizada */}
              <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
                {dados.tratamentos.map((entry, i) => (
                  <div key={entry.tipo} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{
                        backgroundColor:
                          CORES_TRATAMENTO[entry.tipo] ??
                          CORES_TRATAMENTO_ARR[i % CORES_TRATAMENTO_ARR.length],
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {entry.tipo}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Gráfico de Pizza — Status dos Pacientes ── */}
        {temDadosStatus && (
          <Card className="group relative overflow-hidden rounded-2xl border-0 shadow-sm transition-shadow duration-300 hover:shadow-md">
            {/* Faixa decorativa topo */}
            <div
              className="h-1 w-full"
              style={{
                background: `linear-gradient(90deg, ${PALETA.peach}, ${PALETA.terracotta})`,
              }}
            />
            <div className="px-6 pt-5 pb-1">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${PALETA.terracotta}14` }}
                >
                  <Activity size={18} style={{ color: PALETA.terracotta }} />
                </div>
                <div>
                  <h3 className="font-heading text-base font-semibold tracking-tight">
                    Status dos Pacientes
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Distribuição por status de tratamento
                  </p>
                </div>
              </div>
            </div>
            <CardContent className="px-6 pt-2 pb-5">
              <div className="flex items-center gap-4">
                {/* Donut chart */}
                <div className="shrink-0" style={{ width: 180, height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dados.statusDistribuicao}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={78}
                        paddingAngle={3}
                        dataKey="quantidade"
                        nameKey="status"
                        animationDuration={800}
                        animationEasing="ease-out"
                      >
                        {dados.statusDistribuicao.map((entry, i) => (
                          <Cell
                            key={`pie-${i}`}
                            fill={CORES_STATUS[entry.status] ?? CORES_STATUS_ARR[i % CORES_STATUS_ARR.length]}
                            stroke={PALETA.cardBg}
                            strokeWidth={3}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={<ChartTooltip labelKey="status" />}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legenda customizada ao lado */}
                <PieLegend data={dados.statusDistribuicao} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══ Linha 2: Gráfico de Área — Evolução Mensal ═══ */}
      {temDadosEvolucao && (
        <Card className="group relative overflow-hidden rounded-2xl border-0 shadow-sm transition-shadow duration-300 hover:shadow-md">
          {/* Faixa decorativa topo */}
          <div
            className="h-1 w-full"
            style={{
              background: `linear-gradient(90deg, ${PALETA.terracotta}, ${PALETA.moss}, ${PALETA.clay})`,
            }}
          />
          <div className="px-6 pt-5 pb-1">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${PALETA.moss}14` }}
              >
                <TrendingUp size={18} style={{ color: PALETA.moss }} />
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold tracking-tight">
                  Evolução de Pacientes
                </h3>
                <p className="text-xs text-muted-foreground">
                  Crescimento nos últimos 6 meses
                </p>
              </div>
            </div>
          </div>
          <CardContent className="px-4 pt-2 pb-5">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={dados.evolucaoMensal}
                margin={{ left: 0, right: 12, top: 12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="areaGradientEvolucao" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PALETA.terracotta} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={PALETA.terracotta} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={PALETA.border}
                  vertical={false}
                />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11, fill: PALETA.muted, fontFamily: 'var(--font-epilogue)' }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: PALETA.muted }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={36}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="pacientes"
                  name="Pacientes"
                  stroke={PALETA.terracotta}
                  strokeWidth={2.5}
                  fill="url(#areaGradientEvolucao)"
                  dot={{
                    fill: PALETA.terracotta,
                    r: 5,
                    strokeWidth: 3,
                    stroke: PALETA.cardBg,
                  }}
                  activeDot={{
                    r: 7,
                    strokeWidth: 3,
                    stroke: PALETA.cardBg,
                    fill: PALETA.terracotta,
                  }}
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
