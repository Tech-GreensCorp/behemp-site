'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
} from '@/app/_actions/notificacoes';
import { toast } from 'sonner';
import {
  Bell,
  Calendar,
  CheckCircle2,
  FileCheck,
  Loader2,
  MessageSquare,
  Pill,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataList, DataRow, DataEmpty } from '@/components/shared/data-list';

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

const TIPO_ICONES: Record<string, typeof Bell> = {
  renovacao_documento: FileCheck,
  recompra_medicamento: Pill,
  consulta_agendada: Calendar,
  mensagem_recebida: MessageSquare,
  geral: Bell,
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
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mensagens"
        title="Notificações"
        description={naoLidas > 0 ? `${naoLidas} não lida${naoLidas !== 1 ? 's' : ''}` : 'Tudo em dia'}
        actions={
          naoLidas > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleMarcarTodasLidas}
            >
              <CheckCircle2 size={14} />
              Marcar todas como lidas
            </Button>
          )
        }
      />

      {notifs.length === 0 ? (
        <DataEmpty
          icon={<Bell size={24} />}
          title="Nenhuma notificação"
          description="Quando houver novidades, elas aparecerão aqui"
        />
      ) : (
        <DataList>
          {notifs.map((notif) => {
            const Icon = TIPO_ICONES[notif.tipo] || Bell;
            return (
              <DataRow
                key={notif.id}
                onClick={!notif.lida ? () => handleMarcarLida(notif.id) : undefined}
                className={!notif.lida ? 'bg-primary-soft/30' : 'opacity-70'}
                icon={<Icon size={18} className={!notif.lida ? 'text-primary' : 'text-muted-foreground'} />}
                title={
                  <div className="flex items-center gap-2">
                    {notif.titulo}
                    {!notif.lida && <Badge className="h-5 text-[10px]">Nova</Badge>}
                  </div>
                }
                subtitle={notif.mensagem}
                meta={new Date(notif.createdAt).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              />
            );
          })}
        </DataList>
      )}
    </div>
  );
}
