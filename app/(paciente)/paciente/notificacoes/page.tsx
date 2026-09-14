'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { listarNotificacoes, marcarNotificacaoLida, marcarTodasNotificacoesLidas } from '@/app/_actions/notificacoes';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataList, DataRow, DataEmpty } from '@/components/shared/data-list';
import {
  Bell,
  Calendar,
  CheckCircle2,
  FileText,
  MessageSquare,
  Pill,
  Loader2,
} from 'lucide-react';

/**
 * Página de notificações do paciente.
 * Lista todas as notificações com ações de marcar como lida.
 */

const TIPO_ICONE: Record<string, typeof Bell> = {
  renovacao_documento: FileText,
  recompra_medicamento: Pill,
  consulta_agendada: Calendar,
  consulta_cancelada: Calendar,
  nova_mensagem: MessageSquare,
  geral: Bell,
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
      // Atualiza o badge da sidebar imediatamente
      window.dispatchEvent(new Event('notificacoes-update'));
    }
  }

  async function handleMarcarTodasLidas() {
    const resultado = await marcarTodasNotificacoesLidas();
    if (resultado.sucesso) {
      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
      toast.success('Todas as notificações foram marcadas como lidas');
      // Atualiza o badge da sidebar imediatamente
      window.dispatchEvent(new Event('notificacoes-update'));
    }
  }

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  if (carregando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      
      <PageHeader
        className="animate-fade-up"
        eyebrow="Área do Paciente"
        title="Minhas Notificações"
        description={
          naoLidas > 0
            ? `Você possui ${naoLidas} notificação${naoLidas > 1 ? 'ões' : ''} não lida${naoLidas > 1 ? 's' : ''} pendente${naoLidas > 1 ? 's' : ''}.`
            : 'Você está em dia! Todas as notificações foram lidas.'
        }
        actions={
          naoLidas > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarcarTodasLidas}
              className="rounded-full gap-2 text-xs font-semibold border-border/40 hover:bg-accent h-10 px-5 cursor-pointer shrink-0"
            >
              <CheckCircle2 size={14} />
              Marcar todas como lidas
            </Button>
          )
        }
      />

      {/* Lista */}
      {notificacoes.length === 0 ? (
        <DataEmpty
          icon={<Bell size={24} />}
          title="Nenhuma notificação"
          description="Quando houver atualizações sobre seu tratamento, elas aparecerão aqui."
        />
      ) : (
        <DataList className="animate-fade-up">
          {notificacoes.map((notificacao) => {
            const Icone = TIPO_ICONE[notificacao.tipo] || Bell;
            const cor = TIPO_COR[notificacao.tipo] || TIPO_COR.geral;

            return (
              <DataRow
                key={notificacao.id}
                className={!notificacao.lida ? undefined : 'opacity-70'}
                icon={
                  <div className={cn('flex h-full w-full items-center justify-center rounded-full', cor)}>
                    <Icone size={18} />
                  </div>
                }
                title={
                  <div className="flex flex-wrap items-center gap-2">
                    {notificacao.titulo}
                    {!notificacao.lida && (
                      <Badge className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                        Nova
                      </Badge>
                    )}
                  </div>
                }
                subtitle={notificacao.mensagem}
                meta={new Date(notificacao.createdAt).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                trailing={
                  !notificacao.lida && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMarcarLida(notificacao.id)}
                      className="h-8 w-8 shrink-0 rounded-xl"
                      title="Marcar como lida"
                    >
                      <CheckCircle2 size={16} />
                    </Button>
                  )
                }
              />
            );
          })}
        </DataList>
      )}
    </div>
  );
}

