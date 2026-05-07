'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Loading03Icon,
  Notification03Icon,
  FileValidationIcon,
  MedicineBottle01Icon,
  Calendar03Icon,
  Message01Icon,
  CheckmarkCircle01Icon,
} from '@hugeicons/core-free-icons';
import {
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
} from '@/app/_actions/notificacoes';
import { toast } from 'sonner';

/**
 * Página de notificações do médico — dados reais do banco.
 */

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  linkAcao: string | null;
  createdAt: Date;
}

const TIPO_ICONES: Record<string, typeof Notification03Icon> = {
  renovacao_documento: FileValidationIcon,
  recompra_medicamento: MedicineBottle01Icon,
  consulta_agendada: Calendar03Icon,
  mensagem_recebida: Message01Icon,
  geral: Notification03Icon,
};

export default function NotificacoesPage() {
  const [notifs, setNotifs] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarNotificacoes();
    if (res.sucesso && res.dados) {
      setNotifs(res.dados as Notificacao[]);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const naoLidas = notifs.filter((n) => !n.lida).length;

  async function handleMarcarLida(id: string) {
    const res = await marcarNotificacaoLida(id);
    if (res.sucesso) {
      setNotifs((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lida: true } : n)),
      );
    }
  }

  async function handleMarcarTodasLidas() {
    const res = await marcarTodasNotificacoesLidas();
    if (res.sucesso) {
      setNotifs((prev) => prev.map((n) => ({ ...n, lida: true })));
      toast.success('Todas as notificações foram marcadas como lidas');
    }
  }

  if (carregando) {
    return (
      <div className="flex justify-center py-20">
        <HugeiconsIcon icon={Loading03Icon} size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
          <p className="text-sm text-muted-foreground">
            {naoLidas > 0
              ? `${naoLidas} não lida${naoLidas !== 1 ? 's' : ''}`
              : 'Tudo em dia'}
          </p>
        </div>
        {naoLidas > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleMarcarTodasLidas}
          >
            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {notifs.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <HugeiconsIcon icon={Notification03Icon} size={40} className="mb-3 text-muted-foreground/40" />
            <p className="text-lg font-medium">Nenhuma notificação</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Quando houver novidades, elas aparecerão aqui
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifs.map((notif) => {
            const Icon = TIPO_ICONES[notif.tipo] || Notification03Icon;
            return (
              <Card
                key={notif.id}
                className={`cursor-pointer border-0 shadow-sm transition-all hover:shadow-md ${
                  !notif.lida ? 'border-l-4 border-l-primary' : 'opacity-70'
                }`}
                onClick={() => !notif.lida && handleMarcarLida(notif.id)}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      !notif.lida
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <HugeiconsIcon icon={Icon} size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{notif.titulo}</p>
                      {!notif.lida && (
                        <Badge className="h-5 text-[10px]">Nova</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {notif.mensagem}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(notif.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
