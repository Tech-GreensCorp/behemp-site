'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Notification03Icon,
  CheckmarkCircle01Icon,
  Calendar01Icon,
  MedicineBottle01Icon,
  File01Icon,
  Message01Icon,
} from '@hugeicons/core-free-icons';
import { listarNotificacoes, marcarNotificacaoLida, marcarTodasNotificacoesLidas } from '@/app/_actions/notificacoes';
import { toast } from 'sonner';

/**
 * Página de notificações do paciente.
 * Lista todas as notificações com ações de marcar como lida.
 */

const TIPO_ICONE: Record<string, typeof Notification03Icon> = {
  renovacao_documento: File01Icon,
  recompra_medicamento: MedicineBottle01Icon,
  consulta_agendada: Calendar01Icon,
  consulta_cancelada: Calendar01Icon,
  nova_mensagem: Message01Icon,
  geral: Notification03Icon,
};

const TIPO_COR: Record<string, string> = {
  renovacao_documento: 'bg-amber-500/10 text-amber-600',
  recompra_medicamento: 'bg-primary/10 text-primary',
  consulta_agendada: 'bg-emerald-500/10 text-emerald-600',
  consulta_cancelada: 'bg-red-500/10 text-red-600',
  nova_mensagem: 'bg-blue-500/10 text-blue-600',
  geral: 'bg-muted text-muted-foreground',
};

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  linkAcao: string | null;
  createdAt: Date;
}

export default function NotificacoesPacientePage() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarNotificacoes();
  }, []);

  async function carregarNotificacoes() {
    const resultado = await listarNotificacoes();
    if (resultado.sucesso && resultado.dados) {
      setNotificacoes(resultado.dados as Notificacao[]);
    }
    setCarregando(false);
  }

  async function handleMarcarLida(id: string) {
    const resultado = await marcarNotificacaoLida(id);
    if (resultado.sucesso) {
      setNotificacoes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lida: true } : n)),
      );
    }
  }

  async function handleMarcarTodasLidas() {
    const resultado = await marcarTodasNotificacoesLidas();
    if (resultado.sucesso) {
      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
      toast.success('Todas as notificações foram marcadas como lidas');
    }
  }

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  if (carregando) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
          <p className="text-sm text-muted-foreground">
            {naoLidas > 0
              ? `${naoLidas} notificação${naoLidas > 1 ? 'ões' : ''} não lida${naoLidas > 1 ? 's' : ''}`
              : 'Todas as notificações foram lidas'}
          </p>
        </div>
        {naoLidas > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarcarTodasLidas} className="gap-2">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {/* Lista */}
      {notificacoes.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HugeiconsIcon icon={Notification03Icon} size={48} className="mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium">Nenhuma notificação</p>
            <p className="text-sm text-muted-foreground">
              Quando houver algo novo, você verá aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notificacoes.map((notificacao) => {
            const Icone = TIPO_ICONE[notificacao.tipo] || Notification03Icon;
            const cor = TIPO_COR[notificacao.tipo] || TIPO_COR.geral;

            return (
              <Card
                key={notificacao.id}
                className={`border-0 shadow-sm transition-all ${!notificacao.lida ? 'ring-1 ring-primary/20' : 'opacity-75'}`}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cor}`}>
                    <HugeiconsIcon icon={Icone} size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{notificacao.titulo}</p>
                      {!notificacao.lida && (
                        <Badge variant="default" className="text-[10px]">Nova</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{notificacao.mensagem}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(notificacao.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {!notificacao.lida && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMarcarLida(notificacao.id)}
                      className="shrink-0"
                      title="Marcar como lida"
                    >
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
