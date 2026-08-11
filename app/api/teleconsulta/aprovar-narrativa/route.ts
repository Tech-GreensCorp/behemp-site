import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { evolucoes, users, medicos, teleconsultas } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

  const { salaId, narrativaAprovada, pacienteId, consultaId } = await request.json();

  // Buscar médico
  const [user] = await db.select({ id: users.id })
    .from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!user) return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 });

  const [medico] = await db.select({ id: medicos.id })
    .from(medicos).where(eq(medicos.userId, user.id)).limit(1);
  if (!medico) return NextResponse.json({ erro: 'Médico não encontrado' }, { status: 403 });

  // Salvar como evolução clínica (tipo: positiva por padrão)
  await db.insert(evolucoes).values({
    pacienteId,
    medicoId: medico.id,
    consultaId: consultaId ?? undefined,
    texto: `[NARRATIVA IA - APROVADA PELO MÉDICO]\n\n${narrativaAprovada}`,
    tipo: 'positiva',
  });

  // Atualizar transcrição como aprovada
  await db.update(teleconsultas)
    .set({ narrativaAprovada: true } as any)
    .where(eq(teleconsultas.id, salaId))
    .catch(() => {});

  return NextResponse.json({ sucesso: true });
}
