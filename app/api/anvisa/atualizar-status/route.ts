import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { autorizacoesAnvisa, users, logsAuditoria } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getPusherServer } from '@/lib/integrations/pusher/server';

const schema = z
  .object({
    autorizacaoId: z.string(),
    status: z.enum(['em_analise', 'aprovado', 'pendencia_documental', 'rejeitado']),
    numeroProcesso: z.string().optional(),
    observacoes: z.string().optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

  // Verificar role admin
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });
  }

  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 });

  const { autorizacaoId, status, numeroProcesso, observacoes } = parsed.data;

  const dadosUpdate: Record<string, unknown> = { status };
  if (numeroProcesso) dadosUpdate.numeroProcesso = numeroProcesso;
  if (observacoes) dadosUpdate.observacoesAnvisa = observacoes;
  if (status === 'aprovado') dadosUpdate.dataAprovacao = new Date();

  const [atualizado] = await db
    .update(autorizacoesAnvisa)
    .set(dadosUpdate)
    .where(eq(autorizacoesAnvisa.id, autorizacaoId))
    .returning({ pacienteId: autorizacoesAnvisa.pacienteId });

  // Notificar paciente via Pusher
  if (atualizado?.pacienteId) {
    const pusher = getPusherServer();
    await pusher
      .trigger(`private-user-${atualizado.pacienteId}`, 'anvisa:status-atualizado', {
        status,
        numeroProcesso,
        observacoes,
      })
      .catch(() => {});
  }

  // Auditoria
  await db
    .insert(logsAuditoria)
    .values({
      acao: 'ATUALIZAR_STATUS',
      entidade: 'autorizacoes_anvisa',
      entidadeId: autorizacaoId,
    })
    .catch(() => {});

  return NextResponse.json({ sucesso: true });
}
