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
} from '@/app/_actions/chat';
import { getPusherClient, canalChat, EVENTOS_PUSHER } from '@/lib/integrations/pusher/client';
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
}: ChatContainerProps) {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoAtivo, setGrupoAtivo] = useState<string | null>(null);
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

  const mensagensRef = useRef<HTMLDivElement>(null);

  // Carregar grupos
  const carregarGrupos = useCallback(async () => {
    setCarregandoGrupos(true);
    const res = await listarGrupos();
    if (res.sucesso && res.dados) {
      setGrupos(res.dados);
    }
    setCarregandoGrupos(false);
  }, []);

  useEffect(() => {
    carregarGrupos();
  }, [carregarGrupos]);

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

  // Pusher: subscribe ao grupo ativo
  useEffect(() => {
    if (!grupoAtivo) return;

    try {
      const pusher = getPusherClient();
      const channel = pusher.subscribe(canalChat(grupoAtivo));

      channel.bind(
        EVENTOS_PUSHER.NOVA_MENSAGEM,
        (data: {
          id: string;
          autorId: string;
          autorNome: string;
          conteudo: string;
          criadoEm: string;
        }) => {
          setMensagensLista((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev;
            return [
              ...prev,
              {
                id: data.id,
                autorId: data.autorId,
                autorNome: data.autorNome,
                autorRole: null,
                conteudo: data.conteudo,
                criadoEm: data.criadoEm,
              },
            ];
          });
        },
      );

      return () => {
        pusher.unsubscribe(canalChat(grupoAtivo));
      };
    } catch {
      console.warn('[Chat] Pusher não disponível — modo somente banco.');
    }
  }, [grupoAtivo]);

  // Enviar mensagem
  async function handleEnviar() {
    if (!textoMensagem.trim() || !grupoAtivo) return;
    setEnviando(true);

    const res = await enviarMensagem({
      grupoId: grupoAtivo,
      conteudo: textoMensagem.trim(),
    });

    if (res.sucesso) {
      setTextoMensagem('');
      await carregarMensagens(grupoAtivo);
    } else {
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

  // Helper: nome do grupo
  function nomeGrupo(g: Grupo): string {
    if (g.nome) return g.nome;
    if (g.tipo === 'direto') {
      // Mostrar o nome do outro participante
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
          <DialogTrigger>
            <Button size="sm" className="gap-2">
              <Plus size={14} />
              Nova conversa
            </Button>
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
                      // Mensagem do usuário atual = alinhada à direita
                      const isOwn = msg.autorRole === roleAtual;
                      return (
                        <div
                          key={msg.id}
                          className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
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
                                isOwn ? 'text-right' : ''
                              } text-muted-foreground`}
                            >
                              {msg.autorNome}
                            </p>
                            <div
                              className={`rounded-2xl px-4 py-2.5 ${
                                isOwn
                                  ? 'rounded-br-md bg-primary text-primary-foreground'
                                  : 'rounded-bl-md bg-muted'
                              }`}
                            >
                              <p className="text-sm">{msg.conteudo}</p>
                            </div>
                            <p
                              className={`mt-0.5 text-[10px] ${
                                isOwn ? 'text-right' : ''
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
