'use server';

import { db } from '@/lib/db';
import { documentos } from '@/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { z } from 'zod';
import { verificarMedicoOuAdmin } from '@/lib/auth';
import { put } from '@vercel/blob';

/**
 * Server Actions de documentos de pacientes.
 *
 * Upload: salva no Vercel Blob Storage (precisa de BLOB_READ_WRITE_TOKEN no .env).
 * O arquivo é armazenado em documentos/<pacienteId>/<timestamp>-<nome>.
 */

const TIPOS_VALIDOS = [
  'rg',
  'rg_responsavel',
  'receita_medica',
  'comprovante_residencia',
  'autorizacao_anvisa',
  'documento_pessoal',
  'oficio_anvisa',
] as const;

const uploadDocumentoSchema = z.object({
  pacienteId: z.string().min(1, 'ID do paciente é obrigatório'),
  tipo: z.enum(TIPOS_VALIDOS),
  dataEmissao: z.string().min(1, 'Data de emissão é obrigatória'),
  observacoes: z.string().optional(),
});

export async function uploadDocumento(formData: FormData) {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    // Validar arquivo
    const file = formData.get('arquivo') as File | null;
    if (!file || file.size === 0) {
      return { sucesso: false, erro: 'Arquivo é obrigatório' };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { sucesso: false, erro: 'Arquivo excede 10MB' };
    }
    const tiposPermitidos = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!tiposPermitidos.includes(file.type)) {
      return { sucesso: false, erro: 'Tipo não permitido. Use PDF, JPG ou PNG' };
    }

    // Validar campos do formulário
    const dados = {
      pacienteId: formData.get('pacienteId') ?? '',
      tipo: formData.get('tipo') ?? '',
      dataEmissao: formData.get('dataEmissao') ?? '',
      observacoes: formData.get('observacoes') ?? undefined,
    };

    const parsed = uploadDocumentoSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    // Upload para Vercel Blob Storage
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const nomeSeguro = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const blobPath = `documentos/${parsed.data.pacienteId}/${nomeSeguro}`;

    const blob = await put(blobPath, file, { access: 'public' });

    // Calcular data de validade baseada no tipo
    const emissao = new Date(parsed.data.dataEmissao);
    const validade = new Date(emissao);
    if (
      parsed.data.tipo === 'autorizacao_anvisa' ||
      parsed.data.tipo === 'oficio_anvisa'
    ) {
      validade.setMonth(validade.getMonth() + 24);
    } else if (parsed.data.tipo === 'receita_medica') {
      validade.setMonth(validade.getMonth() + 6);
    } else {
      validade.setFullYear(validade.getFullYear() + 10);
    }

    const [doc] = await db
      .insert(documentos)
      .values({
        pacienteId: parsed.data.pacienteId,
        tipo: parsed.data.tipo as typeof documentos.$inferInsert.tipo,
        urlBlob: blob.url,
        nomeArquivo: file.name,
        dataEmissao: parsed.data.dataEmissao,
        dataValidade: validade.toISOString().split('T')[0],
        observacoes: parsed.data.observacoes ?? null,
      })
      .returning();

    return { sucesso: true, dados: doc };
  } catch (error) {
    console.error('[Action] Erro ao fazer upload:', error);
    return { sucesso: false, erro: 'Erro ao enviar documento. Tente novamente.' };
  }
}

export async function listarDocumentos(pacienteId: string) {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const lista = await db
      .select()
      .from(documentos)
      .where(and(eq(documentos.pacienteId, pacienteId), isNull(documentos.deletedAt)))
      .orderBy(desc(documentos.createdAt));

    return { sucesso: true, dados: lista };
  } catch (error) {
    console.error('[Action] Erro ao listar documentos:', error);
    return { sucesso: false, erro: 'Erro ao listar documentos' };
  }
}
