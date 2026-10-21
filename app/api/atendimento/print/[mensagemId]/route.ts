/**
 * ENTREGA DO PRINT DO CHAT DO ATENDIMENTO — ADR-0029 D-18.
 *
 * O print pode mostrar RG, receita ou a tela do Gov.br: é arquivo sensível. Ele mora no store
 * PRIVADO, e esta é a única porta para vê-lo, na mesma ordem da entrega de documento do paciente
 * (`app/api/documentos/[id]/arquivo/route.ts`):
 *
 *   1. limite de requisição, antes de tudo;
 *   2. escopo de objeto: só o paciente do pedido e o admin — "não existe" e "não é seu" dão o
 *      MESMO 404 (403 seria oráculo de enumeração);
 *   3. `visualizar` auditado ANTES de entregar;
 *   4. sem cache: `private, no-store`.
 *
 * Ver o print depois que a chamada acabou é permitido (`exigirAberta: false`): é ler o que já foi
 * dito, não agir na sala.
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { chamadasDeAtendimento, mensagensDeAtendimento } from '@/db/schema';
import { garantirParticipanteDaChamada } from '@/lib/auth/escopo-chamada';
import { db } from '@/lib/db';
import { ehDoStorePrivado, lerDocumentoPrivado } from '@/lib/documentos/store-privado';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';
import { registrarAuditoria } from '@/lib/utils/audit';

const LIMITE = 60;
const JANELA_EM_SEGUNDOS = 60;
const NAO_ENCONTRADO = () => NextResponse.json({ erro: 'Print não encontrado' }, { status: 404 });

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mensagemId: string }> },
) {
  const limite = consumir(
    identificarChamador(request.headers, 'atd-print'),
    LIMITE,
    JANELA_EM_SEGUNDOS,
  );
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429, headers: cabecalhosDoLimite(limite, LIMITE) },
    );
  }

  const { mensagemId } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(mensagemId)) return NAO_ENCONTRADO();

  const [linha] = await db
    .select({ printUrl: mensagensDeAtendimento.printUrl, sala: chamadasDeAtendimento.sala })
    .from(mensagensDeAtendimento)
    .innerJoin(
      chamadasDeAtendimento,
      eq(chamadasDeAtendimento.id, mensagensDeAtendimento.chamadaId),
    )
    .where(eq(mensagensDeAtendimento.id, mensagemId))
    .limit(1);
  if (!linha?.printUrl) return NAO_ENCONTRADO();

  const escopo = await garantirParticipanteDaChamada({ sala: linha.sala, exigirAberta: false });
  if (!escopo.ok) {
    return escopo.status === 401
      ? NextResponse.json({ erro: escopo.erro }, { status: 401 })
      : NAO_ENCONTRADO();
  }

  await registrarAuditoria({
    userId: escopo.userId,
    acao: 'visualizar',
    entidade: 'mensagens_de_atendimento',
    entidadeId: mensagemId,
  }).catch(() => {});

  // Só o store privado serve: um print em store público seria o Item 6 voltando por aqui.
  if (!ehDoStorePrivado(linha.printUrl)) return NAO_ENCONTRADO();
  const privado = await lerDocumentoPrivado(linha.printUrl).catch(() => null);
  if (!privado) return NAO_ENCONTRADO();

  return new NextResponse(privado.stream, {
    headers: {
      'content-type': privado.contentType,
      'content-disposition': `inline; filename="print-${mensagemId}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
