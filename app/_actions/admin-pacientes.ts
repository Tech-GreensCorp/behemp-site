'use server';

import { db } from '@/lib/db';
import { users, pacientes, medicos } from '@/db/schema';
import { eq, and, isNull, ilike, desc, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { verificarAdmin } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/utils/audit';

/**
 * Listagem de pacientes para o admin (sidebar do admin → Pacientes).
 *
 * Separada de `listarPacientesPaginado` (médico) de propósito: aquela action é de produção
 * e filtra por `medicoId`; esta é estritamente admin, sem filtro de médico, e acrescenta o
 * médico responsável. Quem pode ler: só `admin`. Retenção: leitura, não grava nada.
 */

const filtrosSchema = z.object({
  busca: z.string().trim().max(100).optional(),
  status: z
    .enum(['todos', 'aguardando_consulta', 'em_tratamento', 'concluido', 'arquivado'])
    .default('todos'),
  tratamento: z.enum(['todos', 'cbd', 'thc', 'cbd_thc']).default('todos'),
  jornada: z
    .enum([
      'todos',
      'acolhimento',
      'avaliacao_medica',
      'burocracia_anvisa',
      'logistica',
      'acompanhamento_continuo',
    ])
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

export async function listarPacientesAdmin(entrada?: z.input<typeof filtrosSchema>): Promise<{
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

const arquivarSchema = z.object({
  pacienteId: z.string().min(1).max(64),
  motivo: z.string().trim().max(300).optional(),
});

/**
 * Arquiva um paciente (soft delete) — só admin.
 *
 * Some da lista e deixa de contar como paciente (a flag das triagens exige ficha ativa,
 * `deletedAt IS NULL`). NÃO apaga: a linha, o histórico clínico e os blobs ficam, e a
 * auditoria registra quem arquivou, quando, o estado anterior e o motivo (AGENTS.md:
 * entidade clínica preserva histórico). Não há "desarquivar" nesta versão.
 *
 * Não mexe em `users`/Clerk: a conta de acesso continua existindo.
 *
 * Por que não reaproveitar `arquivarPaciente` (pacientes.ts): aquela aceita médico e não
 * confere se o paciente é dele. Esta é exclusiva do admin, então não abre escopo entre médicos.
 */
export async function arquivarPacienteAdmin(
  entrada: z.input<typeof arquivarSchema>,
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: auth.erro ?? 'Sem permissão' };
    }

    const parsed = arquivarSchema.safeParse(entrada);
    if (!parsed.success) {
      return { sucesso: false, erro: 'Dados inválidos' };
    }
    const { pacienteId, motivo } = parsed.data;

    const [atual] = await db
      .select({ id: pacientes.id, status: pacientes.status })
      .from(pacientes)
      .where(and(eq(pacientes.id, pacienteId), isNull(pacientes.deletedAt)))
      .limit(1);

    if (!atual) {
      return { sucesso: false, erro: 'Paciente não encontrado ou já arquivado' };
    }

    const agora = new Date();
    // `deletedAt IS NULL` no UPDATE também: dois cliques simultâneos não arquivam duas vezes.
    const arquivados = await db
      .update(pacientes)
      .set({ status: 'arquivado', deletedAt: agora })
      .where(and(eq(pacientes.id, pacienteId), isNull(pacientes.deletedAt)))
      .returning({ id: pacientes.id });

    if (arquivados.length === 0) {
      return { sucesso: false, erro: 'Paciente não encontrado ou já arquivado' };
    }

    const [admin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, auth.clerkId))
      .limit(1);

    if (admin) {
      await registrarAuditoria({
        userId: admin.id,
        acao: 'deletar',
        entidade: 'pacientes',
        entidadeId: pacienteId,
        dadosAntes: { status: atual.status },
        dadosDepois: { status: 'arquivado', motivo: motivo ?? null },
      });
    }

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao arquivar paciente (admin):', error);
    return { sucesso: false, erro: 'Erro ao arquivar paciente' };
  }
}
