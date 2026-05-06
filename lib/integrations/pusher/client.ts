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

// Reexporta as convenções do server para uso no client
export { canalChat, canalUsuario, EVENTOS_PUSHER } from './server';
