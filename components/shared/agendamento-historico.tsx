'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History } from 'lucide-react';
import type { HistoricoAgendamentoItem } from '@/app/(public)/_actions/agendamento';

function formatarValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function iniciaisDoNome(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

const STATUS_LABEL: Record<HistoricoAgendamentoItem['status'], string> = {
  reservada: 'Aguardando pagamento',
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
};

const STATUS_CLASSE: Record<HistoricoAgendamentoItem['status'], string> = {
  reservada: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  agendada: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400',
  confirmada: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400',
  realizada: 'bg-muted text-muted-foreground',
  cancelada: 'bg-muted text-muted-foreground line-through decoration-1',
};

interface AgendamentoHistoricoProps {
  items: HistoricoAgendamentoItem[];
}

/**
 * Histórico/resumo dos agendamentos e reservas do paciente — sempre visível na tela de
 * agendamento, independente da etapa do wizard, para dar contexto de status e prazo.
 */
export function AgendamentoHistorico({ items }: AgendamentoHistoricoProps) {
  if (items.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History size={16} className="text-primary" />
          Seus agendamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => {
          const dataHora = new Date(item.dataHora);
          const expirado = item.status === 'cancelada';
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border/50 p-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {item.medicoAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.medicoAvatarUrl}
                    alt={item.medicoNome}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  iniciaisDoNome(item.medicoNome)
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${expirado ? 'text-muted-foreground' : ''}`}>
                  {item.medicoNome}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(dataHora, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  {item.status === 'reservada' && item.expiraEm && (
                    <>
                      {' '}
                      · prazo{' '}
                      {new Date(item.expiraEm).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </>
                  )}
                </p>
              </div>

              {item.valor !== null && (
                <p className="hidden shrink-0 text-sm font-medium text-muted-foreground sm:block">
                  {item.moeda} {formatarValor(item.valor)}
                </p>
              )}

              <Badge className={`shrink-0 font-normal ${STATUS_CLASSE[item.status]}`}>
                {STATUS_LABEL[item.status]}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
