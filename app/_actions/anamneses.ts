'use server';

import { db } from '@/lib/db';
import { anamneses, users } from '@/db/schema';
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

const criarAnamneseSchema = z.object({
  pacienteId: z.string().min(1),
  queixaPrincipal: z.string().min(1, 'Queixa principal é obrigatória'),
  historiaDoencaAtual: z.string().min(1, 'História da doença atual é obrigatória'),
  doencasPrevias: z.string().optional(),
  medicamentosEmUso: z.string().optional(),
  alergias: z.string().optional(),
  historicoFamiliar: z.string().optional(),
  historiaSocial: z.string().optional(),
  tabagismo: z.enum(['nunca_fumou', 'ex_fumante', 'fumante']),
  consumoAlcool: z.enum(['nao_consome', 'regular', 'ocasional']),
  qualidadeSono: z.enum(['ruim', 'regular', 'boa', 'excelente']),
  atividadeFisica: z.string().optional(),
  nivelDor: z.number().min(0).max(10).optional(),
  objetivosTratamento: z.string().optional(),
  usoPrevioCannabis: z.boolean().optional(),
});

export async function criarAnamnese(dados: z.infer<typeof criarAnamneseSchema>) {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };
    const parsed = criarAnamneseSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };
    const medicoId = await obterMedicoId(auth.clerkId!);
    if (!medicoId) return { sucesso: false, erro: 'Médico não encontrado' };

    const [nova] = await db.insert(anamneses).values({
      pacienteId: parsed.data.pacienteId,
      queixaPrincipal: parsed.data.queixaPrincipal,
      historiaDoencaAtual: parsed.data.historiaDoencaAtual,
      doencasPrevias: parsed.data.doencasPrevias || null,
      medicamentosEmUso: parsed.data.medicamentosEmUso || null,
      alergias: parsed.data.alergias || null,
      historicoFamiliar: parsed.data.historicoFamiliar || null,
      historiaSocial: parsed.data.historiaSocial || null,
      tabagismo: parsed.data.tabagismo,
      consumoAlcool: parsed.data.consumoAlcool,
      qualidadeSono: parsed.data.qualidadeSono,
      atividadeFisica: parsed.data.atividadeFisica || null,
      nivelDor: parsed.data.nivelDor ?? null,
      objetivosTratamento: parsed.data.objetivosTratamento || null,
      usoPrevioCannabis: parsed.data.usoPrevioCannabis ?? false,
      conteudo: null,
      criadoPor: medicoId,
    }).returning();

    // Registrar auditoria LGPD
    const userIdInterno = await obterUserIdInterno(auth.clerkId!);
    if (userIdInterno) {
      await registrarAuditoria({
        userId: userIdInterno,
        acao: 'criar',
        entidade: 'anamneses',
        entidadeId: nova.id,
        dadosDepois: { pacienteId: parsed.data.pacienteId, queixaPrincipal: parsed.data.queixaPrincipal },
      });
    }

    return { sucesso: true, dados: nova };
  } catch (error) {
    console.error('[Action] Erro ao criar anamnese:', error);
    return { sucesso: false, erro: 'Erro ao criar anamnese' };
  }
}

export async function listarAnamneses(pacienteId: string) {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };
    const lista = await db.select().from(anamneses)
      .where(and(eq(anamneses.pacienteId, pacienteId), isNull(anamneses.deletedAt)))
      .orderBy(desc(anamneses.createdAt));
    return { sucesso: true, dados: lista };
  } catch (error) {
    console.error('[Action] Erro ao listar anamneses:', error);
    return { sucesso: false, erro: 'Erro ao listar anamneses' };
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
