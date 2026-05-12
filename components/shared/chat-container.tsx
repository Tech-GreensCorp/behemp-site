'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  listarGrupos,
  listarMensagens,
  enviarMensagem,
  marcarComoLida,
  buscarUsuariosChat,
  criarGrupo,
  excluirGrupo,
  excluirMensagem,
  editarMensagem,
} from '@/app/_actions/chat';
import { getPusherClient, canalChat, canalUsuario, EVENTOS_PUSHER } from '@/lib/integrations/pusher/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Stethoscope,
  User,
  Trash2,
  Pencil,
  X,
  Check,
  XCircle,
} from 'lucide-react';

/**
 * Componente de chat reutilizável — usado tanto na área do paciente
 * quanto na área do médico.
 */

interface ChatContainerProps {
  /** Role do usuário atual — afeta labels e estilo das mensagens */
  roleAtual: 'paciente' | 'medico' | 'admin';
  /** Título exibido no header */
  titulo?: string;
  /** Subtítulo */
  subtitulo?: string;
  /** Callback para notificar o parent sobre total de não-lidas (para badge na sidebar) */
  onNaoLidasChange?: (total: number) => void;
}

interface Grupo {
  id: string;
  nome: string | null;
  tipo: string;
  ultimaMensagem: string | null;
  ultimaMensagemData: string | null;
  participantes: Array<{ id: string; nome: string; role: string | null }>;
  naoLidas: number;
}

interface MensagemItem {
  id: string;
  autorId: string;
  autorNome: string;
  autorRole: string | null;
  conteudo: string;
  criadoEm: string;
}

export function ChatContainer({
  roleAtual,
  titulo = 'Chat',
  subtitulo = 'Converse em tempo real',
  onNaoLidasChange,
}: ChatContainerProps) {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoAtivo, setGrupoAtivo] = useState<string | null>(null);
  const [meuUserId, setMeuUserId] = useState<string | null>(null);
  const [mensagensLista, setMensagensLista] = useState<MensagemItem[]>([]);
  const [textoMensagem, setTextoMensagem] = useState('');
  const [carregandoGrupos, setCarregandoGrupos] = useState(true);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [usuariosEncontrados, setUsuariosEncontrados] = useState<
    Array<{ id: string; nome: string; email: string; role: string | null }>
  >([]);
  const [buscandoUsuarios, setBuscandoUsuarios] = useState(false);

  // Context menu de conversas (botão direito)
  const [ctxGrupo, setCtxGrupo] = useState<{ x: number; y: number; grupoId: string } | null>(null);
  // Menu de ações de mensagem
  const [menuMsg, setMenuMsg] = useState<string | null>(null);
  // Edição inline de mensagem
  const [editandoMsg, setEditandoMsg] = useState<{ id: string; conteudo: string } | null>(null);

  const mensagensRef = useRef<HTMLDivElement>(null);

  // Carregar grupos
  const carregarGrupos = useCallback(async () => {
    setCarregandoGrupos(true);
    const res = await listarGrupos();
    if (res.sucesso && res.dados) {
      setGrupos(res.dados.grupos);
      setMeuUserId(res.dados.meuUserId);
    }
    setCarregandoGrupos(false);
  }, []);

  useEffect(() => {
    carregarGrupos();
  }, [carregarGrupos]);

  // Notificar parent sobre total de não-lidas sempre que os grupos mudam
  useEffect(() => {
    if (onNaoLidasChange) {
      const total = grupos.reduce((acc, g) => acc + g.naoLidas, 0);
      onNaoLidasChange(total);
    }
  }, [grupos, onNaoLidasChange]);

  // Carregar mensagens de um grupo
  const carregarMensagens = useCallback(async (gId: string) => {
    setCarregandoMensagens(true);
    const res = await listarMensagens(gId);
    if (res.sucesso && res.dados) {
      setMensagensLista(res.dados);
    }
    setCarregandoMensagens(false);

    await marcarComoLida(gId);
    setGrupos((prev) =>
      prev.map((g) => (g.id === gId ? { ...g, naoLidas: 0 } : g)),
    );
  }, []);

  // Selecionar grupo
  const selecionarGrupo = useCallback(
    (gId: string) => {
      setGrupoAtivo(gId);
      carregarMensagens(gId);
    },
    [carregarMensagens],
  );

  // Scroll automático
  useEffect(() => {
    if (mensagensRef.current) {
      mensagensRef.current.scrollTop = mensagensRef.current.scrollHeight;
    }
  }, [mensagensLista]);

  // Pusher: subscribe a TODOS os grupos do usuário para atualizar badges e mensagens
  useEffect(() => {
    if (grupos.length === 0) return;

    try {
      const pusher = getPusherClient();
      const canaisInscritos: string[] = [];

      grupos.forEach((g) => {
        const canal = canalChat(g.id);
        const channel = pusher.subscribe(canal);
        canaisInscritos.push(canal);

        channel.bind(
          EVENTOS_PUSHER.NOVA_MENSAGEM,
          (data: {
            id: string;
            autorId: string;
            autorNome: string;
            autorRole?: string | null;
            conteudo: string;
            criadoEm: string;
          }) => {
            // Ignorar mensagens do próprio usuário (já adicionadas via optimistic update)
            if (data.autorId === meuUserId) return;

            if (g.id === grupoAtivo) {
              // Grupo ativo: adicionar mensagem na lista visual
              setMensagensLista((prev) => {
                if (prev.some((m) => m.id === data.id)) return prev;
                return [
                  ...prev,
                  {
                    id: data.id,
                    autorId: data.autorId,
                    autorNome: data.autorNome,
                    autorRole: data.autorRole ?? null,
                    conteudo: data.conteudo,
                    criadoEm: data.criadoEm,
                  },
                ];
              });
              // Marcar como lida automaticamente
              marcarComoLida(g.id);
            } else {
              // Outro grupo: incrementar badge de não-lidas
              setGrupos((prev) =>
                prev.map((gr) =>
                  gr.id === g.id ? { ...gr, naoLidas: gr.naoLidas + 1, ultimaMensagem: data.conteudo } : gr,
                ),
              );
            }
          },
        );
      });

      return () => {
        canaisInscritos.forEach((canal) => pusher.unsubscribe(canal));
      };
    } catch {
      console.warn('[Chat] Pusher não disponível — modo somente banco.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupos.map((g) => g.id).join(','), grupoAtivo, meuUserId]);

  // Enviar mensagem — optimistic update sem reload
  async function handleEnviar() {
    if (!textoMensagem.trim() || !grupoAtivo) return;
    const conteudo = textoMensagem.trim();
    setEnviando(true);
    setTextoMensagem('');

    // Optimistic: adicionar a mensagem localmente de imediato
    const tempId = `temp-${Date.now()}`;
    const agora = new Date().toISOString();

    setMensagensLista((prev) => [
      ...prev,
      {
        id: tempId,
        autorId: meuUserId ?? '__self__',
        autorNome: 'Você',
        autorRole: roleAtual,
        conteudo,
        criadoEm: agora,
      },
    ]);

    // Atualizar última mensagem na lista de grupos
    setGrupos((prev) =>
      prev.map((g) =>
        g.id === grupoAtivo
          ? { ...g, ultimaMensagem: conteudo, ultimaMensagemData: agora }
          : g,
      ),
    );

    const res = await enviarMensagem({
      grupoId: grupoAtivo,
      conteudo,
    });

    if (res.sucesso && res.dados) {
      // Substituir a mensagem temporária pelo ID real do banco
      setMensagensLista((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, id: res.dados!.mensagemId } : m,
        ),
      );
    } else {
      // Reverter optimistic update em caso de erro
      setMensagensLista((prev) => prev.filter((m) => m.id !== tempId));
      toast.error(res.erro ?? 'Erro ao enviar mensagem');
    }

    setEnviando(false);
  }

  // Buscar usuários
  async function handleBuscarUsuarios() {
    setBuscandoUsuarios(true);
    const res = await buscarUsuariosChat(buscaUsuario);
    if (res.sucesso && res.dados) {
      setUsuariosEncontrados(res.dados);
    }
    setBuscandoUsuarios(false);
  }

  // Nova conversa
  async function handleIniciarConversa(outroUserId: string) {
    const res = await criarGrupo({
      tipo: 'direto',
      participanteIds: [outroUserId],
    });

    if (res.sucesso && res.dados) {
      setDialogAberto(false);
      setBuscaUsuario('');
      setUsuariosEncontrados([]);
      await carregarGrupos();
      selecionarGrupo(res.dados.grupoId);
    } else {
      toast.error(res.erro ?? 'Erro ao criar conversa');
    }
  }

  // Context menu da conversa (botão direito)
  function handleContextMenuGrupo(e: React.MouseEvent, grupoId: string) {
    e.preventDefault();
    setCtxGrupo({ x: e.clientX, y: e.clientY, grupoId });
  }

  // Excluir conversa
  async function handleExcluirGrupo(grupoId: string) {
    setCtxGrupo(null);
    const res = await excluirGrupo(grupoId);
    if (res.sucesso) {
      toast.success('Conversa excluída');
      if (grupoAtivo === grupoId) {
        setGrupoAtivo(null);
        setMensagensLista([]);
      }
      setGrupos((prev) => prev.filter((g) => g.id !== grupoId));
    } else {
      toast.error(res.erro ?? 'Erro ao excluir conversa');
    }
  }

  // Fechar conversa (desselecionar)
  function handleFecharConversa(grupoId: string) {
    setCtxGrupo(null);
    if (grupoAtivo === grupoId) {
      setGrupoAtivo(null);
      setMensagensLista([]);
    }
  }

  // Excluir mensagem
  async function handleExcluirMensagem(msgId: string) {
    setMenuMsg(null);
    const res = await excluirMensagem(msgId);
    if (res.sucesso) {
      setMensagensLista((prev) => prev.filter((m) => m.id !== msgId));
      toast.success('Mensagem excluída');
    } else {
      toast.error(res.erro ?? 'Erro ao excluir mensagem');
    }
  }

  // Salvar edição de mensagem
  async function handleSalvarEdicao() {
    if (!editandoMsg || !editandoMsg.conteudo.trim()) return;
    const res = await editarMensagem(editandoMsg.id, editandoMsg.conteudo.trim());
    if (res.sucesso) {
      setMensagensLista((prev) =>
        prev.map((m) =>
          m.id === editandoMsg.id ? { ...m, conteudo: editandoMsg.conteudo.trim() } : m,
        ),
      );
      setEditandoMsg(null);
      toast.success('Mensagem editada');
    } else {
      toast.error(res.erro ?? 'Erro ao editar mensagem');
    }
  }

  // Fechar context menu ao clicar fora
  useEffect(() => {
    function handleClick() {
      setCtxGrupo(null);
      setMenuMsg(null);
    }
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Helper: nome do grupo
  function nomeGrupo(g: Grupo): string {
    if (g.nome) return g.nome;
    if (g.tipo === 'direto') {
      const outro = g.participantes.find((p) => p.role !== roleAtual) ?? g.participantes[0];
      return outro?.nome ?? 'Conversa';
    }
    return 'Grupo';
  }

  // Helper: role label
  function roleLabel(role: string | null): string {
    if (role === 'medico') return 'Médico';
    if (role === 'admin') return 'Suporte';
    return 'Paciente';
  }

  function roleIcon(role: string | null) {
    if (role === 'medico') return Stethoscope;
    return User;
  }

  const grupoSelecionado = grupos.find((g) => g.id === grupoAtivo);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
          <p className="text-sm text-muted-foreground">{subtitulo}</p>
        </div>

        <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
          <DialogTrigger render={<Button size="sm" className="gap-2" />}>
            <Plus size={14} />
            Nova conversa
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova conversa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={buscaUsuario}
                  onChange={(e) => setBuscaUsuario(e.target.value)}
                  placeholder="Buscar por nome ou e-mail..."
                  onKeyDown={(e) => e.key === 'Enter' && handleBuscarUsuarios()}
                />
                <Button onClick={handleBuscarUsuarios} disabled={buscandoUsuarios} size="sm">
                  {buscandoUsuarios ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    'Buscar'
                  )}
                </Button>
              </div>

              <div className="max-h-60 space-y-2 overflow-y-auto">
                {usuariosEncontrados.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleIniciarConversa(u.id)}
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {u.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {roleLabel(u.role)}
                    </Badge>
                  </button>
                ))}
                {usuariosEncontrados.length === 0 && buscaUsuario && !buscandoUsuarios && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum usuário encontrado
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Lista de conversas */}
        <Card className="w-80 shrink-0 overflow-hidden border-0 shadow-sm">
          <CardContent className="flex h-full flex-col p-0">
            <div className="border-b p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Conversas
              </p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {carregandoGrupos ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-primary" />
                </div>
              ) : grupos.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <MessageSquare size={32} className="mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Nenhuma conversa</p>
                  <p className="mt-1 text-xs text-muted-foreground">Inicie uma nova conversa</p>
                </div>
              ) : (
                grupos.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => selecionarGrupo(g.id)}
                    onContextMenu={(e) => handleContextMenuGrupo(e, g.id)}
                    className={`flex w-full items-center gap-3 border-b border-border/30 p-3 text-left transition-colors ${
                      grupoAtivo === g.id ? 'bg-primary/5' : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      {(() => { const DynIcon = roleIcon(g.participantes.find((p) => p.role !== roleAtual)?.role ?? null); return <DynIcon size={18} />; })()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{nomeGrupo(g)}</p>
                      {g.ultimaMensagem && (
                        <p className="truncate text-xs text-muted-foreground">{g.ultimaMensagem}</p>
                      )}
                    </div>
                    {g.naoLidas > 0 && (
                      <Badge className="h-5 min-w-5 justify-center rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                        {g.naoLidas}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Context menu flutuante para conversas */}
        {ctxGrupo && (
          <div
            className="fixed z-[100] min-w-40 rounded-lg border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
            style={{ top: ctxGrupo.y, left: ctxGrupo.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => handleFecharConversa(ctxGrupo.grupoId)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <XCircle size={14} />
              Fechar conversa
            </button>
            <div className="my-1 h-px bg-border" />
            <button
              onClick={() => handleExcluirGrupo(ctxGrupo.grupoId)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
            >
              <Trash2 size={14} />
              Excluir conversa
            </button>
          </div>
        )}

        {/* Área de mensagens */}
        <Card className="flex-1 overflow-hidden border-0 shadow-sm">
          <CardContent className="flex h-full flex-col p-0">
            {!grupoAtivo ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <MessageSquare size={48} className="mb-3 text-muted-foreground/40" />
                <p className="text-lg font-medium">Selecione uma conversa</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ou inicie uma nova conversa pelo botão acima
                </p>
              </div>
            ) : (
              <>
                {/* Header do chat */}
                <div className="flex items-center gap-3 border-b p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    {(() => { const DynIcon = roleIcon(
                        grupoSelecionado?.participantes.find((p) => p.role !== roleAtual)?.role ?? null,
                      ); return <DynIcon size={18} />; })()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {grupoSelecionado ? nomeGrupo(grupoSelecionado) : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {grupoSelecionado?.participantes.map((p) => p.nome).join(', ')}
                    </p>
                  </div>
                </div>

                {/* Mensagens */}
                <div ref={mensagensRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                  {carregandoMensagens ? (
                    <div className="flex justify-center py-8">
                      <Loader2 size={24} className="animate-spin text-primary" />
                    </div>
                  ) : mensagensLista.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <p className="text-sm text-muted-foreground">
                        Nenhuma mensagem ainda. Inicie a conversa!
                      </p>
                    </div>
                  ) : (
                    mensagensLista.map((msg) => {
                      const isOwn = (meuUserId && msg.autorId === meuUserId) || msg.autorId === '__self__';
                      const isTemp = msg.id.startsWith('temp-');
                      const isEditing = editandoMsg?.id === msg.id;
                      return (
                        <div
                          key={msg.id}
                          className={`group/msg relative flex items-end gap-2 ${isOwn ? '' : 'flex-row-reverse'}`}
                        >
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                              msg.autorRole === 'medico' ? 'bg-primary/10' : 'bg-muted'
                            }`}
                          >
                            {(() => { const DynIcon = roleIcon(msg.autorRole); return <DynIcon size={14} />; })()}
                          </div>
                          <div className="max-w-[75%]">
                            <p
                              className={`mb-0.5 text-[10px] ${
                                isOwn ? '' : 'text-right'
                              } text-muted-foreground`}
                            >
                              {msg.autorNome}
                            </p>

                            {/* Modo edição inline */}
                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  autoFocus
                                  value={editandoMsg.conteudo}
                                  onChange={(e) =>
                                    setEditandoMsg({ ...editandoMsg, conteudo: e.target.value })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSalvarEdicao();
                                    if (e.key === 'Escape') setEditandoMsg(null);
                                  }}
                                  className="rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                                />
                                <button
                                  onClick={handleSalvarEdicao}
                                  className="rounded-md p-1 text-green-600 hover:bg-green-50"
                                  title="Salvar"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => setEditandoMsg(null)}
                                  className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                                  title="Cancelar"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="relative">
                                <div
                                  className={`rounded-2xl px-4 py-2.5 ${
                                    isOwn
                                      ? 'rounded-bl-md bg-muted'
                                      : 'rounded-br-md bg-primary text-primary-foreground'
                                  }`}
                                >
                                  <p className="text-sm">{msg.conteudo}</p>
                                </div>

                                {/* Botão de ações — apenas para mensagens próprias e não temporárias */}
                                {isOwn && !isTemp && (
                                  <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/msg:opacity-100 ${isOwn ? '-right-8' : '-left-8'}`}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuMsg(menuMsg === msg.id ? null : msg.id);
                                      }}
                                      className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  </div>
                                )}

                                {/* Menu dropdown da mensagem */}
                                {menuMsg === msg.id && (
                                  <div
                                    className={`absolute z-50 min-w-36 rounded-lg border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95 ${isOwn ? '-right-40 top-0' : '-left-40 top-0'}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={() => {
                                        setMenuMsg(null);
                                        setEditandoMsg({ id: msg.id, conteudo: msg.conteudo });
                                      }}
                                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                                    >
                                      <Pencil size={14} />
                                      Editar
                                    </button>
                                    <div className="my-1 h-px bg-border" />
                                    <button
                                      onClick={() => handleExcluirMensagem(msg.id)}
                                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 size={14} />
                                      Excluir
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            <p
                              className={`mt-0.5 text-[10px] ${
                                isOwn ? '' : 'text-right'
                              } text-muted-foreground`}
                            >
                              {new Date(msg.criadoEm).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Input */}
                <div className="border-t p-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleEnviar();
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      value={textoMensagem}
                      onChange={(e) => setTextoMensagem(e.target.value)}
                      placeholder="Digite sua mensagem..."
                      className="flex-1"
                      disabled={enviando}
                    />
                    <Button type="submit" size="icon" disabled={!textoMensagem.trim() || enviando}>
                      {enviando ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                    </Button>
                  </form>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
