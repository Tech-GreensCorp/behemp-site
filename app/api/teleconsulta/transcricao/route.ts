import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transcricoes, teleconsultas, users, medicos } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

  const teleconsultaId = request.nextUrl.searchParams.get('teleconsultaId');
  if (!teleconsultaId) return NextResponse.json({ erro: 'teleconsultaId obrigatório' }, { status: 400 });

  // Verificar acesso — apenas médico da consulta ou admin
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);
  if (!user) return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 });

  // Buscar teleconsulta
  const [sala] = await db
    .select({ medicoId: teleconsultas.medicoId })
    .from(teleconsultas)
    .where(and(eq(teleconsultas.id, teleconsultaId), isNull(teleconsultas.deletedAt)))
    .limit(1);
  if (!sala) return NextResponse.json({ erro: 'Consulta não encontrada' }, { status: 404 });

  // Verificar permissão
  if (user.role !== 'admin') {
    const [medico] = await db
      .select({ id: medicos.id })
      .from(medicos)
      .where(and(eq(medicos.userId, user.id), eq(medicos.id, sala.medicoId)))
      .limit(1);
    if (!medico) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });
  }

  // Buscar transcrição
  const [transcricao] = await db
    .select({
      id: transcricoes.id,
      status: transcricoes.status,
      narrativa: transcricoes.narrativa,
      textoCompleto: transcricoes.textoCompleto,
      modeloUsado: transcricoes.modeloUsado,
      duracaoSegundos: transcricoes.duracaoSegundos,
      createdAt: transcricoes.createdAt,
    })
    .from(transcricoes)
    .where(eq(transcricoes.teleconsultaId, teleconsultaId))
    .limit(1);

  if (!transcricao) {
    return NextResponse.json({ sucesso: true, dados: null });
  }

  return NextResponse.json({ sucesso: true, dados: transcricao });
}
