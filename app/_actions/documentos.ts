'use server';

import { db } from '@/lib/db';
import { documentos, pacientes, users } from '@/db/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { verificarMedicoOuAdmin } from '@/lib/auth';
import { put, del } from '@vercel/blob';
import { registrarAuditoria } from '@/lib/utils/audit';

/**
 * Server Actions para gestão de documentos do paciente.
 * Upload via Vercel Blob + registro no banco.
 */

// ── Schemas ───────────────────────────────────────────────────

const uploadDocumentoSchema = z.object({
  pacienteId: z.string().min(1),
  tipo: z.enum(['rg', 'rg_responsavel', 'receita_medica', 'comprovante_residencia', 'autorizacao_anvisa']),
  dataEmissao: z.string().min(1, 'Data de emissão é obrigatória'),
  observacoes: z.string().optional(),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Funções de cálculo ────────────────────────────────────────

/**
 * Calcula data de validade baseada no tipo do documento.
 * - Autorização Anvisa: 24 meses
 * - Receita médica: 6 meses
 * - Outros: sem validade (usa data distante)
 */
function calcularValidade(tipo: string, dataEmissao: string): string {
  const data = new Date(dataEmissao);

  switch (tipo) {
    case 'autorizacao_anvisa':
      data.setMonth(data.getMonth() + 24);
      break;
    case 'receita_medica':
      data.setMonth(data.getMonth() + 6);
      break;
    default:
      // Documentos sem validade: 100 anos
      data.setFullYear(data.getFullYear() + 100);
      break;
  }

  return data.toISOString().split('T')[0];
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Faz upload de um documento para o Vercel Blob e salva no banco.
 */
export async function uploadDocumento(
  formData: FormData,
): Promise<ActionResult<{ documentoId: string }>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const arquivo = formData.get('arquivo') as File | null;
    const pacienteId = formData.get('pacienteId') as string;
    const tipo = formData.get('tipo') as string;
    const dataEmissao = formData.get('dataEmissao') as string;
    const observacoes = formData.get('observacoes') as string | null;

    const parsed = uploadDocumentoSchema.safeParse({
      pacienteId,
      tipo,
      dataEmissao,
      observacoes: observacoes || undefined,
    });

    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    if (!arquivo || arquivo.size === 0) {
      return { sucesso: false, erro: 'Arquivo é obrigatório' };
    }

    // Upload para Vercel Blob
    const blob = await put(
      `documentos/${pacienteId}/${tipo}_${Date.now()}_${arquivo.name}`,
      arquivo,
      { access: 'public' },
    );

    // Calcular validade
    const dataValidade = calcularValidade(tipo, dataEmissao);

    // Salvar no banco
    const [doc] = await db
      .insert(documentos)
      .values({
        pacienteId: parsed.data.pacienteId,
        tipo: parsed.data.tipo,
        urlBlob: blob.url,
        nomeArquivo: arquivo.name,
        dataEmissao: parsed.data.dataEmissao,
        dataValidade,
        observacoes: parsed.data.observacoes,
      })
      .returning({ id: documentos.id });

    // Registrar auditoria LGPD
    const userIdInterno = await obterUserIdInterno(auth.clerkId!);
    if (userIdInterno) {
      await registrarAuditoria({
        userId: userIdInterno,
        acao: 'criar',
        entidade: 'documentos',
        entidadeId: doc.id,
        dadosDepois: { tipo: parsed.data.tipo, pacienteId: parsed.data.pacienteId, nomeArquivo: arquivo.name },
      });
    }

    return { sucesso: true, dados: { documentoId: doc.id } };
  } catch (error) {
    console.error('[Action] Erro ao upload documento:', error);
    return { sucesso: false, erro: 'Erro ao fazer upload do documento' };
  }
}

/**
 * Remove um documento (soft delete + remove do Blob).
 */
export async function removerDocumento(
  documentoId: string,
): Promise<ActionResult> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    // Buscar URL do blob para deletar
    const [doc] = await db
      .select({ urlBlob: documentos.urlBlob })
      .from(documentos)
      .where(eq(documentos.id, documentoId))
      .limit(1);

    if (doc?.urlBlob) {
      try {
        await del(doc.urlBlob);
      } catch {
        // Se falhar a remoção do blob, continua com soft delete
        console.warn('[Action] Falha ao remover blob, continuando com soft delete');
      }
    }

    // Soft delete
    await db
      .update(documentos)
      .set({ deletedAt: new Date() })
      .where(eq(documentos.id, documentoId));

    // Registrar auditoria LGPD
    const userIdInterno = await obterUserIdInterno(auth.clerkId!);
    if (userIdInterno) {
      await registrarAuditoria({
        userId: userIdInterno,
        acao: 'deletar',
        entidade: 'documentos',
        entidadeId: documentoId,
      });
    }

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao remover documento:', error);
    return { sucesso: false, erro: 'Erro ao remover documento' };
  }
}

/**
 * Lista documentos de um paciente.
 */
export async function listarDocumentos(
  pacienteId: string,
): Promise<ActionResult<typeof documentos.$inferSelect[]>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const resultado = await db
      .select()
      .from(documentos)
      .where(
        and(
          eq(documentos.pacienteId, pacienteId),
          isNull(documentos.deletedAt),
        ),
      )
      .orderBy(desc(documentos.createdAt));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar documentos:', error);
    return { sucesso: false, erro: 'Erro ao listar documentos' };
  }
}

/**
 * Busca o userId interno a partir do clerkId (para auditoria).
 */
async function obterUserIdInterno(clerkId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return user?.id ?? null;
}
