import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documentos } from '@/db/schema';
import { verificarMedicoOuAdmin } from '@/lib/auth';
import { z } from 'zod';

/**
 * API Route para upload de documentos de pacientes.
 *
 * Usa Vercel Blob Storage (precisa de BLOB_BEHEMP_READ_WRITE_TOKEN no .env).
 * Migrado de server action para API route para evitar conflitos com o middleware
 * do Clerk ao enviar FormData com arquivos binários.
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

const uploadSchema = z.object({
  pacienteId: z.string().min(1, 'ID do paciente é obrigatório'),
  tipo: z.enum(TIPOS_VALIDOS),
  dataEmissao: z.string().min(1, 'Data de emissão é obrigatória'),
  observacoes: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    // Verificar autenticação
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return NextResponse.json(
        { sucesso: false, erro: auth.erro },
        { status: 401 },
      );
    }

    const formData = await request.formData();

    // Validar arquivo
    const file = formData.get('arquivo') as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json(
        { sucesso: false, erro: 'Arquivo é obrigatório' },
        { status: 400 },
      );
    }
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { sucesso: false, erro: 'Arquivo excede 100MB' },
        { status: 400 },
      );
    }
    const tiposPermitidos = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!tiposPermitidos.includes(file.type)) {
      return NextResponse.json(
        { sucesso: false, erro: 'Tipo não permitido. Use PDF, JPG ou PNG' },
        { status: 400 },
      );
    }

    // Validar campos do formulário
    const dados = {
      pacienteId: formData.get('pacienteId') ?? '',
      tipo: formData.get('tipo') ?? '',
      dataEmissao: formData.get('dataEmissao') ?? '',
      observacoes: formData.get('observacoes') ?? undefined,
    };

    const parsed = uploadSchema.safeParse(dados);
    if (!parsed.success) {
      return NextResponse.json(
        { sucesso: false, erro: parsed.error.errors[0].message },
        { status: 400 },
      );
    }

    // Upload para Vercel Blob Storage
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const nomeSeguro = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const blobPath = `documentos/${parsed.data.pacienteId}/${nomeSeguro}`;

    const blob = await put(blobPath, file, {
      access: 'public',
      token: process.env.BLOB_BEHEMP_READ_WRITE_TOKEN,
    });

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

    return NextResponse.json({ sucesso: true, dados: doc });
  } catch (error) {
    console.error('[API] Erro ao fazer upload de documento:', error);
    return NextResponse.json(
      { sucesso: false, erro: 'Erro ao enviar documento. Tente novamente.' },
      { status: 500 },
    );
  }
}
