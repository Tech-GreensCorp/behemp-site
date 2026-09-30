'use server';

import { db } from '@/lib/db';
import { users, procuracoesEspecificas, autorizacoesAnvisa } from '@/db/schema';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { verificarAdmin } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/utils/audit';

/**
 * Apagar Procuração Específica e Autorização ANVISA — somente admin.
 *
 * As duas são SOFT DELETE (`deletedAt`): são registro jurídico/regulatório, e as próprias
 * tabelas declaram "soft delete obrigatório" (LGPD art. 16). Os PDFs e anexos (blobs) NÃO são
 * removidos — `AGENTS.md`: "Não remova blobs se o histórico precisar existir para auditoria".
 * Cada exclusão grava auditoria com o estado anterior.
 *
 * Quem pode ler: admin. Retenção: a linha e os blobs ficam; só some das telas e leituras.
 */

const idSchema = z.string().min(1).max(64);

interface Resultado<T = undefined> {
  sucesso: boolean;
  erro?: string;
  dados?: T;
}

/**
 * Apaga uma Procuração Específica, em qualquer status (decisão do dono, 30/09/2026).
 *
 * ⚠️ Não cancela o envelope no DocuSign e não avisa o paciente. Se o envelope ainda estiver
 * aberto e for assinado depois, o webhook ainda atualiza a linha apagada.
 */
export async function apagarProcuracaoAdmin(procuracaoId: string): Promise<Resultado> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };

    const parsed = idSchema.safeParse(procuracaoId);
    if (!parsed.success) return { sucesso: false, erro: 'Dados inválidos' };

    const [atual] = await db
      .select({
        status: procuracoesEspecificas.docusignStatus,
        autorizacaoId: procuracoesEspecificas.autorizacaoId,
        pacienteId: procuracoesEspecificas.pacienteId,
      })
      .from(procuracoesEspecificas)
      .where(
        and(eq(procuracoesEspecificas.id, procuracaoId), isNull(procuracoesEspecificas.deletedAt)),
      )
      .limit(1);

    if (!atual) return { sucesso: false, erro: 'Procuração não encontrada ou já apagada' };

    // `deletedAt IS NULL` também no UPDATE: dois cliques não apagam duas vezes.
    const apagadas = await db
      .update(procuracoesEspecificas)
      .set({ deletedAt: new Date() })
      .where(
        and(eq(procuracoesEspecificas.id, procuracaoId), isNull(procuracoesEspecificas.deletedAt)),
      )
      .returning({ id: procuracoesEspecificas.id });

    if (apagadas.length === 0)
      return { sucesso: false, erro: 'Procuração não encontrada ou já apagada' };

    await auditar(auth.clerkId, 'procuracoes_especificas', procuracaoId, {
      docusignStatus: atual.status,
      autorizacaoId: atual.autorizacaoId,
      pacienteId: atual.pacienteId,
    });

    return { sucesso: true };
  } catch (error) {
    console.error('[Admin] Erro ao apagar procuração:', error);
    return { sucesso: false, erro: 'Erro ao apagar procuração' };
  }
}

/**
 * Apaga uma Autorização ANVISA que NÃO está aprovada (decisão do dono, 30/09/2026).
 *
 * A aprovada é recusada NO SERVIDOR (não só com o botão desabilitado), e o UPDATE repete a
 * condição: se o status virar `aprovado` entre a leitura e a escrita, nada é apagado.
 * O motivo de a aprovada ficar de fora: o motor de alertas (`lib/alertas/coletor.ts`) só filtra
 * `status = 'aprovado'`, não `deletedAt` — uma aprovada apagada continuaria gerando alerta de
 * vencimento, e aquele arquivo é protegido por hook.
 *
 * As Procurações ligadas FICAM (cada uma se apaga à parte); devolve quantas são, para a tela avisar.
 */
export async function apagarAutorizacaoAnvisaAdmin(
  autorizacaoId: string,
): Promise<Resultado<{ procuracoesLigadas: number }>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };

    const parsed = idSchema.safeParse(autorizacaoId);
    if (!parsed.success) return { sucesso: false, erro: 'Dados inválidos' };

    const [atual] = await db
      .select({ status: autorizacoesAnvisa.status, pacienteId: autorizacoesAnvisa.pacienteId })
      .from(autorizacoesAnvisa)
      .where(and(eq(autorizacoesAnvisa.id, autorizacaoId), isNull(autorizacoesAnvisa.deletedAt)))
      .limit(1);

    if (!atual) return { sucesso: false, erro: 'Autorização não encontrada ou já apagada' };

    if (atual.status === 'aprovado') {
      return {
        sucesso: false,
        erro: 'Uma autorização aprovada não pode ser apagada por esta tela',
      };
    }

    const apagadas = await db
      .update(autorizacoesAnvisa)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(autorizacoesAnvisa.id, autorizacaoId),
          isNull(autorizacoesAnvisa.deletedAt),
          ne(autorizacoesAnvisa.status, 'aprovado'),
        ),
      )
      .returning({ id: autorizacoesAnvisa.id });

    if (apagadas.length === 0) {
      return {
        sucesso: false,
        erro: 'A autorização mudou de estado e não foi apagada. Atualize a lista.',
      };
    }

    const [ligadas] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(procuracoesEspecificas)
      .where(
        and(
          eq(procuracoesEspecificas.autorizacaoId, autorizacaoId),
          isNull(procuracoesEspecificas.deletedAt),
        ),
      );

    await auditar(auth.clerkId, 'autorizacoes_anvisa', autorizacaoId, {
      status: atual.status,
      pacienteId: atual.pacienteId,
    });

    return { sucesso: true, dados: { procuracoesLigadas: ligadas?.n ?? 0 } };
  } catch (error) {
    console.error('[Admin] Erro ao apagar autorização ANVISA:', error);
    return { sucesso: false, erro: 'Erro ao apagar autorização' };
  }
}

/** Auditoria da exclusão. Falha de auditoria não desfaz a exclusão (já é assim em registrarAuditoria). */
async function auditar(
  adminClerkId: string,
  entidade: 'procuracoes_especificas' | 'autorizacoes_anvisa',
  entidadeId: string,
  antes: Record<string, unknown>,
): Promise<void> {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, adminClerkId))
    .limit(1);
  if (!admin) return;
  await registrarAuditoria({
    userId: admin.id,
    acao: 'deletar',
    entidade,
    entidadeId,
    dadosAntes: antes,
    dadosDepois: { apagado: true },
  });
}
