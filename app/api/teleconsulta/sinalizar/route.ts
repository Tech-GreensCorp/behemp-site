import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getPusherServer } from '@/lib/integrations/pusher/server';

// Endpoint de sinalização WebRTC via Pusher
// Médico e paciente trocam SDP offer/answer e ICE candidates via Pusher
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

  const body = await request.json();
  const { roomId, tipo, payload } = body;

  if (!roomId || !tipo || !payload) {
    return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 });
  }

  // Tipos válidos de sinalização WebRTC
  const tiposValidos = ['offer', 'answer', 'ice-candidate', 'peer-joined', 'peer-left'];
  if (!tiposValidos.includes(tipo)) {
    return NextResponse.json({ erro: 'Tipo inválido' }, { status: 400 });
  }

  // Disparar evento Pusher no canal da sala
  const pusherServer = getPusherServer();
  await pusherServer.trigger(`presence-sala-${roomId}`, `webrtc:${tipo}`, payload);

  return NextResponse.json({ sucesso: true });
}
