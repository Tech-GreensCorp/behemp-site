/**
 * A ENTREGA AUTENTICADA DO PDF ASSINADO DE UM COMUNICADO.
 *
 * Quem pode ler: o PRÓPRIO paciente (dono da linha) e o admin. Médico não. Tudo que não pode
 * responde 404 — nunca 403, para a rota não virar oráculo de ids (mesma decisão de
 * `/api/documentos/[id]/arquivo`). O arquivo está em store PRIVADO: só esta rota o abre, e cada
 * abertura é auditada.
 */
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';

import { comunicadosAssinatura, pacientes, users } from '@/db/schema';
import { obterUsuarioAtual } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { ehDoStorePrivado, lerDocumentoPrivado } from '@/lib/documentos/store-privado';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';
import { registrarAuditoria } from '@/lib/utils/audit';

/** 30 leituras por minuto por chamador — mesmo teto da entrega de documentos (OWASP API4:2023). */
const LIMITE = 30;
const JANELA_EM_SEGUNDOS = 60;

/** Lê dado de saúde: nunca pode ser servida de cache compartilhado. */
export const dynamic = 'force-dynamic';

const NAO_ENCONTRADO = () =>
  NextResponse.json({ erro: 'Documento não encontrado' }, { status: 404 });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const limite = consumir(
    identificarChamador(request.headers, 'comunicado'),
    LIMITE,
    JANELA_EM_SEGUNDOS,
  );
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429, headers: cabecalhosDoLimite(limite, LIMITE) },
    );
  }

  const perm = await obterUsuarioAtual();
  if (!perm.autorizado || !perm.clerkId) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
  }

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(and(eq(users.clerkId, perm.clerkId), isNull(users.deletedAt)))
    .limit(1);
  if (!user) return NAO_ENCONTRADO();

  const [c] = await db
    .select({
      id: comunicadosAssinatura.id,
      pacienteId: comunicadosAssinatura.pacienteId,
      titulo: comunicadosAssinatura.titulo,
      status: comunicadosAssinatura.status,
      urlPdfAssinado: comunicadosAssinatura.urlPdfAssinado,
    })
    .from(comunicadosAssinatura)
    .where(eq(comunicadosAssinatura.id, id))
    .limit(1);
  if (!c || !c.urlPdfAssinado) return NAO_ENCONTRADO();
  // `cancelado` é o comunicado REINICIADO pelo admin: o PDF assinado fica guardado para auditoria,
  // e só o admin o abre. O paciente só abre o que está `assinado`.
  if (c.status !== 'assinado' && !(c.status === 'cancelado' && user.role === 'admin')) {
    return NAO_ENCONTRADO();
  }

  // Escopo de objeto: admin, ou o paciente dono do comunicado. Mais ninguém.
  if (user.role !== 'admin') {
    const [dono] = await db
      .select({ id: pacientes.id })
      .from(pacientes)
      .where(
        and(
          eq(pacientes.id, c.pacienteId),
          eq(pacientes.userId, user.id),
          isNull(pacientes.deletedAt),
        ),
      )
      .limit(1);
    if (!dono) return NAO_ENCONTRADO();
  }

  await registrarAuditoria({
    userId: user.id,
    acao: 'visualizar',
    entidade: 'comunicados_assinatura',
    entidadeId: c.id,
  }).catch(() => {});

  try {
    // O PDF assinado só nasce em store privado; recusa qualquer outra coisa.
    if (!ehDoStorePrivado(c.urlPdfAssinado)) return NAO_ENCONTRADO();
    const privado = await lerDocumentoPrivado(c.urlPdfAssinado);
    if (!privado) return NextResponse.json({ erro: 'Documento indisponível' }, { status: 502 });
    return new NextResponse(privado.stream, {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="${c.id}-assinado.pdf"`,
        'cache-control': 'private, no-store',
      },
    });
  } catch (erro) {
    console.error(
      '[comunicados] falha ao entregar arquivo:',
      erro instanceof Error ? erro.message : 'erro desconhecido',
    );
    return NextResponse.json({ erro: 'Documento indisponível' }, { status: 502 });
  }
}
