'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  FlaskConical,
  Droplets,
  Calendar,
  Calculator,
  Clock,
  TrendingDown,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const GOTAS_POR_ML = 20;

export default function CalculadoraPage() {
  const [mlFrasco, setMlFrasco] = useState('');
  const [gotasPorDia, setGotasPorDia] = useState('');
  const [dataInicio, setDataInicio] = useState('');

  const calculo = useMemo(() => {
    const ml = Number(mlFrasco);
    const gotas = Number(gotasPorDia);
    if (!ml || ml <= 0 || !gotas || gotas <= 0 || !dataInicio) return null;

    const gotasTotais = ml * GOTAS_POR_ML;
    const diasDuracao = Math.floor(gotasTotais / gotas);
    const inicio = new Date(dataInicio + 'T00:00:00');
    const termino = new Date(inicio);
    termino.setDate(termino.getDate() + diasDuracao);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diasRestantes = Math.ceil((termino.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    const diasUsados = Math.max(0, Math.ceil((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)));
    const percentualUsado = Math.min(100, Math.max(0, Math.round((diasUsados / diasDuracao) * 100)));

    const urgente = diasRestantes <= 15 && diasRestantes > 0;
    const encerrado = diasRestantes <= 0;

    return {
      gotasTotais,
      diasDuracao,
      dataTermino: termino,
      diasRestantes,
      diasUsados,
      percentualUsado,
      urgente,
      encerrado,
    };
  }, [mlFrasco, gotasPorDia, dataInicio]);

  const barColor = calculo?.encerrado
    ? 'bg-muted-foreground'
    : calculo?.urgente
      ? 'bg-gradient-to-r from-amber-500 to-red-500'
      : 'bg-gradient-to-r from-primary to-primary/70';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Calculadora</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Calcule quando seu medicamento vai terminar
        </p>
      </div>

      {/* Dica */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Info size={16} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            Informe a quantidade do seu frasco, as gotas que toma por dia e quando começou o uso.
            O sistema calcula automaticamente a previsão de término com base em{' '}
            <strong className="text-foreground">{GOTAS_POR_ML} gotas por ml</strong>.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Formulário */}
        <Card className="border-border/40 shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator size={16} className="text-primary" />
              Dados do Frasco
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* ML do frasco */}
            <div className="space-y-2">
              <Label htmlFor="ml">Quantidade do Frasco (ml)</Label>
              <div className="relative">
                <FlaskConical
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="ml"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Ex: 30"
                  value={mlFrasco}
                  onChange={(e) => setMlFrasco(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Veja no rótulo do frasco. Exemplos: 10ml, 30ml, 60ml.
              </p>
            </div>

            {/* Gotas por dia */}
            <div className="space-y-2">
              <Label htmlFor="gotas">Gotas por Dia</Label>
              <div className="relative">
                <Droplets
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="gotas"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Ex: 6"
                  value={gotasPorDia}
                  onChange={(e) => setGotasPorDia(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Total de gotas que você toma em um dia inteiro.
              </p>
            </div>

            {/* Data de início */}
            <div className="space-y-2">
              <Label htmlFor="dataInicio">Data de Início do Uso</Label>
              <div className="relative">
                <Calendar
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="dataInicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resultado */}
        <div className="lg:col-span-2">
          <Card className="sticky top-6 border-border/40 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock size={16} className="text-primary" />
                Previsão de Término
              </CardTitle>
            </CardHeader>
            <CardContent>
              {calculo ? (
                <div className="space-y-5">
                  {/* Destaque — data de término */}
                  <div className="rounded-xl bg-primary/5 p-4 text-center">
                    <p className="text-xs text-muted-foreground">Previsto para terminar em</p>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      {calculo.dataTermino.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {calculo.diasDuracao} dias de duração total
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Gotas totais no frasco</span>
                      <span className="font-medium">{calculo.gotasTotais}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Dias usados até hoje</span>
                      <span className="font-medium">{calculo.diasUsados}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Dias restantes</span>
                      <Badge
                        variant={
                          calculo.encerrado
                            ? 'secondary'
                            : calculo.urgente
                              ? 'destructive'
                              : 'outline'
                        }
                      >
                        {calculo.encerrado
                          ? 'Possivelmente encerrado'
                          : `${calculo.diasRestantes} dias`}
                      </Badge>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Progresso de uso</span>
                      <span>{calculo.percentualUsado}%</span>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700 ease-out',
                          barColor,
                        )}
                        style={{ width: `${calculo.percentualUsado}%` }}
                      />
                    </div>
                  </div>

                  {/* Alerta urgente */}
                  {calculo.urgente && (
                    <div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-500/10">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        ⚠️ Seu medicamento está acabando! Solicite a recompra em breve.
                      </p>
                      <Link
                        href="/paciente/recompra"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        <TrendingDown size={12} />
                        Solicitar recompra
                      </Link>
                    </div>
                  )}

                  {calculo.encerrado && (
                    <div className="rounded-xl bg-muted p-3 text-center">
                      <p className="text-xs font-medium text-muted-foreground">
                        O medicamento possivelmente já acabou com base na data informada.
                      </p>
                      <Link
                        href="/paciente/recompra"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Solicitar recompra
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <FlaskConical size={36} className="mb-3 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">
                    Preencha os campos ao lado para ver a previsão.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
