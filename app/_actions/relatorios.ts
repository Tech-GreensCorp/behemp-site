'use server';

import { db } from '@/lib/db';
import { relatorios } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { verificarMedicoOuAdmin } from '@/lib/auth';

async function obterMedicoId(clerkId: string): Promise<string | null> {
  const res = await db.execute(
    sql`SELECT m.id FROM medicos m INNER JOIN users u ON m.user_id = u.id WHERE u.clerk_id = ${clerkId} LIMIT 1`,
  );
  return (res.rows[0]?.id as string) ?? null;
}

export async function criarRelatorio(pacienteId: string, urlPdf: string) {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };
    const medicoId = await obterMedicoId(auth.clerkId!);
    if (!medicoId) return { sucesso: false, erro: 'Médico não encontrado' };

    const [rel] = await db.insert(relatorios).values({
      pacienteId,
      titulo: 'Relatório Completo',
      urlPdf,
      criadoPor: medicoId,
    }).returning();

    return { sucesso: true, dados: rel };
  } catch (error) {
    console.error('[Action] Erro ao criar relatório:', error);
    return { sucesso: false, erro: 'Erro ao criar relatório' };
  }
}

export async function listarRelatorios(pacienteId: string) {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };
    const lista = await db.select().from(relatorios)
      .where(eq(relatorios.pacienteId, pacienteId))
      .orderBy(desc(relatorios.createdAt));
    return { sucesso: true, dados: lista };
  } catch (error) {
    console.error('[Action] Erro ao listar relatórios:', error);
    return { sucesso: false, erro: 'Erro ao listar relatórios' };
  }
}
