'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  FileText,
  Pill,
  Calendar,
  CheckCheck,
} from 'lucide-react';

const NOTIFICACOES_MOCK = [
  { id: '1', tipo: 'renovacao_documento', titulo: 'Documento vencendo', mensagem: 'A autorização Anvisa de Maria Silva vence em 15 dias.', lida: false, data: '2026-05-04' },
  { id: '2', tipo: 'recompra_medicamento', titulo: 'Recompra necessária', mensagem: 'O medicamento de João Santos está previsto para acabar em 7 dias.', lida: false, data: '2026-05-03' },
  { id: '3', tipo: 'consulta_agendada', titulo: 'Nova consulta', mensagem: 'Consulta agendada com Ana Oliveira para 10/05/2026 às 14:00.', lida: true, data: '2026-05-02' },
  { id: '4', tipo: 'renovacao_documento', titulo: 'Receita vencida', mensagem: 'A receita médica de Carlos Lima está vencida. Necessário renovar.', lida: true, data: '2026-05-01' },
];

const TIPO_ICONES: Record<string, typeof Bell> = {
  renovacao_documento: FileText,
  recompra_medicamento: Pill,
  consulta_agendada: Calendar,
  geral: Bell,
};

export default function NotificacoesPage() {
  const [notificacoes, setNotificacoes] = useState(NOTIFICACOES_MOCK);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  const marcarTodasLidas = () => {
    setNotificacoes(notificacoes.map((n) => ({ ...n, lida: true })));
  };

  const marcarLida = (id: string) => {
    setNotificacoes(notificacoes.map((n) => n.id === id ? { ...n, lida: true } : n));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
          <p className="text-sm text-muted-foreground">
            {naoLidas} não lida{naoLidas !== 1 ? 's' : ''}
          </p>
        </div>
        {naoLidas > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={marcarTodasLidas}>
            <CheckCheck className="h-4 w-4" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {notificacoes.map((notif) => {
          const Icon = TIPO_ICONES[notif.tipo] || Bell;
          return (
            <Card
              key={notif.id}
              className={`cursor-pointer border-0 shadow-sm transition-all hover:shadow-md ${!notif.lida ? 'border-l-4 border-l-primary' : 'opacity-70'}`}
              onClick={() => marcarLida(notif.id)}
            >
              <CardContent className="flex items-start gap-4 p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${!notif.lida ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{notif.titulo}</p>
                    {!notif.lida && <Badge className="h-5 text-[10px]">Nova</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{notif.mensagem}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(notif.data).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
