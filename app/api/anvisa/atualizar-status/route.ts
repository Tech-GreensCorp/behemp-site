import { NextRequest, NextResponse } from 'next/server';
import { notificarParceiro } from '@/lib/parceiros/notificar';
import { avisarAnvisaAprovada } from '@/lib/anvisa/avisar-aprovacao';
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

  /**
   * 🔴 AVISA O PARCEIRO QUE A AUTORIZAÇÃO SAIU (ADR-0016 D-09).
   *
   * Só quando o status é `aprovado`: os demais são etapas do processo, e avisar a cada
   * mudança encheria o funil do parceiro de ruído — ele quer saber que TERMINOU.
   *
   * `notificarParceiro` nunca lança, e só enfileira. A atualização de status não pode
   * falhar porque um parceiro está fora do ar.
   */
  if (status === 'aprovado' && atualizado?.pacienteId) {
    await notificarParceiro({ pacienteId: atualizado.pacienteId, tipo: 'anvisa_aprovada' });

    /**
     * 🔴 E O PACIENTE TAMBÉM É AVISADO (Item 29) — até 11/09/2026 havia só o Pusher, que é
     * tempo real: quem não estava com a aba aberta nunca soube que a autorização saiu.
     *
     * Nunca lança, pelo mesmo motivo do aviso ao parceiro: a aprovação já foi gravada, e um
     * provedor de e-mail fora do ar não pode desfazer isso.
     */
    await avisarAnvisaAprovada({
      pacienteId: atualizado.pacienteId,
      numeroProcesso: numeroProcesso ?? null,
    });
  }

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
