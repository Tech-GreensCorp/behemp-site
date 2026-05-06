'use server';

import { db } from '@/lib/db';
import { documentos } from '@/db/schema';
import { eq, and, lte, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { uploadDocumento, deletarDocumento } from '@/lib/integrations/blob';
import { calcularDataValidade } from '@/lib/utils/validade';

/**
 * Server Actions de upload e gestão de documentos do paciente.
 */

// ── Schemas ───────────────────────────────────────────────────

const criarDocumentoSchema = z.object({
  pacienteId: z.string().min(1),
  tipo: z.enum([
    'rg',
    'rg_responsavel',
    'receita_medica',
    'comprovante_residencia',
    'autorizacao_anvisa',
  ]),
  dataEmissao: z.string().min(1, 'Data de emissão é obrigatória'),
  observacoes: z.string().optional(),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Faz upload de um documento e salva no banco com validade calculada.
 */
export async function uploadDocumentoPaciente(
  formData: FormData,
): Promise<ActionResult<{ documentoId: string; url: string }>> {
  try {
    const arquivo = formData.get('arquivo') as File;
    const pacienteId = formData.get('pacienteId') as string;
    const tipo = formData.get('tipo') as string;
    const dataEmissao = formData.get('dataEmissao') as string;
    const observacoes = formData.get('observacoes') as string | null;

    // Validar metadados
    const parsed = criarDocumentoSchema.safeParse({
      pacienteId,
      tipo,
      dataEmissao,
      observacoes,
    });

    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    if (!arquivo || !(arquivo instanceof File)) {
      return { sucesso: false, erro: 'Arquivo é obrigatório' };
    }

    // Upload para Vercel Blob
    const resultadoUpload = await uploadDocumento({
      arquivo,
      nomeArquivo: arquivo.name,
      pacienteId: parsed.data.pacienteId,
      tipoDocumento: parsed.data.tipo,
    });

    if (!resultadoUpload.sucesso || !resultadoUpload.url) {
      return { sucesso: false, erro: resultadoUpload.erro || 'Falha no upload' };
    }

    // Calcular data de validade
    const dataEmissaoDate = new Date(parsed.data.dataEmissao);
    const dataValidade = calcularDataValidade(parsed.data.tipo, dataEmissaoDate);

    // Salvar no banco
    const [novoDocumento] = await db
      .insert(documentos)
      .values({
        pacienteId: parsed.data.pacienteId,
        tipo: parsed.data.tipo,
        urlBlob: resultadoUpload.url,
        nomeArquivo: arquivo.name,
        dataEmissao: parsed.data.dataEmissao,
        dataValidade: dataValidade
          ? dataValidade.toISOString().split('T')[0]
          : parsed.data.dataEmissao, // Se não expira, usa a data de emissão
        observacoes: parsed.data.observacoes,
      })
      .returning({ id: documentos.id });

    return {
      sucesso: true,
      dados: { documentoId: novoDocumento.id, url: resultadoUpload.url },
    };
  } catch (error) {
    console.error('[Action] Erro ao fazer upload de documento:', error);
    return { sucesso: false, erro: 'Erro interno ao processar documento' };
  }
}

/**
 * Remove (soft delete) um documento.
 */
export async function removerDocumento(
  documentoId: string,
): Promise<ActionResult> {
  try {
    if (!documentoId) {
      return { sucesso: false, erro: 'ID do documento é obrigatório' };
    }

    // Buscar documento
    const [doc] = await db
      .select()
      .from(documentos)
      .where(eq(documentos.id, documentoId))
      .limit(1);

    if (!doc) {
      return { sucesso: false, erro: 'Documento não encontrado' };
    }

    // Deletar do Blob
    await deletarDocumento(doc.urlBlob);

    // Soft delete no banco
    await db
      .update(documentos)
      .set({ deletedAt: new Date() })
      .where(eq(documentos.id, documentoId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao remover documento:', error);
    return { sucesso: false, erro: 'Erro ao remover documento' };
  }
}

/**
 * Lista documentos de um paciente (excluindo soft-deleted).
 */
export async function listarDocumentosPaciente(
  pacienteId: string,
): Promise<ActionResult<typeof documentos.$inferSelect[]>> {
  try {
    const resultado = await db
      .select()
      .from(documentos)
      .where(
        and(eq(documentos.pacienteId, pacienteId), isNull(documentos.deletedAt)),
      );

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar documentos:', error);
    return { sucesso: false, erro: 'Erro ao listar documentos' };
  }
}

/**
 * Busca documentos próximos do vencimento (próximos 30 dias).
 */
export async function buscarDocumentosVencendo(): Promise<
  ActionResult<typeof documentos.$inferSelect[]>
> {
  try {
    const hoje = new Date();
    const em30Dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);

    const resultado = await db
      .select()
      .from(documentos)
      .where(
        and(
          lte(documentos.dataValidade, em30Dias.toISOString().split('T')[0]),
          isNull(documentos.deletedAt),
        ),
      );

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao buscar documentos vencendo:', error);
    return { sucesso: false, erro: 'Erro ao buscar documentos' };
  }
}
