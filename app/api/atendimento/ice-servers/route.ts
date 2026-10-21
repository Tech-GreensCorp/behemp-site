/**
 * CREDENCIAL DE TURN PARA A CHAMADA DE ATENDIMENTO — ADR-0029 D-14.
 *
 * Só quem está na chamada recebe credencial: TURN é recurso pago, e sem o escopo qualquer usuário
 * autenticado consumiria a cota da conta (mesma razão da rota da teleconsulta).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { garantirParticipanteDaChamada } from '@/lib/auth/escopo-chamada';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';
import { gerarCredencialTurn } from '@/lib/webrtc/credencial-turn';

const LIMITE = 20;
const JANELA_EM_SEGUNDOS = 60;

const querySchema = z.object({ sala: z.string().regex(/^[a-f0-9]{32}$/) });

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const limite = consumir(
    identificarChamador(request.headers, 'atd-ice'),
    LIMITE,
    JANELA_EM_SEGUNDOS,
  );
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429, headers: cabecalhosDoLimite(limite, LIMITE) },
    );
  }

  const parsed = querySchema.safeParse({ sala: request.nextUrl.searchParams.get('sala') ?? '' });
  if (!parsed.success) return NextResponse.json({ erro: 'sala inválida' }, { status: 400 });

  const escopo = await garantirParticipanteDaChamada({ sala: parsed.data.sala });
  if (!escopo.ok) return NextResponse.json({ erro: escopo.erro }, { status: escopo.status });

  return NextResponse.json(await gerarCredencialTurn(), {
    headers: { 'cache-control': 'private, no-store' },
  });
}
