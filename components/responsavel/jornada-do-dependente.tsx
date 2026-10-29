import { CheckCircle2, Route, ShieldCheck, UserX } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  JORNADA_ORDEM,
  LABEL_JORNADA,
  LABEL_STATUS_DO_PACIENTE,
  primeiroNome,
} from '@/lib/dependentes/rotulos';
import { cn } from '@/lib/utils';

/**
 * A jornada de UM dependente — o mesmo stepper do painel do paciente, com o título que diz DE QUEM é:
 * "Jornada de <nome>" (pedido de Dryelle, 29/10/2026). Nunca "Sua jornada": o responsável não é o paciente.
 *
 * Só existe quando há um dependente. Um responsável sem dependentes não vê este cartão em lugar nenhum.
 */
export function JornadaDoDependente({
  nome,
  fase,
  status,
  medicoNome,
}: {
  nome: string;
  fase: string;
  status: string;
  medicoNome: string | null;
}) {
  const indice = JORNADA_ORDEM.indexOf(fase as (typeof JORNADA_ORDEM)[number]);

  return (
    <Card className="border-border/20 grain h-full overflow-hidden rounded-[1.75rem] border bg-white shadow-sm">
      <CardContent className="space-y-3.5 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl">
              <Route className="text-primary h-4.5 w-4.5" />
            </div>
            <h2 className="font-display text-foreground truncate text-base font-bold">
              Jornada de {primeiroNome(nome)}
            </h2>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[11px] font-bold">
            {LABEL_STATUS_DO_PACIENTE[status] ?? status}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 py-1">
          {JORNADA_ORDEM.map((f, i) => (
            <div key={f} className="flex flex-1 items-center gap-1.5">
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all',
                  i < indice
                    ? 'bg-primary text-primary-foreground'
                    : i === indice
                      ? 'bg-primary text-primary-foreground ring-primary/20 ring-4'
                      : 'bg-muted text-muted-foreground',
                )}
                title={LABEL_JORNADA[f]}
              >
                {i < indice ? <CheckCircle2 size={13} /> : i + 1}
              </div>
              {i < JORNADA_ORDEM.length - 1 && (
                <div
                  className={cn('h-1 flex-1 rounded-full', i < indice ? 'bg-primary' : 'bg-border')}
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-primary text-sm font-bold">{LABEL_JORNADA[fase] ?? fase}</p>

        {medicoNome ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-xs leading-relaxed text-emerald-700">
              {primeiroNome(nome)} é acompanhado por <strong>{medicoNome}</strong>.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <UserX className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs leading-relaxed text-amber-700">
              Nenhum médico atribuído a {primeiroNome(nome)} ainda.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
