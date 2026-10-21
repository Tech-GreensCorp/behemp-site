/**
 * SINALIZAÇÃO WebRTC DA CHAMADA DE ATENDIMENTO — ADR-0029 D-14 e D-15.
 *
 * Espelha `app/api/teleconsulta/sinalizar/route.ts`, com o escopo da CHAMADA: só o paciente dono
 * do pedido e o admin disparam no canal `presence-atendimento-{sala}`. Sem isto, qualquer usuário
 * autenticado injetaria oferta na chamada de outra pessoa e passaria a ouvi-la.
 *
 * O payload é SDP/ICE opaco: não se inspeciona conteúdo, mas se limita a um objeto de tamanho
 * razoável, para o canal não virar veículo de outra coisa.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { garantirParticipanteDaChamada } from '@/lib/auth/escopo-chamada';
import { canalDoAtendimento } from '@/lib/atendimento/canal';
import { getPusherServer } from '@/lib/integrations/pusher/server';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';

/** ICE gera muitos candidatos num segundo: o teto é folgado, mas existe. */
const LIMITE = 600;
const JANELA_EM_SEGUNDOS = 60;

const TIPOS = ['offer', 'answer', 'ice-candidate', 'peer-joined', 'peer-left', 'midia'] as const;

/**
 * ADR-0029 D-21: `midia` diz ao outro lado se a câmera e a tela estão ligadas. É o único tipo cujo
 * conteúdo se conhece, então ele é conferido por inteiro: dois booleanos, e nada mais.
 */
const midiaSchema = z.object({ camera: z.boolean(), tela: z.boolean() }).strict();

const corpoSchema = z
  .object({
    sala: z.string().regex(/^[a-f0-9]{32}$/, 'sala inválida'),
    tipo: z.enum(TIPOS),
    payload: z.record(z.string(), z.unknown()),
    socketId: z.string().max(128).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const limite = consumir(
    identificarChamador(request.headers, 'atd-sinal'),
    LIMITE,
    JANELA_EM_SEGUNDOS,
  );
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429, headers: cabecalhosDoLimite(limite, LIMITE) },
    );
  }

  const texto = await request.text();
  // Uma oferta SDP cabe folgada em 64 KB; mais que isso não é sinalização.
  if (texto.length > 64_000)
    return NextResponse.json({ erro: 'Corpo grande demais' }, { status: 413 });

  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return NextResponse.json({ erro: 'Corpo inválido' }, { status: 400 });
  }
  const parsed = corpoSchema.safeParse(bruto);
  if (!parsed.success) return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 });

  const { sala, tipo, payload, socketId } = parsed.data;
  if (tipo === 'midia' && !midiaSchema.safeParse(payload).success)
    return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 });
  const escopo = await garantirParticipanteDaChamada({ sala });
  if (!escopo.ok) return NextResponse.json({ erro: escopo.erro }, { status: escopo.status });

  // O remetente não recebe o próprio evento (sem eco de oferta/resposta).
  await getPusherServer().trigger(
    canalDoAtendimento(sala),
    `webrtc:${tipo}`,
    payload,
    socketId ? { socket_id: socketId } : undefined,
  );
  return NextResponse.json({ sucesso: true });
}
