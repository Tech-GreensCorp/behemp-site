import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { evolucoes, teleconsultas } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { garantirDonoDaSala } from '@/lib/auth/escopo-sala';
import { registrarAuditoria } from '@/lib/utils/audit';

// 🔴 CORRIGIDO EM 20/08/2026 — Item 11 de docs/04-LISTA-DE-AFAZERES.md.
// Antes, este handler recebia `pacienteId` DO BODY e inseria uma evolução clínica com ele,
// conferindo apenas que o autor era *algum* médico. Ou seja: qualquer médico escrevia
// evolução clínica, com texto livre, no prontuário de qualquer paciente. Sem Zod e sem
// auditoria. Agora o paciente é derivado DA SALA, e a sala tem de ser do médico logado.

const corpoSchema = z.object({
  salaId: z.string().min(1).max(64),
  narrativaAprovada: z.string().min(1).max(50_000),
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
  const { salaId, narrativaAprovada } = parsed.data;

  // Escopo de objeto: a sala tem de ser deste médico.
  const escopo = await garantirDonoDaSala({ salaId });
  if (!escopo.ok) {
    return NextResponse.json({ erro: escopo.erro }, { status: escopo.status });
  }

  // Aprovar narrativa é ato clínico assinado: só o médico da consulta o pratica. Admin
  // administra a plataforma, não assina evolução no prontuário.
  if (escopo.sala.papel !== 'medico') {
    return NextResponse.json({ erro: 'Apenas o médico da consulta pode aprovar' }, { status: 403 });
  }

  // pacienteId e medicoId vêm DA SALA — nunca do cliente.
  const [evolucao] = await db
    .insert(evolucoes)
    .values({
      pacienteId: escopo.sala.pacienteId,
      criadoPor: escopo.sala.medicoId,
      data: new Date().toISOString(),
      conteudo: `[NARRATIVA IA - APROVADA PELO MÉDICO]\n\n${narrativaAprovada}`,
      tipo: 'positiva',
    })
    .returning();

  // Comportamento preservado da versão anterior: aprovar a narrativa encerra a sala.
  // ⚠️ É efeito colateral não óbvio — o comentário original dizia "Ajustado para atualizar
  // algum campo válido", o que indica intenção perdida. Mudar isso é regra de negócio, e
  // está catalogado, não decidido aqui.
  await db
    .update(teleconsultas)
    .set({ status: 'encerrada' })
    .where(eq(teleconsultas.id, escopo.sala.salaId));

  // Auditoria com QUEM e de onde — via o helper que o resto do repositório já usa.
  await registrarAuditoria({
    userId: escopo.sala.userId,
    acao: 'criar',
    entidade: 'evolucoes',
    entidadeId: evolucao?.id,
    dadosDepois: { origem: 'narrativa-ia-aprovada', teleconsultaId: escopo.sala.salaId },
  });

  return NextResponse.json({ sucesso: true });
}
