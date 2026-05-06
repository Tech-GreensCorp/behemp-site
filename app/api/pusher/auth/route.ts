import { NextRequest, NextResponse } from 'next/server';
import { autenticarCanal } from '@/lib/integrations/pusher';

/**
 * Endpoint de autenticação do Pusher.
 * Canais privados (private-*) precisam ser autenticados pelo servidor.
 *
 * TODO: Adicionar verificação de sessão via Clerk quando disponível.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.formData();
    const socketId = body.get('socket_id') as string;
    const canal = body.get('channel_name') as string;

    if (!socketId || !canal) {
      return NextResponse.json(
        { erro: 'socket_id e channel_name são obrigatórios' },
        { status: 400 },
      );
    }

    // TODO: Verificar se o usuário autenticado tem permissão para acessar este canal
    // const userId = await obterUsuarioAtual();
    // if (canal.startsWith('private-user-') && canal !== `private-user-${userId}`) {
    //   return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });
    // }

    const authResponse = autenticarCanal(socketId, canal);
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('[Pusher Auth] Erro:', error);
    return NextResponse.json(
      { erro: 'Erro ao autenticar canal' },
      { status: 500 },
    );
  }
}
