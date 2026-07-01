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
  enviarArquivoChat,
} from '@/app/_actions/chat';
import { getPusherClient, canalChat, canalUsuario, EVENTOS_PUSHER } from '@/lib/integrations/pusher/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
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
  MoreVertical,
  Smile,
  Search,
  Paperclip,
  File,
  Download,
  ArrowLeft,
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
  const [buscaMensagem, setBuscaMensagem] = useState('');
  const [mostrarBusca, setMostrarBusca] = useState(false);
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);
  const [arquivoPendente, setArquivoPendente] = useState<File | null>(null);
  const [mostrarEmojis, setMostrarEmojis] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Handler para arquivo: apenas seleciona, não envia automaticamente
  function handleSelecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivoPendente(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // Confirmar envio do arquivo — optimistic update
  async function handleConfirmarArquivo() {
    if (!arquivoPendente || !grupoAtivo) return;

    const nomeArquivo = arquivoPendente.name;
    setCarregandoArquivo(true);

    // Optimistic: adicionar mensagem de arquivo localmente
    const tempId = `temp-file-${Date.now()}`;
    const agora = new Date().toISOString();
    const conteudoTemp = `[ARQUIVO:#] ${nomeArquivo}`;

    setMensagensLista((prev) => [
      ...prev,
      {
        id: tempId,
        autorId: meuUserId ?? '__self__',
        autorNome: 'Você',
        autorRole: roleAtual,
        conteudo: conteudoTemp,
        criadoEm: agora,
      },
    ]);

    const formData = new FormData();
    formData.append('arquivo', arquivoPendente);
    formData.append('grupoId', grupoAtivo);

    const res = await enviarArquivoChat(formData);
    if (res.sucesso && res.dados) {
      // Substituir temp pela mensagem real com URL
      setMensagensLista((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, id: res.dados!.mensagemId, conteudo: `[ARQUIVO:${res.dados!.url}] ${nomeArquivo}` }
            : m,
        ),
      );
      toast.success('Arquivo enviado');
    } else {
      setMensagensLista((prev) => prev.filter((m) => m.id !== tempId));
      toast.error(res.erro ?? 'Erro ao enviar arquivo');
    }
    setArquivoPendente(null);
    setCarregandoArquivo(false);
  }

  // Inserir emoji no texto
  function handleInserirEmoji(emoji: string) {
    setTextoMensagem((prev) => prev + emoji);
    setMostrarEmojis(false);
  }

  // Helper: limpar nome (remover "Novo Paciente")
  function limparNome(nome: string | null, email?: string): string {
    if (!nome || nome.toLowerCase().includes('novo paciente')) {
      if (email) return email.split('@')[0];
      return 'Paciente';
    }
    return nome;
  }

  // Helper: nome do grupo
  function nomeGrupo(g: Grupo): string {
    if (g.nome) return limparNome(g.nome);
    if (g.tipo === 'direto') {
      const outro = g.participantes.find((p) => p.role !== roleAtual) ?? g.participantes[0];
      return limparNome(outro?.nome, (outro as any).email);
    }
    return 'Grupo';
  }

  // Helper: email do outro participante (para exibir no header/sidebar)
  function emailOutro(g: Grupo): string | null {
    if (g.tipo === 'direto') {
      const outro = g.participantes.find((p) => p.role !== roleAtual) ?? g.participantes[0];
      return (outro as any).email ?? null;
    }
    return null;
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
    <div className="flex h-[calc(100dvh-7rem)] sm:h-[calc(100vh-4rem)] flex-col space-y-3 sm:space-y-6 animate-fade-up py-1 sm:py-4">
      
      {/* ── Header Editorial ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 animate-fade-up">
        <div>
          <p className="text-primary mb-1 sm:mb-2 text-xs font-semibold tracking-[0.25em] uppercase">
            {roleAtual === 'medico' ? 'Área Médica' : roleAtual === 'admin' ? 'Área Administrativa' : 'Área do Paciente'}
          </p>
          <h1 className="font-display text-2xl sm:text-4xl leading-[1.1] font-bold tracking-tight text-foreground">
            Meu <span className="text-accent-italic">Chat</span>
          </h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 max-w-2xl text-sm leading-relaxed hidden sm:block">
            {subtitulo}
          </p>
        </div>

        <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
          <DialogTrigger render={<Button size="sm" className="rounded-full bg-[#16a34a] hover:bg-[#148f43] text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 px-5 h-10 text-xs border-0 cursor-pointer" />}>
            <Plus size={14} className="mr-1.5" />
            Nova conversa
          </DialogTrigger>
          <DialogContent showCloseButton={false} className="sm:max-w-md bg-white border border-border/30 rounded-3xl p-0 shadow-xl overflow-hidden grain">
            <div className="relative p-6 w-full h-full">
              <DialogClose className="absolute top-4 right-4 z-50 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer border-0 bg-transparent">
                <X className="h-4 w-4" />
              </DialogClose>
              
              <DialogHeader className="space-y-2 text-center pb-4 border-b border-border/10">
                <DialogTitle className="font-heading text-lg font-bold text-foreground">Nova conversa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex gap-2">
                  <Input
                    value={buscaUsuario}
                    onChange={(e) => setBuscaUsuario(e.target.value)}
                    placeholder="Buscar por nome ou e-mail..."
                    className="bg-background border-border/40 rounded-xl h-10 px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
                    onKeyDown={(e) => e.key === 'Enter' && handleBuscarUsuarios()}
                  />
                  <Button onClick={handleBuscarUsuarios} disabled={buscandoUsuarios} className="rounded-full px-5 text-xs font-semibold h-10 bg-primary text-white hover:bg-primary/90 cursor-pointer">
                    {buscandoUsuarios ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      'Buscar'
                    )}
                  </Button>
                </div>

                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {usuariosEncontrados.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleIniciarConversa(u.id)}
                      className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-primary/5 border border-transparent hover:border-border/20 cursor-pointer"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary shrink-0">
                        {u.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{u.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <Badge className="bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 text-[10px] font-bold">
                        {roleLabel(u.role)}
                      </Badge>
                    </button>
                  ))}
                  {usuariosEncontrados.length === 0 && buscaUsuario && !buscandoUsuarios && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum usuário encontrado
                    </p>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden animate-fade-up delay-100">
        {/* Lista de conversas — esconde no mobile quando um chat está aberto */}
        <Card className={cn(
          "overflow-hidden border border-border/20 bg-white shadow-sm rounded-3xl relative grain",
          grupoAtivo ? "hidden lg:flex lg:w-80 lg:shrink-0" : "w-full lg:w-80 lg:shrink-0"
        )}>
          <CardContent className="flex h-full flex-col p-0">
            <div className="border-b border-border/10 p-4 bg-muted/5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                Conversas
              </p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {carregandoGrupos ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-primary" />
                </div>
              ) : grupos.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <MessageSquare size={24} />
                  </div>
                  <p className="text-sm font-bold text-foreground">Nenhuma conversa</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-[180px]">Inicie um novo chat com seu médico ou equipe de suporte.</p>
                </div>
              ) : (
                grupos.map((g) => {
                  const isActive = grupoAtivo === g.id;
                  return (
                    <div
                      key={g.id}
                      onClick={() => selecionarGrupo(g.id)}
                      onContextMenu={(e) => handleContextMenuGrupo(e, g.id)}
                      className={cn(
                        "flex w-full items-center gap-3 border-b border-border/10 p-4 text-left transition-colors cursor-pointer",
                        isActive ? 'bg-primary/5' : 'hover:bg-accent/30'
                      )}
                    >
                      <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                        isActive ? "bg-primary text-white" : "bg-primary/10 text-primary"
                      )}>
                        {(() => { const DynIcon = roleIcon(g.participantes.find((p) => p.role !== roleAtual)?.role ?? null); return <DynIcon size={18} />; })()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm font-semibold", isActive ? "text-primary" : "text-foreground")}>{nomeGrupo(g)}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {g.ultimaMensagem && (
                            <p className="truncate text-[11px] text-muted-foreground leading-snug flex-1">{g.ultimaMensagem}</p>
                          )}
                          {emailOutro(g) && (
                            <span className="text-[9px] text-muted-foreground/40 font-medium truncate hidden sm:block">· {emailOutro(g)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {g.naoLidas > 0 && (
                          <Badge className="h-5 min-w-5 justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                            {g.naoLidas}
                          </Badge>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<button type="button" className="rounded-full p-1 text-muted-foreground/40 hover:bg-accent hover:text-foreground transition-colors cursor-pointer" onClick={(e: React.MouseEvent) => e.stopPropagation()} />}>
                            <MoreVertical size={14} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-2xl grain p-1.5 shadow-2xl border-border/20">
                            <DropdownMenuItem onClick={() => handleFecharConversa(g.id)} className="cursor-pointer gap-2.5 rounded-xl py-2 px-3">
                              <XCircle size={15} className="text-muted-foreground" />
                              <span className="text-xs font-medium">Fechar conversa</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => handleExcluirGrupo(g.id)} className="cursor-pointer gap-2.5 rounded-xl py-2 px-3">
                              <Trash2 size={15} />
                              <span className="text-xs font-semibold">Excluir conversa</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Context menu flutuante para conversas */}
        {ctxGrupo && (
          <div
            className="fixed z-[100] min-w-44 rounded-2xl border border-border/30 bg-white p-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 grain"
            style={{ top: ctxGrupo.y, left: ctxGrupo.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => handleFecharConversa(ctxGrupo.grupoId)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent cursor-pointer"
            >
              <XCircle size={14} className="text-muted-foreground" />
              Fechar conversa
            </button>
            <div className="my-1.5 h-px bg-border/20" />
            <button
              onClick={() => handleExcluirGrupo(ctxGrupo.grupoId)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <Trash2 size={14} />
              Excluir conversa
            </button>
          </div>
        )}

        {/* Área de mensagens — esconde no mobile quando nenhum chat está selecionado */}
        <Card className={cn(
          "flex-1 overflow-hidden border border-border/20 bg-white shadow-sm rounded-3xl relative grain flex flex-col",
          !grupoAtivo ? "hidden lg:flex" : "flex"
        )}>
          <CardContent className="flex h-full flex-col p-0">
            {!grupoAtivo ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <MessageSquare size={28} />
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground">Sua Caixa de Entrada</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                  Selecione uma conversa ao lado ou clique em &quot;Nova conversa&quot; para enviar mensagens em tempo real.
                </p>
              </div>
            ) : (
              <>
                {/* Header do chat */}
                <div className="flex items-center gap-3 border-b border-border/10 p-3 sm:p-4 bg-muted/5">
                  {/* Botão voltar — só no mobile */}
                  <button
                    onClick={() => setGrupoAtivo(null)}
                    className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0 cursor-pointer"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0 hidden sm:flex">
                    {(() => { const DynIcon = roleIcon(
                        grupoSelecionado?.participantes.find((p) => p.role !== roleAtual)?.role ?? null,
                      ); return <DynIcon size={18} />; })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground leading-snug">
                      {grupoSelecionado ? nomeGrupo(grupoSelecionado) : ''}
                    </p>
                    {emailOutro(grupoSelecionado!) && (
                      <p className="text-[10px] text-muted-foreground/50 font-medium truncate mt-0.5">
                        {emailOutro(grupoSelecionado!)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 ml-auto">
                    {mostrarBusca ? (
                      <div className="flex items-center bg-muted/30 border border-border/15 rounded-2xl px-3 sm:px-4 py-2 gap-2 sm:gap-2.5 animate-in slide-in-from-right-4 shadow-sm">
                        <Search size={15} className="text-muted-foreground/50 shrink-0" />
                        <input
                          autoFocus
                          value={buscaMensagem}
                          onChange={(e) => setBuscaMensagem(e.target.value)}
                          placeholder="Buscar mensagem..."
                          className="bg-transparent border-0 text-[13px] outline-none w-28 sm:w-56 text-foreground placeholder:text-muted-foreground/40"
                        />
                        <button onClick={() => { setMostrarBusca(false); setBuscaMensagem(''); }} className="text-muted-foreground/40 hover:text-foreground transition-colors rounded-full p-0.5 hover:bg-accent cursor-pointer">
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => setMostrarBusca(true)} className="rounded-full h-9 w-9 text-muted-foreground/50 hover:text-primary hover:bg-primary/5 cursor-pointer">
                        <Search size={17} />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Mensagens */}
                <div ref={mensagensRef} className="flex-1 space-y-4 overflow-y-auto p-4 bg-muted/5/30">
                  {carregandoMensagens ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 size={24} className="animate-spin text-primary" />
                    </div>
                  ) : mensagensLista.filter(m => !buscaMensagem || m.conteudo.toLowerCase().includes(buscaMensagem.toLowerCase())).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                      <p className="text-sm text-muted-foreground">
                        {buscaMensagem ? 'Nenhuma mensagem encontrada para sua busca.' : 'Nenhuma mensagem ainda. Envie a primeira mensagem abaixo!'}
                      </p>
                    </div>
                  ) : (
                    mensagensLista.filter(m => !buscaMensagem || m.conteudo.toLowerCase().includes(buscaMensagem.toLowerCase())).map((msg) => {
                      const isOwn = (meuUserId && msg.autorId === meuUserId) || msg.autorId === '__self__';
                      const isTemp = msg.id.startsWith('temp-');
                      const isEditing = editandoMsg?.id === msg.id;
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "group/msg relative flex items-end gap-3",
                            isOwn ? "flex-row-reverse" : "flex-row"
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-xs font-bold shadow-sm transition-transform group-hover/msg:scale-110",
                              isOwn ? "bg-primary text-white" : "bg-primary/10 text-primary"
                            )}
                          >
                          {(() => { const DynIcon = roleIcon(msg.autorRole); return <DynIcon size={16} />; })()}
                        </div>
                        <div className="max-w-[80%]">
                          <p
                            className={cn(
                              "mb-1.5 text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider",
                              isOwn ? "text-right mr-1" : "text-left ml-1"
                            )}
                          >
                            {limparNome(msg.autorNome)}
                          </p>

                            {/* Modo edição inline */}
                            {isEditing ? (
                              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-border/40 shadow-sm">
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
                                  className="bg-transparent border-0 px-2 py-1 text-sm outline-none w-48 text-foreground"
                                />
                                <button
                                  onClick={handleSalvarEdicao}
                                  className="rounded-lg p-1 text-green-600 hover:bg-green-50 cursor-pointer"
                                  title="Salvar"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => setEditandoMsg(null)}
                                  className="rounded-lg p-1 text-muted-foreground hover:bg-accent cursor-pointer"
                                  title="Cancelar"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="relative">
                                <div
                                  className={cn(
                                    "relative px-4 py-3 text-sm leading-relaxed shadow-sm transition-all group/bubble",
                                    isOwn
                                      ? "bg-primary text-white rounded-t-2xl rounded-bl-2xl rounded-br-sm shadow-primary/10"
                                      : "bg-white border border-border/30 text-foreground rounded-t-2xl rounded-br-2xl rounded-bl-sm"
                                  )}
                                >
                                  {msg.conteudo.startsWith('[ARQUIVO:') || msg.conteudo.startsWith('[ARQUIVO]') ? (() => {
                                    // Parse: [ARQUIVO:url] filename  ou  [ARQUIVO] filename
                                    const matchUrl = msg.conteudo.match(/\[ARQUIVO:([^\]]+)\]\s*(.*)/);
                                    const matchSimple = msg.conteudo.match(/\[ARQUIVO\]\s*(.*)/);
                                    const fileUrl = matchUrl?.[1] ?? '#';
                                    const fileName = matchUrl?.[2] ?? matchSimple?.[1] ?? 'Arquivo';
                                    return (
                                      <div className="flex items-center gap-3 py-1">
                                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", isOwn ? "bg-white/20" : "bg-primary/10")}>
                                          <File size={20} className={isOwn ? "text-white" : "text-primary"} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[12px] font-bold truncate leading-tight">{fileName}</p>
                                          <p className={cn("text-[10px] mt-0.5", isOwn ? "text-white/70" : "text-muted-foreground")}>Clique para baixar</p>
                                        </div>
                                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={cn("p-2 rounded-full transition-colors", isOwn ? "hover:bg-white/10 text-white" : "hover:bg-primary/5 text-primary")}>
                                          <Download size={16} />
                                        </a>
                                      </div>
                                    );
                                  })() : (
                                    <p className="text-[13px] break-words whitespace-pre-wrap">{msg.conteudo}</p>
                                  )}
                                </div>

                                {/* Botão de ações — apenas para mensagens próprias e não temporárias */}
                                {isOwn && !isTemp && (
                                  <div className={cn(
                                    "absolute top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/msg:opacity-100",
                                    isOwn ? "left-[-2rem]" : "right-[-2rem]"
                                  )}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuMsg(menuMsg === msg.id ? null : msg.id);
                                      }}
                                      className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  </div>
                                )}

                                {/* Menu dropdown da mensagem */}
                                {menuMsg === msg.id && (
                                  <div
                                    className={cn(
                                      "absolute z-50 min-w-36 rounded-xl border border-border/30 bg-white p-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 grain",
                                      isOwn ? "left-[-10rem] top-0" : "right-[-10rem] top-0"
                                    )}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={() => {
                                        setMenuMsg(null);
                                        setEditandoMsg({ id: msg.id, conteudo: msg.conteudo });
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-accent cursor-pointer text-foreground"
                                    >
                                      <Pencil size={12} className="text-muted-foreground" />
                                      Editar
                                    </button>
                                    <div className="my-1 h-px bg-border/20" />
                                    <button
                                      onClick={() => handleExcluirMensagem(msg.id)}
                                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 cursor-pointer"
                                    >
                                      <Trash2 size={12} />
                                      Excluir
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                                <p
                                  className={cn(
                                    "mt-1.5 text-[9px] text-muted-foreground/60 font-medium",
                                    isOwn ? "text-right" : "text-left"
                                  )}
                                >
                                  {new Date(msg.criadoEm).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    timeZone: 'America/Sao_Paulo',
                                  })}
                                </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Input */}
                <div className="relative border-t border-border/10 p-4 bg-muted/5">
                  {/* Preview do arquivo selecionado */}
                  {arquivoPendente && (
                    <div className="absolute bottom-full left-0 right-0 p-3 bg-white border-t border-border/10 animate-in slide-in-from-bottom-2">
                      <div className="flex items-center gap-3 bg-muted/30 rounded-xl p-3 border border-border/15">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                          <File size={20} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{arquivoPendente.name}</p>
                          <p className="text-[10px] text-muted-foreground">{(arquivoPendente.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => setArquivoPendente(null)} className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer">
                            <X size={14} />
                          </button>
                          <Button type="button" size="sm" onClick={handleConfirmarArquivo} disabled={carregandoArquivo} className="rounded-xl h-8 px-4 text-xs font-bold bg-primary text-white hover:bg-primary/90 cursor-pointer">
                            {carregandoArquivo ? <Loader2 size={14} className="animate-spin" /> : 'Enviar'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleEnviar();
                    }}
                  >
                    <div className="flex gap-2 items-center">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleSelecionarArquivo}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={enviando || carregandoArquivo}
                        className="rounded-full h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/5 shrink-0"
                      >
                        {carregandoArquivo ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                      </Button>
                      <div className="relative">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setMostrarEmojis(!mostrarEmojis)}
                          className="rounded-full h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/5 shrink-0"
                        >
                          <Smile size={18} />
                        </Button>
                        {mostrarEmojis && (
                          <div className="absolute bottom-full left-0 mb-2 bg-white border border-border/20 rounded-2xl shadow-2xl p-3 w-72 z-50 animate-in fade-in-0 zoom-in-95">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">Emojis</p>
                            <div className="grid grid-cols-8 gap-1">
                              {['😀','😂','😍','🥰','😊','😉','🤔','😢','😭','😡','😱','🤯','🥳','🤩','🙏','👍','👎','❤️','🔥','✨','🌟','💪','💊','✅','❌','👋','🙌','🤝','☕','🌿','🌻','🍎'].map(emoji => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => handleInserirEmoji(emoji)}
                                  className="text-xl p-1 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors text-center"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <Input
                      value={textoMensagem}
                      onChange={(e) => setTextoMensagem(e.target.value)}
                      placeholder="Digite sua mensagem..."
                      className="flex-1 bg-white border-border/40 rounded-xl h-10 px-4 py-2 text-sm focus:ring-1 focus:ring-primary focus-visible:ring-1 focus-visible:ring-primary"
                      disabled={enviando}
                    />
                    <Button type="submit" size="icon" disabled={!textoMensagem.trim() || enviando} className="rounded-full bg-[#16a34a] hover:bg-[#148f43] text-white shadow-md hover:shadow-lg transition-all duration-200 h-10 w-10 flex items-center justify-center shrink-0 border-0 cursor-pointer">
                      {enviando ? (
                        <Loader2 size={16} className="animate-spin text-white" />
                      ) : (
                        <Send size={16} className="text-white" />
                      )}
                    </Button>
                  </div>
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
