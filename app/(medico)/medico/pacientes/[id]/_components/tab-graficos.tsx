'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon } from '@hugeicons/core-free-icons';
import { listarEvolucoes } from '@/app/_actions/evolucoes';
import { listarAjustesDosagem } from '@/app/_actions/ajustes-dosagem';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TabGraficosProps { pacienteId: string }

const SONO_MAP: Record<string, number> = { ruim: 2, regular: 5, boa: 7, excelente: 10 };

export function TabGraficos({ pacienteId }: TabGraficosProps) {
  const [dadosEvolucao, setDadosEvolucao] = useState<any[]>([]);
  const [dadosDosagem, setDadosDosagem] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [evRes, dosRes] = await Promise.all([
      listarEvolucoes(pacienteId),
      listarAjustesDosagem(pacienteId),
    ]);

    if (evRes.sucesso && evRes.dados) {
      const sorted = [...evRes.dados].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
      setDadosEvolucao(sorted.map(e => ({
        data: new Date(e.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        dor: e.nivelDor ?? null,
        sono: e.qualidadeSono ? SONO_MAP[e.qualidadeSono] ?? null : null,
        bemEstar: e.bemEstar ? SONO_MAP[e.bemEstar] ?? null : null,
      })));
    }

    if (dosRes.sucesso && dosRes.dados) {
      const sorted = [...dosRes.dados].sort((a, b) => new Date(a.dataAjuste).getTime() - new Date(b.dataAjuste).getTime());
      setDadosDosagem(sorted.map(d => ({
        data: new Date(d.dataAjuste + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        medicamentos: d.itens?.length || 0,
      })));
    }

    setCarregando(false);
  }, [pacienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  if (carregando) return <div className="flex justify-center py-16"><HugeiconsIcon icon={Loading03Icon} size={32} className="animate-spin text-primary" /></div>;

  const semDados = dadosEvolucao.length === 0 && dadosDosagem.length === 0;

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-lg font-semibold">Gráficos de Evolução</h2>

      {semDados ? (
        <Card className="border-border/40 shadow-sm"><CardContent className="flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium">Dados insuficientes</p>
          <p className="text-sm text-muted-foreground">Registre evoluções e ajustes de dosagem para gerar gráficos</p>
        </CardContent></Card>
      ) : (
        <>
          {dadosEvolucao.length > 0 && (
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="border-b border-border/30 pb-3"><CardTitle className="font-heading text-base">Indicadores Clínicos ao Longo do Tempo</CardTitle></CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={dadosEvolucao}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="data" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '13px', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                    <Line type="monotone" dataKey="dor" name="Nível de Dor" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} connectNulls />
                    <Line type="monotone" dataKey="sono" name="Qualidade do Sono" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} connectNulls />
                    <Line type="monotone" dataKey="bemEstar" name="Bem-estar" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {dadosDosagem.length > 0 && (
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="border-b border-border/30 pb-3"><CardTitle className="font-heading text-base">Ajustes de Dosagem</CardTitle></CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dadosDosagem}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="data" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '13px', border: '1px solid hsl(var(--border))' }} />
                    <Line type="stepAfter" dataKey="medicamentos" name="Medicamentos" stroke="#C08E3A" strokeWidth={2} dot={{ fill: '#C08E3A', r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
