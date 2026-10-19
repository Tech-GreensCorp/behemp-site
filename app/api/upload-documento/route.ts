import { guardarDocumentoPrivado } from '@/lib/documentos/store-privado';
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
  'contrato_termos',
  'laudo_relatorio',
  'orcamento',
  'outro',
] as const;

/** Nome livre do tipo "outro": texto curto, sem caractere de controle. */
const tipoPersonalizadoSchema = z
  .string()
  .trim()
  .min(2, 'Informe o nome do tipo de documento (mín. 2 caracteres)')
  .max(60, 'O nome do tipo de documento aceita até 60 caracteres')
  .refine((v) => !/\p{Cc}/u.test(v), 'Nome do tipo contém caracteres inválidos');

const uploadSchema = z.object({
  pacienteId: z.string().min(1, 'ID do paciente é obrigatório'),
  tipo: z.enum(TIPOS_VALIDOS),
  dataEmissao: z.string().min(1, 'Data de emissão é obrigatória'),
  observacoes: z.string().optional(),
  tipoPersonalizado: z.string().optional(),
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
      tipoPersonalizado: formData.get('tipoPersonalizado') ?? undefined,
    };

    const parsed = uploadSchema.safeParse(dados);
    if (!parsed.success) {
      return NextResponse.json(
        { sucesso: false, erro: parsed.error.errors[0].message },
        { status: 400 },
      );
    }

    // "Outro" com nome livre é cadastro de tipo novo: só o admin. A UI esconde o campo, mas é
    // aqui que se decide — o cliente nunca é confiável.
    let tipoPersonalizado: string | null = null;
    if (parsed.data.tipo === 'outro') {
      if (auth.role !== 'admin') {
        return NextResponse.json(
          { sucesso: false, erro: 'Apenas administradores podem cadastrar um novo tipo de documento' },
          { status: 403 },
        );
      }
      const nome = tipoPersonalizadoSchema.safeParse(parsed.data.tipoPersonalizado ?? '');
      if (!nome.success) {
        return NextResponse.json(
          { sucesso: false, erro: nome.error.errors[0].message },
          { status: 400 },
        );
      }
      tipoPersonalizado = nome.data;
    }

    // Upload para Vercel Blob Storage
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const nomeSeguro = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const blobPath = `documentos/${parsed.data.pacienteId}/${nomeSeguro}`;

    // O store sai de `store-privado`: `BLOB_BEHEMP_READ_WRITE_TOKEN` é a mesma
    // variável com que avatar e exame gravam `public`, e um store tem um só acesso.
    const blob = await guardarDocumentoPrivado(blobPath, file);

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
        tipoPersonalizado,
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
