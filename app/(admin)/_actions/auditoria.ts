'use server';

import { db } from '@/lib/db';
import { logsAuditoria } from '@/db/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';

/**
 * Server Action de auditoria (LGPD).
 *
 * Toda operação sensível sobre dados de pacientes deve ser registrada.
 * Nunca incluir dados sensíveis (senhas, tokens) nos logs.
 */

// ── Types ─────────────────────────────────────────────────────

interface RegistrarLogParams {
  userId?: string;
  acao: string; // Ex: 'criar', 'atualizar', 'deletar', 'visualizar'
  entidade: string; // Ex: 'paciente', 'documento', 'evolucao'
  entidadeId?: string;
  dadosAntes?: Record<string, unknown>;
  dadosDepois?: Record<string, unknown>;
  ip?: string;
}

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Registra uma entrada no log de auditoria.
 */
export async function registrarLog(params: RegistrarLogParams): Promise<void> {
  try {
    await db.insert(logsAuditoria).values({
      userId: params.userId,
      acao: params.acao,
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      dadosAntes: params.dadosAntes,
      dadosDepois: params.dadosDepois,
      ip: params.ip,
    });
  } catch (error) {
    // Log de auditoria nunca deve impedir a operação principal
    console.error('[Auditoria] Erro ao registrar log:', error);
  }
}

/**
 * Lista logs de auditoria com filtros (admin only).
 */
export async function listarLogs(params: {
  userId?: string;
  entidade?: string;
  acao?: string;
  dataInicio?: string;
  dataFim?: string;
  limite?: number;
}): Promise<ActionResult<typeof logsAuditoria.$inferSelect[]>> {
  try {
    // TODO: verificarAdmin() quando Clerk estiver configurado

    const condicoes = [];

    if (params.userId) {
      condicoes.push(eq(logsAuditoria.userId, params.userId));
    }
    if (params.entidade) {
      condicoes.push(eq(logsAuditoria.entidade, params.entidade));
    }
    if (params.acao) {
      condicoes.push(eq(logsAuditoria.acao, params.acao));
    }
    if (params.dataInicio) {
      condicoes.push(gte(logsAuditoria.createdAt, new Date(params.dataInicio)));
    }
    if (params.dataFim) {
      condicoes.push(lte(logsAuditoria.createdAt, new Date(params.dataFim)));
    }

    const resultado = await db
      .select()
      .from(logsAuditoria)
      .where(condicoes.length > 0 ? and(...condicoes) : undefined)
      .orderBy(desc(logsAuditoria.createdAt))
      .limit(params.limite || 100);

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar logs:', error);
    return { sucesso: false, erro: 'Erro ao listar logs' };
  }
}
