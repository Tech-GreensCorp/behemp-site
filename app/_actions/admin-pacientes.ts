'use server';

import { db } from '@/lib/db';
import { users, pacientes, medicos, logsAuditoria } from '@/db/schema';
import { eq, and, or, isNull, isNotNull, ilike, desc, sql } from 'drizzle-orm';
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
  /** Ficha arquivada (soft delete). Só aparece com o filtro de status "Arquivado". */
  arquivado: boolean;
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
    const { busca, status, pagina, porPagina } = parsed.data;

    const medicoUser = alias(users, 'medico_user');

    // Arquivar é soft delete: grava `status = 'arquivado'` E `deletedAt`. A lista comum só traz
    // fichas ativas ("Todos os status" = todos os ATIVOS); o filtro "Arquivado" é o único que
    // inverte a condição. Antes, `deletedAt IS NULL` valia sempre, e esse filtro nunca achava
    // ninguém, mesmo com fichas arquivadas no banco.
    const condicoes =
      status === 'arquivado'
        ? [isNotNull(pacientes.deletedAt)]
        : [isNull(pacientes.deletedAt)];
    if (status !== 'todos' && status !== 'arquivado') condicoes.push(eq(pacientes.status, status));
    // Nome OU e-mail (como nas telas Usuários e Atribuir Médico).
    if (busca) {
      const termo = `%${busca}%`;
      condicoes.push(or(ilike(users.nome, termo), ilike(users.email, termo))!);
    }
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
        arquivado: sql<boolean>`${pacientes.deletedAt} IS NOT NULL`,
      })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .leftJoin(medicos, eq(pacientes.medicoId, medicos.id))
      .leftJoin(medicoUser, eq(medicos.userId, medicoUser.id))
      .where(where)
      // Mais recente primeiro. O `id` desempata: importação e conversão gravam várias fichas no
      // mesmo instante, e sem desempate a paginação por OFFSET repete uma ficha e perde outra.
      .orderBy(desc(pacientes.createdAt), desc(pacientes.id))
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
 * entidade clínica preserva histórico). Quem desfaz é `reativarPacienteAdmin`, abaixo.
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

const reativarSchema = z.object({
  pacienteId: z.string().min(1).max(64),
  motivo: z.string().trim().max(300).optional(),
});

const STATUS_REATIVAVEIS = ['aguardando_consulta', 'em_tratamento', 'concluido'] as const;

/**
 * Reativa um paciente arquivado — só admin (decisão do dono, nov/2026).
 *
 * Desfaz o soft delete: `deletedAt` volta a NULL e o status volta ao que a ficha tinha ANTES de
 * arquivar (lido do último registro de auditoria "deletar" desta ficha; sem ele, `aguardando_consulta`).
 * Nada é apagado nem recriado: histórico clínico, médico e documentos permanecem. A auditoria
 * registra quem reativou, quando, o estado anterior e o motivo — e o registro do arquivamento
 * continua lá (auditoria nunca se sobrescreve).
 *
 * Recusa: ficha não arquivada, e ficha cujo USUÁRIO foi apagado (`users.deletedAt` — o e-mail foi
 * liberado e o login removido; reativar daria ficha ativa sem dono).
 */
export async function reativarPacienteAdmin(
  entrada: z.input<typeof reativarSchema>,
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: auth.erro ?? 'Sem permissão' };
    }

    const parsed = reativarSchema.safeParse(entrada);
    if (!parsed.success) return { sucesso: false, erro: 'Dados inválidos' };
    const { pacienteId, motivo } = parsed.data;

    const [atual] = await db
      .select({ id: pacientes.id, userApagadoEm: users.deletedAt })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(and(eq(pacientes.id, pacienteId), isNotNull(pacientes.deletedAt)))
      .limit(1);

    if (!atual) return { sucesso: false, erro: 'Paciente não encontrado ou não está arquivado' };
    if (atual.userApagadoEm) {
      return { sucesso: false, erro: 'A conta deste paciente foi apagada e não pode ser reativada.' };
    }

    // Status de antes do arquivamento, da própria auditoria.
    const [ultimo] = await db
      .select({ dadosAntes: logsAuditoria.dadosAntes })
      .from(logsAuditoria)
      .where(
        and(
          eq(logsAuditoria.entidade, 'pacientes'),
          eq(logsAuditoria.entidadeId, pacienteId),
          eq(logsAuditoria.acao, 'deletar'),
        ),
      )
      .orderBy(desc(logsAuditoria.createdAt))
      .limit(1);
    const anterior = (ultimo?.dadosAntes as { status?: string } | null)?.status;
    const status =
      STATUS_REATIVAVEIS.find((s) => s === anterior) ?? 'aguardando_consulta';

    // `deletedAt IS NOT NULL` no UPDATE: dois cliques não reativam duas vezes.
    const reativados = await db
      .update(pacientes)
      .set({ status, deletedAt: null })
      .where(and(eq(pacientes.id, pacienteId), isNotNull(pacientes.deletedAt)))
      .returning({ id: pacientes.id });
    if (reativados.length === 0) {
      return { sucesso: false, erro: 'Paciente não encontrado ou não está arquivado' };
    }

    const [admin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, auth.clerkId))
      .limit(1);
    if (admin) {
      await registrarAuditoria({
        userId: admin.id,
        acao: 'atualizar',
        entidade: 'pacientes',
        entidadeId: pacienteId,
        dadosAntes: { status: 'arquivado' },
        dadosDepois: { status, reativado: true, motivo: motivo ?? null },
      });
    }

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao reativar paciente (admin):', error);
    return { sucesso: false, erro: 'Erro ao reativar paciente' };
  }
}
