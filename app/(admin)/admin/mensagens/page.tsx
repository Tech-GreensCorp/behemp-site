'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { listarContatos, atualizarStatusContato, responderContato } from '@/app/(public)/_actions/contato';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Calendar,
  CheckCircle2,
  Eye,
  Mail,
  MessageSquare,
  Reply,
  Send,
  User,
  X,
} from 'lucide-react';

/**
 * Página admin de mensagens recebidas via formulário de contato.
 * Inclui painel de resposta inline com envio via Brevo.
 */

const STATUS_CONFIG: Record<
  string,
  { label: string; cor: string }
> = {
  nao_lida: { label: 'Não lida', cor: 'bg-amber-500/10 text-amber-600' },
  lida: { label: 'Lida', cor: 'bg-sky-500/10 text-sky-600' },
  respondida: { label: 'Respondida', cor: 'bg-emerald-500/10 text-emerald-600' },
};

interface Contato {
  id: string;
  nome: string;
  email: string;
  assunto: string;
  mensagem: string;
  statusLeitura: string;
  createdAt: Date;
}

export default function MensagensAdminPage() {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [contatoSelecionado, setContatoSelecionado] = useState<Contato | null>(null);

  // Estado do painel de resposta
  const [respondendo, setRespondendo] = useState(false);
  const [respostaTexto, setRespostaTexto] = useState('');
  const [enviandoResposta, setEnviandoResposta] = useState(false);

  useEffect(() => {
    carregarContatos();
  }, []);

  // Reseta o painel de resposta ao trocar de mensagem
  useEffect(() => {
    setRespondendo(false);
    setRespostaTexto('');
  }, [contatoSelecionado?.id]);

  async function carregarContatos() {
    const resultado = await listarContatos();
    if (resultado.sucesso && resultado.dados) {
      setContatos(resultado.dados as Contato[]);
    }
    setCarregando(false);
  }

  async function handleVisualizarContato(contato: Contato) {
    setContatoSelecionado(contato);

    if (contato.statusLeitura === 'nao_lida') {
      await atualizarStatusContato(contato.id, 'lida');
      setContatos((prev) =>
        prev.map((c) =>
          c.id === contato.id ? { ...c, statusLeitura: 'lida' } : c,
        ),
      );
      // Notifica o sidebar para atualizar o badge
      window.dispatchEvent(new CustomEvent('mensagens-atualizadas'));
    }
  }

  async function handleMarcarRespondida(contatoId: string) {
    const resultado = await atualizarStatusContato(contatoId, 'respondida');
    if (resultado.sucesso) {
      setContatos((prev) =>
        prev.map((c) =>
          c.id === contatoId ? { ...c, statusLeitura: 'respondida' } : c,
        ),
      );
      setContatoSelecionado(null);
      toast.success('Mensagem marcada como respondida');
      // Notifica o sidebar para atualizar o badge
      window.dispatchEvent(new CustomEvent('mensagens-atualizadas'));
    }
  }

  async function handleEnviarResposta() {
    if (!contatoSelecionado || !respostaTexto.trim()) return;

    setEnviandoResposta(true);
    try {
      const resultado = await responderContato(
        contatoSelecionado.id,
        {
          nome: contatoSelecionado.nome,
          email: contatoSelecionado.email,
          assunto: contatoSelecionado.assunto,
          mensagem: contatoSelecionado.mensagem,
        },
        respostaTexto,
      );

      if (resultado.sucesso) {
        // Atualiza localmente
        setContatos((prev) =>
          prev.map((c) =>
            c.id === contatoSelecionado.id ? { ...c, statusLeitura: 'respondida' } : c,
          ),
        );
        toast.success(`Resposta enviada para ${contatoSelecionado.email}`);
        window.dispatchEvent(new CustomEvent('mensagens-atualizadas'));
        setContatoSelecionado(null);
      } else {
        toast.error(resultado.erro || 'Erro ao enviar resposta');
      }
    } finally {
      setEnviandoResposta(false);
    }
  }

  const naoLidas = contatos.filter((c) => c.statusLeitura === 'nao_lida').length;

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
          <h1 className="text-2xl font-bold tracking-tight">Mensagens</h1>
          <p className="text-sm text-muted-foreground">
            {contatos.length} mensagem{contatos.length !== 1 ? 'ns' : ''} recebida{contatos.length !== 1 ? 's' : ''}
            {naoLidas > 0 && ` · ${naoLidas} não lida${naoLidas > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Lista vazia */}
      {contatos.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Mail size={48} className="mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium">Nenhuma mensagem recebida</p>
            <p className="text-sm text-muted-foreground">
              Quando alguém preencher o formulário de contato, as mensagens aparecerão aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {contatos.map((contato) => {
            const config = STATUS_CONFIG[contato.statusLeitura] || STATUS_CONFIG.nao_lida;
            return (
              <Card
                key={contato.id}
                className={cn(
                  'cursor-pointer border-0 shadow-sm transition-all hover:shadow-md',
                  contato.statusLeitura === 'nao_lida' && 'ring-1 ring-primary/20',
                )}
                onClick={() => handleVisualizarContato(contato)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <MessageSquare size={20} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{contato.nome}</p>
                    <p className="truncate text-sm text-muted-foreground">{contato.assunto}</p>
                  </div>
                  <div className="hidden items-center gap-3 sm:flex">
                    <span className="text-xs text-muted-foreground">
                      {new Date(contato.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                    <Badge className={cn('border-0 font-medium', config.cor)}>
                      {config.label}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Eye size={18} />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* ══ Modal de detalhe + painel de resposta ══════ */}
      {/* ═══════════════════════════════════════════════ */}
      {contatoSelecionado && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8 pb-8 backdrop-blur-sm sm:items-center sm:pt-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setContatoSelecionado(null);
          }}
        >
          <div className="relative w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="overflow-hidden rounded-xl bg-card shadow-2xl">

              {/* Hero */}
              <div className="relative overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-primary/80 px-6 pt-6 pb-4 text-white sm:px-8">
                <div className="absolute inset-0 opacity-[0.06]" style={{
                  backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                  backgroundSize: '24px 24px',
                }} />

                <div className="relative flex items-start justify-between">
                  <div className="flex-1">
                    <Badge className={cn(
                      'mb-3 border-0 px-2.5 py-0.5 text-[11px] font-semibold',
                      contatoSelecionado.statusLeitura === 'nao_lida' && 'bg-amber-400/20 text-amber-100',
                      contatoSelecionado.statusLeitura === 'lida' && 'bg-white/20 text-white',
                      contatoSelecionado.statusLeitura === 'respondida' && 'bg-emerald-400/20 text-emerald-100',
                    )}>
                      {STATUS_CONFIG[contatoSelecionado.statusLeitura]?.label}
                    </Badge>

                    <h2 className="text-2xl font-bold leading-tight">{contatoSelecionado.nome}</h2>

                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/80">
                      <span className="flex items-center gap-1.5">
                        <Mail size={14} />
                        {contatoSelecionado.email}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        {new Date(contatoSelecionado.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: 'long', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setContatoSelecionado(null)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Assunto */}
                <div className="relative mt-3 rounded-lg bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/60">Assunto</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{contatoSelecionado.assunto}</p>
                </div>
              </div>

              {/* Corpo — Mensagem */}
              <div className="px-6 py-5 sm:px-8">
                <div className="flex items-center gap-3 pb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <User size={16} />
                  </div>
                  <h3 className="text-sm font-bold tracking-tight">Mensagem</h3>
                </div>

                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {contatoSelecionado.mensagem}
                  </p>
                </div>

                {/* ── Painel de Resposta ──────────────────────── */}
                <div className={cn(
                  'mt-4 overflow-hidden rounded-xl border transition-all duration-300',
                  respondendo
                    ? 'border-primary/30 bg-primary/[0.03]'
                    : 'border-dashed border-muted-foreground/20 bg-transparent',
                )}>
                  {!respondendo ? (
                    /* Botão para abrir o painel */
                    <button
                      onClick={() => setRespondendo(true)}
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                    >
                      <Reply size={16} />
                      Escrever resposta
                    </button>
                  ) : (
                    /* Área de composição da resposta */
                    <div className="p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                            <Reply size={14} className="text-primary" />
                          </div>
                          <div>
                            <p className="text-xs font-bold tracking-wide text-foreground">Responder</p>
                            <p className="text-[11px] text-muted-foreground">
                              Para: <span className="font-medium text-foreground">{contatoSelecionado.email}</span>
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setRespondendo(false)}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <X size={13} />
                        </button>
                      </div>

                      <Textarea
                        id="resposta-contato"
                        placeholder={`Olá, ${contatoSelecionado.nome.split(' ')[0]}! Obrigado por entrar em contato...`}
                        value={respostaTexto}
                        onChange={(e) => setRespostaTexto(e.target.value)}
                        rows={5}
                        className="mb-3 resize-none border-muted/50 bg-background/80 text-sm focus-visible:ring-primary/30"
                      />

                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-muted-foreground">
                          {respostaTexto.length} caracteres
                        </p>
                        <Button
                          onClick={handleEnviarResposta}
                          disabled={!respostaTexto.trim() || enviandoResposta}
                          size="sm"
                          className="gap-2 bg-primary text-white hover:bg-primary/90"
                        >
                          {enviandoResposta ? (
                            <>
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              Enviando…
                            </>
                          ) : (
                            <>
                              <Send size={14} />
                              Enviar resposta
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-col gap-3 border-t px-6 py-5 sm:flex-row sm:items-center sm:justify-end sm:px-8">
                <Button variant="ghost" onClick={() => setContatoSelecionado(null)}>
                  Fechar
                </Button>
                {contatoSelecionado.statusLeitura !== 'respondida' && (
                  <Button
                    onClick={() => handleMarcarRespondida(contatoSelecionado.id)}
                    variant="outline"
                    className="gap-2"
                  >
                    <CheckCircle2 size={16} />
                    Marcar como respondida
                  </Button>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
