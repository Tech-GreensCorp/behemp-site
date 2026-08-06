'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { listarEvolucoes } from '@/app/_actions/evolucoes';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Heart,
  Loader2,
  Moon,
  TrendingUp,
} from 'lucide-react';

interface TabGraficosProps {
  pacienteId: string;
}

/**
 * Mapeia qualificações textuais para escala numérica 0-10.
 */
const QUALIDADE_MAP: Record<string, number> = {
  ruim: 2,
  regular: 5,
  boa: 7,
  excelente: 10,
};

const QUALIDADE_LABELS: Record<string, string> = {
  ruim: 'Ruim',
  regular: 'Regular',
  boa: 'Boa',
  excelente: 'Excelente',
};

/**
 * Cores consistentes com a paleta do projeto.
 * Vermelho (#E63946) - Primary / Dor
 * Azul (#3b82f6) - Sono
 * Esmeralda (#10b981) - Bem-estar
 * Dourado (#C08E3A) - Accent / Brand
 */
const CORES = {
  dor: '#E63946',
  sono: '#3b82f6',
  bemEstar: '#10b981',
  accent: '#C08E3A',
} as const;

/** Tooltip customizado para combinar com a estética do site */
function TooltipCustom({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-3 shadow-lg">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{p.value ?? '–'}</span>
        </div>
      ))}
    </div>
  );
}

export function TabGraficos({ pacienteId }: TabGraficosProps) {
  const [dados, setDados] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarEvolucoes(pacienteId);
    if (res.sucesso && res.dados) {
      const sorted = [...res.dados].sort(
        (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime(),
      );
      setDados(sorted);
    }
    setCarregando(false);
  }, [pacienteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (carregando) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (dados.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="font-heading text-lg font-semibold">Gráficos de Evolução</h2>
        <Card className="border-border/40 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 size={40} className="mb-3 text-muted-foreground/40" />
            <p className="text-lg font-medium">Dados insuficientes</p>
            <p className="text-sm text-muted-foreground">
              Registre evoluções na aba Evolução para gerar gráficos
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Preparar dados para gráficos ───────────────────────────────
  const dadosGrafico = dados.map((e, idx) => ({
    label: `Reg ${idx + 1}`,
    dataFormatada: new Date(e.data + 'T00:00:00').toLocaleDateString('pt-BR'),
    dor: e.nivelDor ?? null,
    sono: e.qualidadeSono ? QUALIDADE_MAP[e.qualidadeSono] ?? null : null,
    bemEstar: e.bemEstar ? QUALIDADE_MAP[e.bemEstar] ?? null : null,
  }));

  // ── KPIs ───────────────────────────────────────────────────────
  const primeiro = dados[0];
  const ultimo = dados[dados.length - 1];

  // Redução da Dor (dor baixa = bom)
  const dorPrimeiro = primeiro?.nivelDor;
  const dorUltimo = ultimo?.nivelDor;
  let reducaoDor: number | null = null;
  let reducaoDorLabel = 'Sem dados de dor para comparação';
  if (dorPrimeiro != null && dorUltimo != null && dorPrimeiro > 0) {
    reducaoDor = Math.round(((dorPrimeiro - dorUltimo) / dorPrimeiro) * 100);
    reducaoDorLabel = `Comparado ao primeiro registro`;
  }

  // Melhora no Sono
  const sonoPrimeiro = primeiro?.qualidadeSono ? QUALIDADE_MAP[primeiro.qualidadeSono] : null;
  const sonoUltimo = ultimo?.qualidadeSono ? QUALIDADE_MAP[ultimo.qualidadeSono] : null;
  let melhoraSono: number | null = null;
  let melhoraSonoLabel = 'Sem dados de sono para comparação';
  if (sonoPrimeiro != null && sonoUltimo != null && sonoPrimeiro > 0) {
    melhoraSono = Math.round(((sonoUltimo - sonoPrimeiro) / sonoPrimeiro) * 100);
    melhoraSonoLabel = 'Comparado ao primeiro registro';
  }

  // Bem-Estar Geral
  const bemPrimeiro = primeiro?.bemEstar ? QUALIDADE_MAP[primeiro.bemEstar] : null;
  const bemUltimo = ultimo?.bemEstar ? QUALIDADE_MAP[ultimo.bemEstar] : null;
  let melhoraBem: number | null = null;
  let melhoraBemLabel = 'Sem dados para comparação';
  if (bemPrimeiro != null && bemUltimo != null && bemPrimeiro > 0) {
    melhoraBem = Math.round(((bemUltimo - bemPrimeiro) / bemPrimeiro) * 100);
    melhoraBemLabel = 'Comparado ao primeiro registro';
  }

  function KPIBadge({ valor }: { valor: number | null }) {
    if (valor === null) return <Badge variant="outline">Sem dados</Badge>;
    if (valor > 0) return <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><ArrowUpRight size={12} />Melhora</Badge>;
    if (valor < 0) return <Badge className="gap-1 bg-amber-100 text-amber-700 hover:bg-amber-100"><ArrowDownRight size={12} />Atenção</Badge>;
    return <Badge variant="outline">Estável</Badge>;
  }

  // ── Status Atual (último registro) ─────────────────────────────
  const statusItens = [
    {
      label: 'Nível de Dor',
      valor: ultimo?.nivelDor != null ? `${ultimo.nivelDor}/10` : '–',
      descricao: ultimo?.nivelDor != null
        ? (ultimo.nivelDor <= 3 ? 'Dor leve' : ultimo.nivelDor <= 6 ? 'Dor moderada' : 'Dor alta')
        : 'Não avaliado',
      cor: CORES.dor,
      icon: Heart,
    },
    {
      label: 'Qualidade do Sono',
      valor: ultimo?.qualidadeSono ? QUALIDADE_LABELS[ultimo.qualidadeSono] ?? '–' : '–',
      descricao: ultimo?.qualidadeSono
        ? `Escala: ${QUALIDADE_MAP[ultimo.qualidadeSono] ?? '–'}/10`
        : 'Não avaliado',
      cor: CORES.sono,
      icon: Moon,
    },
    {
      label: 'Bem-Estar Geral',
      valor: ultimo?.bemEstar ? QUALIDADE_LABELS[ultimo.bemEstar] ?? '–' : '–',
      descricao: ultimo?.bemEstar
        ? `Escala: ${QUALIDADE_MAP[ultimo.bemEstar] ?? '–'}/10`
        : 'Não avaliado',
      cor: CORES.bemEstar,
      icon: Activity,
    },
  ];

  const eixoConfig = {
    tick: { fontSize: 12, fill: '#9ca3af' },
    stroke: '#e5e7eb',
  };

  const gridConfig = {
    stroke: '#e5e7eb',
    strokeWidth: 1,
    horizontal: true,
    vertical: true,
  };

  const legendaConfig = {
    wrapperStyle: { fontSize: '12px', paddingTop: '8px' },
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-lg font-semibold">Gráficos de Evolução</h2>

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Redução da Dor */}
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">Redução da Dor</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-2xl font-bold tracking-tight">
                {reducaoDor !== null ? `${reducaoDor}%` : '—'}
              </p>
              <KPIBadge valor={reducaoDor} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{reducaoDorLabel}</p>
          </CardContent>
        </Card>

        {/* Melhora no Sono */}
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">Melhora no Sono</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-2xl font-bold tracking-tight">
                {melhoraSono !== null ? `${melhoraSono}%` : '—'}
              </p>
              <KPIBadge valor={melhoraSono} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{melhoraSonoLabel}</p>
          </CardContent>
        </Card>

        {/* Bem-Estar Geral */}
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">Bem-Estar Geral</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-2xl font-bold tracking-tight">
                {melhoraBem !== null ? `${melhoraBem}%` : '—'}
              </p>
              <KPIBadge valor={melhoraBem} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{melhoraBemLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Gráficos de Linha (2 colunas) ──────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Evolução do Nível de Dor */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="border-b border-border/30 pb-3">
            <CardTitle className="flex items-center gap-2 font-heading text-base">
              <TrendingUp size={16} className="text-[#E63946]" />
              Evolução do Nível de Dor
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dadosGrafico}>
                <CartesianGrid {...gridConfig} />
                <XAxis dataKey="label" {...eixoConfig} />
                <YAxis domain={[0, 10]} {...eixoConfig} />
                <Tooltip content={<TooltipCustom />} />
                <Legend {...legendaConfig} />
                <Line
                  type="monotone"
                  dataKey="dor"
                  name="Nível de Dor"
                  stroke={CORES.dor}
                  strokeWidth={2.5}
                  dot={{ fill: CORES.dor, r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Escala: 0 (sem dor) a 10 (dor máxima)
            </p>
          </CardContent>
        </Card>

        {/* Evolução da Qualidade do Sono */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="border-b border-border/30 pb-3">
            <CardTitle className="flex items-center gap-2 font-heading text-base">
              <TrendingUp size={16} className="text-blue-500" />
              Evolução da Qualidade do Sono
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dadosGrafico}>
                <CartesianGrid {...gridConfig} />
                <XAxis dataKey="label" {...eixoConfig} />
                <YAxis domain={[0, 10]} {...eixoConfig} />
                <Tooltip content={<TooltipCustom />} />
                <Legend {...legendaConfig} />
                <Line
                  type="monotone"
                  dataKey="sono"
                  name="Qualidade do Sono"
                  stroke={CORES.sono}
                  strokeWidth={2.5}
                  dot={{ fill: CORES.sono, r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Escala: 0 (ruim) a 10 (excelente)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Indicadores de Bem-Estar + Status Atual ─────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Indicadores de Bem-Estar (multi-linha) */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="border-b border-border/30 pb-3">
            <CardTitle className="flex items-center gap-2 font-heading text-base">
              <TrendingUp size={16} className="text-emerald-500" />
              Indicadores de Bem-Estar
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dadosGrafico}>
                <CartesianGrid {...gridConfig} />
                <XAxis dataKey="label" {...eixoConfig} />
                <YAxis domain={[0, 10]} {...eixoConfig} />
                <Tooltip content={<TooltipCustom />} />
                <Legend {...legendaConfig} />
                <Line
                  type="monotone"
                  dataKey="bemEstar"
                  name="Bem-Estar"
                  stroke={CORES.bemEstar}
                  strokeWidth={2.5}
                  dot={{ fill: CORES.bemEstar, r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="sono"
                  name="Sono"
                  stroke={CORES.sono}
                  strokeWidth={2}
                  dot={{ fill: CORES.sono, r: 3, strokeWidth: 0 }}
                  connectNulls
                  strokeDasharray="5 3"
                />
                <Line
                  type="monotone"
                  dataKey="dor"
                  name="Dor"
                  stroke={CORES.dor}
                  strokeWidth={2}
                  dot={{ fill: CORES.dor, r: 3, strokeWidth: 0 }}
                  connectNulls
                  strokeDasharray="5 3"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Atual (Último Registro) */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="border-b border-border/30 pb-3">
            <CardTitle className="flex items-center gap-2 font-heading text-base">
              <Activity size={16} className="text-[#C08E3A]" />
              Status Atual (Último Registro)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-center gap-4 pt-6">
            {statusItens.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-4 rounded-xl border border-border/30 bg-muted/30 p-4 transition-colors hover:bg-muted/50"
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${item.cor}15` }}
                  >
                    <Icon size={20} style={{ color: item.cor }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                    <p className="text-lg font-bold tracking-tight">{item.valor}</p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">{item.descricao}</p>
                </div>
              );
            })}

            <p className="mt-1 text-center text-xs text-muted-foreground">
              Data: {new Date(ultimo.data + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <Card className="border-border/40 shadow-sm">
        <CardContent className="py-3 text-center">
          <p className="text-sm text-muted-foreground">
            Total de {dados.length} registro{dados.length !== 1 ? 's' : ''} de evolução
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
