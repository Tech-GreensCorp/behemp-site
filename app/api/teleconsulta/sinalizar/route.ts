import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPusherServer } from '@/lib/integrations/pusher/server';
import { garantirDonoDaSala } from '@/lib/auth/escopo-sala';

// Endpoint de sinalização WebRTC via Pusher
// Médico e paciente trocam SDP offer/answer e ICE candidates via Pusher
//
// 🔴 CORRIGIDO EM 20/08/2026 — Item 11 de docs/04-LISTA-DE-AFAZERES.md.
// Antes, este handler verificava apenas que existia um `userId` do Clerk e então aceitava
// um `roomId` arbitrário do body, disparando no canal correspondente. Combinado com o ramo
// `presence-sala-` de /api/pusher/auth, que também não conferia vínculo, qualquer usuário
// autenticado podia injetar sinalização na consulta de outra pessoa — e negociar WebRTC
// nela. Agora o vínculo com a sala é verificado no servidor, e o payload é validado.

/**
 * Tipos válidos de sinalização WebRTC.
 * Lista fechada: o valor entra na composição do nome do evento Pusher.
 */
const TIPOS = ['offer', 'answer', 'ice-candidate', 'peer-joined', 'peer-left'] as const;

const corpoSchema = z.object({
  // 6 caracteres alfanuméricos, como gerado em criarSalaTeleconsulta.
  roomId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9-]+$/, 'roomId inválido'),
  tipo: z.enum(TIPOS),
  // O payload é SDP/ICE opaco para nós — não se inspeciona conteúdo, mas se limita o
  // formato a objeto, para que não seja usado como veículo de outra coisa.
  payload: z.record(z.string(), z.unknown()),
  socketId: z.string().max(128).optional(),
});

export async function POST(request: NextRequest) {
  let bruto: unknown;
  try {
    bruto = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Corpo inválido' }, { status: 400 });
  }

  const parsed = corpoSchema.safeParse(bruto);
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 });
  }
  const { roomId, tipo, payload, socketId } = parsed.data;

  // Autenticação E escopo de objeto: quem sinaliza tem de ser o médico ou o paciente
  // DESTA sala. `garantirDonoDaSala` já responde 401 quando não há sessão.
  const escopo = await garantirDonoDaSala({ roomId });
  if (!escopo.ok) {
    return NextResponse.json({ erro: escopo.erro }, { status: escopo.status });
  }

  const pusherServer = getPusherServer();

  // Etapa 1: excluir o remetente do broadcast (elimina eco de offer/answer/ICE).
  // socket_id é o socket do cliente que está sinalizando; Pusher não devolve o
  // evento para ele. socketId é opcional — sem ele comporta como antes.
  const triggerOpts = socketId ? { socket_id: socketId } : undefined;
  await pusherServer.trigger(`presence-sala-${roomId}`, `webrtc:${tipo}`, payload, triggerOpts);

  return NextResponse.json({ sucesso: true });
}
