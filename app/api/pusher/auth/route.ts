import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { autenticarCanal } from '@/lib/integrations/pusher';
import { db } from '@/lib/db';
import { users, participantesGrupo } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Endpoint de autenticação do Pusher.
 * Canais privados (private-*) precisam ser autenticados pelo servidor.
 *
 * Verifica:
 * 1. Usuário está autenticado via Clerk
 * 2. Usuário tem permissão para o canal solicitado
 */
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.formData();
    const socketId = body.get('socket_id') as string;
    const canal = body.get('channel_name') as string;

    if (!socketId || !canal) {
      return NextResponse.json(
        { erro: 'socket_id e channel_name são obrigatórios' },
        { status: 400 },
      );
    }

    // Buscar userId do banco a partir do clerkId
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ erro: 'Usuário não encontrado' }, { status: 404 });
    }

    // Verificar permissão por tipo de canal
    if (canal.startsWith('private-user-')) {
      // Canal pessoal: só o próprio usuário pode se inscrever
      const canalUserId = canal.replace('private-user-', '');
      if (canalUserId !== user.id) {
        return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });
      }
    } else if (canal.startsWith('private-chat-')) {
      // Canal de chat: verificar se o usuário é participante do grupo
      const grupoId = canal.replace('private-chat-', '');
      const [participante] = await db
        .select({ id: participantesGrupo.id })
        .from(participantesGrupo)
        .where(
          and(
            eq(participantesGrupo.grupoId, grupoId),
            eq(participantesGrupo.userId, user.id),
          ),
        )
        .limit(1);

      if (!participante) {
        return NextResponse.json({ erro: 'Acesso negado ao grupo' }, { status: 403 });
      }
    }

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
