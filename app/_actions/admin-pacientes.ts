'use server';

import { db } from '@/lib/db';
import { users, pacientes, medicos } from '@/db/schema';
import { eq, and, isNull, ilike, desc, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { verificarAdmin } from '@/lib/auth';

/**
 * Listagem de pacientes para o admin (sidebar do admin → Pacientes).
 *
 * Separada de `listarPacientesPaginado` (médico) de propósito: aquela action é de produção
 * e filtra por `medicoId`; esta é estritamente admin, sem filtro de médico, e acrescenta o
 * médico responsável. Quem pode ler: só `admin`. Retenção: leitura, não grava nada.
 */

const filtrosSchema = z.object({
  busca: z.string().trim().max(100).optional(),
  status: z.enum(['todos', 'aguardando_consulta', 'em_tratamento', 'concluido', 'arquivado']).default('todos'),
  tratamento: z.enum(['todos', 'cbd', 'thc', 'cbd_thc']).default('todos'),
  jornada: z
    .enum(['todos', 'acolhimento', 'avaliacao_medica', 'burocracia_anvisa', 'logistica', 'acompanhamento_continuo'])
    .default('todos'),
  pagina: z.number().int().min(1).default(1),
  porPagina: z.number().int().min(1).max(100).default(20),
});

export type PacienteDoAdmin = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  status: string;
  jornadaFase: string | null;
  tratamentoTipo: string | null;
  medicoNome: string | null;
  createdAt: Date;
};

export async function listarPacientesAdmin(
  entrada?: z.input<typeof filtrosSchema>,
): Promise<{
  sucesso: boolean;
  dados?: { pacientes: PacienteDoAdmin[]; total: number; totalPaginas: number };
  erro?: string;
}> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const parsed = filtrosSchema.safeParse(entrada ?? {});
    if (!parsed.success) {
      return { sucesso: false, erro: 'Filtros inválidos' };
    }
    const { busca, status, tratamento, jornada, pagina, porPagina } = parsed.data;

    const medicoUser = alias(users, 'medico_user');

    const condicoes = [isNull(pacientes.deletedAt)];
    if (status !== 'todos') condicoes.push(eq(pacientes.status, status));
    if (tratamento !== 'todos') condicoes.push(eq(pacientes.tratamentoTipo, tratamento));
    if (jornada !== 'todos') condicoes.push(eq(pacientes.jornadaFase, jornada));
    if (busca) condicoes.push(ilike(users.nome, `%${busca}%`));
    const where = and(...condicoes);

    const linhas = await db
      .select({
        id: pacientes.id,
        nome: users.nome,
        email: users.email,
        telefone: users.telefone,
        status: pacientes.status,
        jornadaFase: pacientes.jornadaFase,
        tratamentoTipo: pacientes.tratamentoTipo,
        medicoNome: medicoUser.nome,
        createdAt: pacientes.createdAt,
      })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .leftJoin(medicos, eq(pacientes.medicoId, medicos.id))
      .leftJoin(medicoUser, eq(medicos.userId, medicoUser.id))
      .where(where)
      .orderBy(desc(pacientes.createdAt))
      .limit(porPagina)
      .offset((pagina - 1) * porPagina);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(where);

    const total = count ?? 0;
    return {
      sucesso: true,
      dados: { pacientes: linhas, total, totalPaginas: Math.max(1, Math.ceil(total / porPagina)) },
    };
  } catch (error) {
    console.error('[Action] Erro ao listar pacientes (admin):', error);
    return { sucesso: false, erro: 'Erro ao listar pacientes' };
  }
}
