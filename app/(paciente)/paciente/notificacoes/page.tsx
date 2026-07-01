'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { listarNotificacoes, marcarNotificacaoLida, marcarTodasNotificacoesLidas } from '@/app/_actions/notificacoes';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
      
      {/* ── Header Editorial ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-up">
        <div>
          <p className="text-primary mb-4 text-xs font-semibold tracking-[0.25em] uppercase">
            Área do Paciente
          </p>
          <h1 className="font-display text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl text-foreground">
            Minhas <span className="text-accent-italic">Notificações</span>
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed">
            {naoLidas > 0
              ? `Você possui ${naoLidas} notificação${naoLidas > 1 ? 'ões' : ''} não lida${naoLidas > 1 ? 's' : ''} pendente${naoLidas > 1 ? 's' : ''}.`
              : 'Você está em dia! Todas as notificações foram lidas.'}
          </p>
        </div>
        {naoLidas > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleMarcarTodasLidas} 
            className="rounded-full gap-2 text-xs font-semibold border-border/40 hover:bg-accent h-10 px-5 cursor-pointer shrink-0 self-start sm:self-center"
          >
            <CheckCircle2 size={14} />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {/* Lista / Card Vazio */}
      {notificacoes.length === 0 ? (
        <Card className="border border-border/30 bg-white shadow-sm rounded-3xl overflow-hidden transition-all hover:shadow-md animate-fade-up max-w-lg mx-auto text-center">
          <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 relative grain">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bell className="h-8 w-8" />
            </div>
            <h3 className="font-display text-2xl font-bold text-foreground">Nenhuma notificação</h3>
            <p className="mt-3 text-sm text-muted-foreground max-w-xs leading-relaxed">
              Quando houver atualizações sobre seu tratamento, elas aparecerão aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 animate-fade-up">
          {notificacoes.map((notificacao) => {
            const Icone = TIPO_ICONE[notificacao.tipo] || Bell;
            const cor = TIPO_COR[notificacao.tipo] || TIPO_COR.geral;

            return (
              <Card
                key={notificacao.id}
                className={cn(
                  "border border-border/30 bg-white shadow-sm rounded-3xl overflow-hidden transition-all hover:shadow-md",
                  !notificacao.lida ? "ring-1 ring-primary/20" : "opacity-75 bg-white/70"
                )}
              >
                <CardContent className="flex items-start gap-4 p-5">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", cor)}>
                    <Icone size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground text-sm leading-snug">{notificacao.titulo}</p>
                      {!notificacao.lida && (
                        <Badge className="bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">Nova</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{notificacao.mensagem}</p>
                    <p className="mt-2 text-xs text-muted-foreground/60 flex items-center gap-1.5">
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
                      className="shrink-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent h-8 w-8 cursor-pointer"
                      title="Marcar como lida"
                    >
                      <CheckCircle2 size={16} />
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

