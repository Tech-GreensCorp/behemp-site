import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { exames } from '@/db/schema';
import { verificarMedicoOuAdmin } from '@/lib/auth';
import { z } from 'zod';

/**
 * API Route para upload de exames de pacientes.
 *
 * Migrado de server action para API route para evitar conflitos com o middleware
 * do Clerk ao enviar FormData com arquivos binários.
 *
 * Usa BLOB_BEHEMP_READ_WRITE_TOKEN para autenticar no Vercel Blob Storage.
 */

const criarExameSchema = z.object({
  pacienteId: z.string().min(1, 'ID do paciente é obrigatório'),
  nomeExame: z.string().min(1, 'Nome do exame é obrigatório'),
  dataExame: z.string().min(1, 'Data do exame é obrigatória'),
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

    // Validar campos do formulário
    const dados = {
      pacienteId: formData.get('pacienteId') as string,
      nomeExame: formData.get('nomeExame') as string,
      dataExame: formData.get('dataExame') as string,
      observacoes: (formData.get('observacoes') as string) || undefined,
    };

    const parsed = criarExameSchema.safeParse(dados);
    if (!parsed.success) {
      return NextResponse.json(
        { sucesso: false, erro: parsed.error.errors[0].message },
        { status: 400 },
      );
    }

    // Upload opcional de arquivo
    let urlArquivo: string | null = null;
    let nomeArquivo: string | null = null;

    const file = formData.get('arquivo') as File | null;
    if (file && file.size > 0) {
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

      const blob = await put(
        `exames/${parsed.data.pacienteId}/${Date.now()}-${file.name}`,
        file,
        {
          access: 'public',
          token: process.env.BLOB_BEHEMP_READ_WRITE_TOKEN,
        },
      );
      urlArquivo = blob.url;
      nomeArquivo = file.name;
    }

    const [exame] = await db
      .insert(exames)
      .values({
        pacienteId: parsed.data.pacienteId,
        nomeExame: parsed.data.nomeExame,
        dataExame: parsed.data.dataExame,
        observacoes: parsed.data.observacoes || null,
        urlArquivo,
        nomeArquivo,
      })
      .returning();

    return NextResponse.json({ sucesso: true, dados: exame });
  } catch (error) {
    console.error('[API] Erro ao criar exame:', error);
    return NextResponse.json(
      { sucesso: false, erro: 'Erro ao criar exame. Tente novamente.' },
      { status: 500 },
    );
  }
}
