'use server';

import { db } from '@/lib/db';
import { evolucoes, users } from '@/db/schema';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { verificarMedicoOuAdmin } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/utils/audit';

async function obterMedicoId(clerkId: string): Promise<string | null> {
  const res = await db.execute(
    sql`SELECT m.id FROM medicos m INNER JOIN users u ON m.user_id = u.id WHERE u.clerk_id = ${clerkId} LIMIT 1`,
  );
  return (res.rows[0]?.id as string) ?? null;
}

const criarEvolucaoSchema = z.object({
  pacienteId: z.string().min(1),
  data: z.string().min(1, 'Data é obrigatória'),
  tipo: z.enum(['positiva', 'estavel', 'negativa']),
  sintomasAtuais: z.string().optional(),
  efeitosColaterais: z.string().optional(),
  nivelDor: z.number().min(0).max(10).optional(),
  qualidadeSono: z.enum(['ruim', 'regular', 'boa', 'excelente']).optional(),
  bemEstar: z.enum(['ruim', 'regular', 'boa', 'excelente']).optional(),
  conteudo: z.string().min(1, 'Observações são obrigatórias'),
});

export async function criarEvolucao(dados: z.infer<typeof criarEvolucaoSchema>) {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };
    const parsed = criarEvolucaoSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };
    const medicoId = await obterMedicoId(auth.clerkId!);
    if (!medicoId) return { sucesso: false, erro: 'Médico não encontrado' };

    const [nova] = await db.insert(evolucoes).values({
      pacienteId: parsed.data.pacienteId,
      data: parsed.data.data,
      tipo: parsed.data.tipo,
      sintomasAtuais: parsed.data.sintomasAtuais || null,
      efeitosColaterais: parsed.data.efeitosColaterais || null,
      nivelDor: parsed.data.nivelDor ?? null,
      qualidadeSono: parsed.data.qualidadeSono ?? null,
      bemEstar: parsed.data.bemEstar ?? null,
      conteudo: parsed.data.conteudo,
      criadoPor: medicoId,
    }).returning();

    // Registrar auditoria LGPD
    const userIdInterno = await obterUserIdInterno(auth.clerkId!);
    if (userIdInterno) {
      await registrarAuditoria({
        userId: userIdInterno,
        acao: 'criar',
        entidade: 'evolucoes',
        entidadeId: nova.id,
        dadosDepois: { pacienteId: parsed.data.pacienteId, tipo: parsed.data.tipo },
      });
    }

    return { sucesso: true, dados: nova };
  } catch (error) {
    console.error('[Action] Erro ao criar evolução:', error);
    return { sucesso: false, erro: 'Erro ao criar evolução' };
  }
}

export async function listarEvolucoes(pacienteId: string) {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };
    const lista = await db.select().from(evolucoes)
      .where(and(eq(evolucoes.pacienteId, pacienteId), isNull(evolucoes.deletedAt)))
      .orderBy(desc(evolucoes.data));
    return { sucesso: true, dados: lista };
  } catch (error) {
    console.error('[Action] Erro ao listar evoluções:', error);
    return { sucesso: false, erro: 'Erro ao listar evoluções' };
  }
}

/**
 * Busca o userId interno a partir do clerkId (para auditoria).
 */
async function obterUserIdInterno(clerkId: string): Promise<string | null> {
  const res = await db.execute(
    sql`SELECT u.id FROM users u WHERE u.clerk_id = ${clerkId} LIMIT 1`,
  );
  return (res.rows[0]?.id as string) ?? null;
}
