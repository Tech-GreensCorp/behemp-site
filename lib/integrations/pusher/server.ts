import Pusher from 'pusher';

/**
 * Cliente Pusher SERVER-SIDE para envio de eventos em tempo real.
 *
 * Configuração necessária:
 * - PUSHER_APP_ID
 * - PUSHER_KEY (também exposta como NEXT_PUBLIC_PUSHER_KEY)
 * - PUSHER_SECRET
 * - PUSHER_CLUSTER (também exposta como NEXT_PUBLIC_PUSHER_CLUSTER)
 */

let pusherServer: Pusher | null = null;

export function getPusherServer(): Pusher {
  if (!pusherServer) {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.PUSHER_CLUSTER;

    if (!appId || !key || !secret || !cluster) {
      throw new Error(
        '[Pusher] Variáveis PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET e PUSHER_CLUSTER devem estar configuradas no .env',
      );
    }

    pusherServer = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
  }

  return pusherServer;
}

// ── Canais ────────────────────────────────────────────────────

/**
 * Convenções de nomes de canal:
 * - `private-chat-{grupoId}` — mensagens de um grupo de chat
 * - `private-user-{userId}` — notificações pessoais do usuário
 */

export function canalChat(grupoId: string): string {
  return `private-chat-${grupoId}`;
}

export function canalUsuario(userId: string): string {
  return `private-user-${userId}`;
}

// ── Eventos ───────────────────────────────────────────────────

/**
 * Nomes de eventos padronizados.
 */
export const EVENTOS_PUSHER = {
  NOVA_MENSAGEM: 'nova-mensagem',
  MENSAGEM_LIDA: 'mensagem-lida',
  DIGITANDO: 'client-digitando',
  NOVA_NOTIFICACAO: 'nova-notificacao',
} as const;

// ── Funções de envio ──────────────────────────────────────────

/**
 * Envia uma mensagem para o canal de chat de um grupo.
 */
export async function enviarMensagemChat(params: {
  grupoId: string;
  mensagemId: string;
  autorId: string;
  autorNome: string;
  conteudo: string;
  criadoEm: string;
}): Promise<void> {
  const pusher = getPusherServer();
  await pusher.trigger(canalChat(params.grupoId), EVENTOS_PUSHER.NOVA_MENSAGEM, {
    id: params.mensagemId,
    autorId: params.autorId,
    autorNome: params.autorNome,
    conteudo: params.conteudo,
    criadoEm: params.criadoEm,
  });
}

/**
 * Envia uma notificação em tempo real para um usuário específico.
 */
export async function enviarNotificacaoRealtime(params: {
  userId: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  linkAcao?: string;
}): Promise<void> {
  const pusher = getPusherServer();
  await pusher.trigger(canalUsuario(params.userId), EVENTOS_PUSHER.NOVA_NOTIFICACAO, {
    tipo: params.tipo,
    titulo: params.titulo,
    mensagem: params.mensagem,
    linkAcao: params.linkAcao,
  });
}

/**
 * Autentica um canal privado do Pusher.
 * Deve ser usado no endpoint /api/pusher/auth
 */
export function autenticarCanal(socketId: string, canal: string) {
  const pusher = getPusherServer();
  return pusher.authorizeChannel(socketId, canal);
}
