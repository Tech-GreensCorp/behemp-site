'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Pill,
  ShoppingCart,
  AlertTriangle,
  Calendar,
  Loader2,
  Droplets,
  FlaskConical,
  Clock,
} from 'lucide-react';
import { listarMeusMedicamentos } from '@/app/_actions/medicamentos-paciente';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Medicamento {
  id: string;
  medicamentoNome: string;
  gotasPorDia: number;
  mlFrasco: number;
  dataInicio: string;
  dataFimPrevista: string;
  ativa: boolean;
  diasRestantes: number;
  diasTotais: number;
  percentualConsumo: number;
}

export default function MedicamentosPage() {
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarMeusMedicamentos();
    if (res.sucesso && res.dados) {
      setMedicamentos(res.dados);
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (carregando) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const ativas = medicamentos.filter((m) => m.ativa);
  const encerradas = medicamentos.filter((m) => !m.ativa);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Medicamentos</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Acompanhe seus medicamentos e solicite recompra
        </p>
      </div>

      {/* Empty state */}
      {medicamentos.length === 0 && (
        <Card className="border-border/40 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Pill className="h-8 w-8 text-primary/60" />
            </div>
            <p className="text-lg font-semibold">Nenhum medicamento prescrito</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Seu médico responsável irá configurar sua dosagem. Caso já tenha consultado, entre em contato pelo chat.
            </p>
            <Link
              href="/paciente/chat"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Falar com a equipe
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Dosagens ativas */}
      {ativas.length > 0 && (
        <div className="space-y-4">
          {ativas.map((med) => {
            const urgente = med.diasRestantes <= 15;
            const barColor = urgente
              ? 'bg-gradient-to-r from-amber-500 to-red-500'
              : 'bg-gradient-to-r from-primary to-primary/70';

            return (
              <Card key={med.id} className="border-border/40 shadow-sm transition-shadow hover:shadow-md animate-fade-up">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                        <Pill className="h-4 w-4 text-primary" />
                      </div>
                      {med.medicamentoNome}
                    </CardTitle>
                    <Badge className="rounded-lg">Ativa</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Info grid */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Dosagem</p>
                        <p className="text-sm font-semibold">{med.gotasPorDia} gotas/dia</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Frasco</p>
                        <p className="text-sm font-semibold">{med.mlFrasco}ml</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Previsão de término</p>
                        <p className="text-sm font-semibold">
                          {new Date(med.dataFimPrevista + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Consumo</span>
                      <span className={cn('font-medium', urgente && 'text-amber-600')}>
                        {med.diasRestantes} {med.diasRestantes === 1 ? 'dia restante' : 'dias restantes'}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700 ease-out', barColor)}
                        style={{ width: `${med.percentualConsumo}%` }}
                      />
                    </div>
                  </div>

                  {/* Alerta de recompra */}
                  {urgente && (
                    <div className="flex items-center justify-between rounded-xl bg-amber-50 p-4 dark:bg-amber-500/10">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>
                          {med.diasRestantes === 0
                            ? 'Medicamento possivelmente encerrado'
                            : `Medicamento acabando em ${med.diasRestantes} dias`}
                        </span>
                      </div>
                      <Link
                        href="/paciente/recompra"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Solicitar recompra
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dosagens encerradas */}
      {encerradas.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-heading text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Dosagens encerradas
          </h2>
          {encerradas.map((med) => (
            <Card key={med.id} className="border-border/40 opacity-60 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                    <Pill className="h-4 w-4 text-muted-foreground" />
                    {med.medicamentoNome}
                  </CardTitle>
                  <Badge variant="outline" className="rounded-lg">Encerrada</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Dosagem</p>
                    <p className="text-sm font-medium">{med.gotasPorDia} gotas/dia</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Frasco</p>
                    <p className="text-sm font-medium">{med.mlFrasco}ml</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Previsão de término</p>
                    <p className="text-sm font-medium">
                      {new Date(med.dataFimPrevista + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {new Date(med.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} —{' '}
                    {new Date(med.dataFimPrevista + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
