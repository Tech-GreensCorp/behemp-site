'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon } from '@hugeicons/core-free-icons';
import { obterDadosGraficosDashboard } from '@/app/_actions/pacientes';
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
  Legend,
  LineChart,
  Line,
} from 'recharts';

/**
 * Componente client com os 3 gráficos Recharts do dashboard do médico.
 * - Barras: distribuição por tipo de tratamento (CBD / THC / CBD + THC)
 * - Pizza: distribuição por status do paciente
 * - Linha: evolução mensal de cadastros
 */

// Cores da paleta do projeto
const CORES_TRATAMENTO = ['#10b981', '#8b5cf6', '#f59e0b', '#6b7280'];
const CORES_STATUS = ['#f59e0b', '#8b5cf6', '#10b981', '#ef4444'];

interface DadosGraficos {
  tratamentos: Array<{ tipo: string; quantidade: number }>;
  statusDistribuicao: Array<{ status: string; quantidade: number }>;
  evolucaoMensal: Array<{ mes: string; pacientes: number }>;
}

export function DashboardCharts() {
  const [dados, setDados] = useState<DadosGraficos | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await obterDadosGraficosDashboard();
    if (res.sucesso && res.dados) {
      setDados(res.dados);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <HugeiconsIcon icon={Loading03Icon} size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!dados) return null;

  const temDadosTratamento = dados.tratamentos.length > 0;
  const temDadosStatus = dados.statusDistribuicao.length > 0;
  const temDadosEvolucao = dados.evolucaoMensal.length > 0;

  if (!temDadosTratamento && !temDadosStatus && !temDadosEvolucao) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium">Dados insuficientes para gráficos</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre pacientes para visualizar as estatísticas
          </p>
        </CardContent>
      </Card>
    );
  }

  const tooltipStyle = {
    borderRadius: '12px',
    fontSize: '13px',
    border: '1px solid hsl(var(--border))',
    backgroundColor: 'hsl(var(--card))',
    color: 'hsl(var(--card-foreground))',
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Gráfico de Barras — Tipos de Tratamento */}
      {temDadosTratamento && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tipos de Tratamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dados.tratamentos} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  type="category"
                  dataKey="tipo"
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  width={90}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, 'Pacientes']} />
                <Bar dataKey="quantidade" radius={[0, 6, 6, 0]} maxBarSize={32}>
                  {dados.tratamentos.map((_, i) => (
                    <Cell key={`bar-${i}`} fill={CORES_TRATAMENTO[i % CORES_TRATAMENTO.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Gráfico de Pizza — Status dos Pacientes */}
      {temDadosStatus && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={dados.statusDistribuicao}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="quantidade"
                  nameKey="status"
                  label={({ status, percent }) =>
                    `${status} (${(percent * 100).toFixed(0)}%)`
                  }
                  labelLine={false}
                >
                  {dados.statusDistribuicao.map((_, i) => (
                    <Cell key={`pie-${i}`} fill={CORES_STATUS[i % CORES_STATUS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, 'Pacientes']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Gráfico de Linha — Evolução Mensal */}
      {temDadosEvolucao && (
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Novos Pacientes por Mês (últimos 6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dados.evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, 'Pacientes']} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="pacientes"
                  name="Novos pacientes"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ fill: '#10b981', r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
