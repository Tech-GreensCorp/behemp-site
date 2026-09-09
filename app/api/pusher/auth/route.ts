import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { autenticarCanal } from '@/lib/integrations/pusher';
import { garantirDonoDaSala } from '@/lib/auth/escopo-sala';
import { db } from '@/lib/db';
import { users, participantesGrupo } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/** Canal literal da fila de espera — não é o código de uma sala. */
const CANAL_SALA_DE_ESPERA = 'presence-sala-espera';

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
      .select({ id: users.id, role: users.role })
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
    } else if (canal === CANAL_SALA_DE_ESPERA) {
      // Sala de espera virtual: é a lista de quem está aguardando, e quem a consome é o
      // médico (app/(medico)/medico/teleconsulta/page.tsx). Paciente não entra aqui — veria
      // a presença de outros pacientes.
      // ⚠️ Este ramo vem ANTES do de teleconsulta de propósito: 'espera' tem 6 caracteres,
      // o mesmo tamanho de um roomId, e seria tratado como código de sala.
      if (user.role !== 'medico' && user.role !== 'admin') {
        return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });
      }
      const presenceData = {
        user_id: user.id,
        user_info: { id: user.id, clerkId },
      };
      return NextResponse.json(autenticarCanal(socketId, canal, presenceData));
    } else if (canal.startsWith('presence-sala-')) {
      // Canal de uma teleconsulta específica. 🔴 Até 20/08/2026 este ramo autorizava
      // QUALQUER usuário autenticado em QUALQUER sala — e, combinado com
      // /api/teleconsulta/sinalizar, permitia assistir a consulta médica alheia.
      // Item 11 de docs/04-LISTA-DE-AFAZERES.md.
      const roomId = canal.slice('presence-sala-'.length);
      const escopo = await garantirDonoDaSala({ roomId });
      if (!escopo.ok) {
        return NextResponse.json({ erro: escopo.erro }, { status: escopo.status });
      }
      const presenceData = {
        user_id: user.id,
        user_info: { id: user.id, clerkId },
      };
      return NextResponse.json(autenticarCanal(socketId, canal, presenceData));
    }

    // 🔴 O DEFAULT NEGA. Até 20/08/2026 este ponto autorizava qualquer nome de canal que
    // não casasse nenhum prefixo conhecido — fail-open. Canal novo agora precisa de um ramo
    // com a sua regra de acesso, escrito de propósito.
    return NextResponse.json({ erro: 'Canal não reconhecido' }, { status: 403 });
  } catch (error) {
    console.error('[Pusher Auth] Erro:', error);
    return NextResponse.json(
      { erro: 'Erro ao autenticar canal' },
      { status: 500 },
    );
  }
}
