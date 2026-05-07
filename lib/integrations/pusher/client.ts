'use client';

import PusherClient from 'pusher-js';

/**
 * Cliente Pusher CLIENT-SIDE para recebimento de eventos em tempo real.
 *
 * Variáveis de ambiente expostas ao client:
 * - NEXT_PUBLIC_PUSHER_KEY
 * - NEXT_PUBLIC_PUSHER_CLUSTER
 */

let pusherClient: PusherClient | null = null;

export function getPusherClient(): PusherClient {
  if (!pusherClient) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!key || !cluster) {
      throw new Error(
        '[Pusher Client] NEXT_PUBLIC_PUSHER_KEY e NEXT_PUBLIC_PUSHER_CLUSTER devem estar configuradas.',
      );
    }

    pusherClient = new PusherClient(key, {
      cluster,
      authEndpoint: '/api/pusher/auth',
    });
  }

  return pusherClient;
}

// Convenções de canal (duplicadas do server para evitar importar código server-only)
export function canalChat(grupoId: string): string {
  return `private-chat-${grupoId}`;
}

export function canalUsuario(userId: string): string {
  return `private-user-${userId}`;
}

export const EVENTOS_PUSHER = {
  NOVA_MENSAGEM: 'nova-mensagem',
  MENSAGEM_LIDA: 'mensagem-lida',
  DIGITANDO: 'client-digitando',
  NOVA_NOTIFICACAO: 'nova-notificacao',
} as const;
