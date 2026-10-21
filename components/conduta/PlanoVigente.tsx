'use client';

/**
 * O plano terapêutico vigente — o que o paciente toma hoje.
 *
 * 🔴 mg/dia APARECE E NÃO EXISTE COMO COLUNA (ADR-0004 D-06, entregável 2 da Sprint 5). É
 * calculado de `cbdMgPorGota × gotasPorDia` na hora de mostrar. Persistir criaria uma segunda
 * verdade: no dia em que o catálogo corrigir o mg/gota, toda linha gravada passaria a mentir —
 * e ninguém descobriria, porque o número continua lá, plausível.
 *
 * 🔴 DENSIDADE É RISCO CLÍNICO AQUI. `DO-44` (d): *"tem que ta bem desenhado intuitivo e nada
 * muito cheio pra nao bagunçar a mente do médico"*. Numa tela que decide dose isso é requisito,
 * não gosto — por isso o cartão mostra a dose, o produto e a data de fim, e nada mais. O resto
 * abre sob demanda.
 */

import { CalendarClock, Droplets, FileSignature, Pill } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatarMg } from '@/lib/conduta/dose';
import { cn } from '@/lib/utils';

import { AvisoReceituario } from './AvisoReceituario';

export interface PlanoVigenteDados {
  dosagemId: string;
  medicamentoId: string;
  medicamentoNome: string;
  marca: string | null;
  gotasPorDia: number;
  mlFrasco: number;
  dataInicio: string;
  dataFimPrevista: string;
  cbdMgPorDia: number | null;
  thcMgPorDia: number | null;
  teorThcPercentual: string | null;
}

interface Props {
  plano: PlanoVigenteDados;
  onAjustar?: (plano: PlanoVigenteDados) => void;
  /** A ponte para a prescrição (ADR-0005 D-04). Ausente = o cartão é só leitura. */
  onPrescrever?: (plano: PlanoVigenteDados) => void;
  className?: string;
}

export function PlanoVigente({ plano, onAjustar, onPrescrever, className }: Props) {
  const diasRestantes = calcularDiasRestantes(plano.dataFimPrevista);
  const acabando = diasRestantes !== null && diasRestantes <= 7;

  return (
    <Card className={cn('animate-fade-up border-0 shadow-sm', className)}>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Pill size={16} className="text-primary shrink-0" />
              <h3 className="font-heading truncate text-base font-semibold">
                {plano.medicamentoNome}
              </h3>
            </div>
            {plano.marca && <p className="text-muted-foreground text-xs">{plano.marca}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            {onPrescrever && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 rounded-xl"
                onClick={() => onPrescrever(plano)}
              >
                <FileSignature size={13} />
                Prescrever
              </Button>
            )}
            {onAjustar && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 rounded-xl"
                onClick={() => onAjustar(plano)}
              >
                Ajustar dose
              </Button>
            )}
          </div>
        </div>

        {/* A dose: gotas em destaque, mg/dia ao lado — nunca um sem o outro. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-foreground font-mono text-2xl font-semibold tabular-nums">
            {plano.gotasPorDia}
          </span>
          <span className="text-muted-foreground text-sm">gotas/dia</span>
          {plano.cbdMgPorDia !== null && (
            <Badge variant="secondary" className="gap-1 font-mono text-xs font-normal">
              <Droplets size={11} />
              CBD {formatarMg(plano.cbdMgPorDia)}/dia
            </Badge>
          )}
          {plano.thcMgPorDia !== null && plano.thcMgPorDia > 0 && (
            <Badge variant="outline" className="font-mono text-xs font-normal">
              THC {formatarMg(plano.thcMgPorDia)}/dia
            </Badge>
          )}
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <CalendarClock size={13} className={acabando ? 'text-[var(--chart-5)]' : undefined} />
          <span>
            Frasco de {plano.mlFrasco} ml · início em {formatarData(plano.dataInicio)}
          </span>
          {diasRestantes !== null && (
            <Badge
              variant={acabando ? 'destructive' : 'outline'}
              className="font-mono text-[0.7rem] font-normal"
            >
              {diasRestantes > 0
                ? `${diasRestantes} dia${diasRestantes === 1 ? '' : 's'} restante${diasRestantes === 1 ? '' : 's'}`
                : 'frasco encerrado'}
            </Badge>
          )}
        </div>

        <AvisoReceituario teorThcPercentual={plano.teorThcPercentual} variante="compacto" />
      </CardContent>
    </Card>
  );
}

/** Cálculo local e tolerante: data inválida some do cartão em vez de derrubá-lo. */
function calcularDiasRestantes(dataFim: string): number | null {
  const fim = new Date(`${dataFim}T00:00:00`);
  if (Number.isNaN(fim.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((fim.getTime() - hoje.getTime()) / 86_400_000));
}

export function formatarData(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR');
}
