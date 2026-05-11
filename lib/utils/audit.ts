import { db } from '@/lib/db';
import { logsAuditoria } from '@/db/schema';
import { headers } from 'next/headers';

/**
 * Helper de auditoria — registra ações sobre dados sensíveis.
 * Obrigatório pela LGPD para dados clínicos.
 *
 * Deve ser chamado em toda Server Action que cria, atualiza ou remove
 * dados de pacientes, anamneses, evoluções, dosagens e documentos.
 *
 * Não falha a action se o registro de auditoria falhar
 * (log de erro no console, mas a ação principal segue).
 */

export type AcaoAuditoria = 'criar' | 'atualizar' | 'visualizar' | 'deletar';

export interface RegistrarAuditoriaParams {
  /** ID interno do usuário que realizou a ação */
  userId: string;
  /** Tipo de ação realizada */
  acao: AcaoAuditoria;
  /** Nome da tabela/entidade afetada */
  entidade: string;
  /** ID do registro afetado (se aplicável) */
  entidadeId?: string;
  /** Snapshot dos dados ANTES da alteração (para update/delete) */
  dadosAntes?: Record<string, unknown>;
  /** Snapshot dos dados DEPOIS da alteração (para create/update) */
  dadosDepois?: Record<string, unknown>;
}

/**
 * Registra uma entrada de auditoria no banco.
 * Captura automaticamente o IP do request (quando disponível).
 */
export async function registrarAuditoria(
  params: RegistrarAuditoriaParams,
): Promise<void> {
  try {
    let ip: string | null = null;

    try {
      const headersList = await headers();
      ip =
        headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        headersList.get('x-real-ip') ??
        null;
    } catch {
      // Headers podem não estar disponíveis em cron jobs — ignorar
    }

    await db.insert(logsAuditoria).values({
      userId: params.userId,
      acao: params.acao,
      entidade: params.entidade,
      entidadeId: params.entidadeId ?? null,
      dadosAntes: params.dadosAntes ?? null,
      dadosDepois: params.dadosDepois ?? null,
      ip,
    });
  } catch (error) {
    // Nunca falhar a action principal — apenas logar o erro
    console.error('[Auditoria] Erro ao registrar log:', error);
  }
}
