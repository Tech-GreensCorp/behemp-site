import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { autorizacoesAnvisa, pacientes, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { put } from '@vercel/blob';

const MIME_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'];
const TAMANHO_MAX = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

  const formData = await request.formData();
  const autorizacaoId = formData.get('autorizacaoId') as string;
  const tipoDocumento = formData.get('tipo') as string;
  const arquivo = formData.get('arquivo') as File | null;

  if (!autorizacaoId || !tipoDocumento || !arquivo) {
    return NextResponse.json({ erro: 'Dados obrigatórios ausentes' }, { status: 400 });
  }

  // Validar MIME type
  if (!MIME_PERMITIDOS.includes(arquivo.type)) {
    return NextResponse.json(
      { erro: 'Tipo de arquivo não permitido. Use PDF, JPG ou PNG.' },
      { status: 400 },
    );
  }

  // Validar tamanho
  if (arquivo.size > TAMANHO_MAX) {
    return NextResponse.json({ erro: 'Arquivo muito grande. Máximo 10MB.' }, { status: 400 });
  }

  // Verificar acesso
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);
  if (!user) return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 });

  const [paciente] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(and(eq(pacientes.userId, user.id), isNull(pacientes.deletedAt)))
    .limit(1);
  if (!paciente) return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 });

  // Verificar que a autorização pertence ao paciente
  const [autorizacao] = await db
    .select({ id: autorizacoesAnvisa.id, documentos: autorizacoesAnvisa.documentos })
    .from(autorizacoesAnvisa)
    .where(
      and(
        eq(autorizacoesAnvisa.id, autorizacaoId),
        eq(autorizacoesAnvisa.pacienteId, paciente.id),
        isNull(autorizacoesAnvisa.deletedAt),
      ),
    )
    .limit(1);
  if (!autorizacao) return NextResponse.json({ erro: 'Autorização não encontrada' }, { status: 404 });

  // Upload para Vercel Blob
  const extensao = arquivo.name.split('.').pop() ?? 'bin';
  const nomeSeguro = `anvisa/${paciente.id}/${autorizacaoId}/${tipoDocumento}-${Date.now()}.${extensao}`;
  const blob = await put(nomeSeguro, arquivo, { access: 'public' });

  // Atualizar checklist no JSONB
  type DocItem = { tipo: string; enviado: boolean; urlBlob: string | null; nomeArquivo: string | null; validado: boolean };
  const documentos: DocItem[] = (autorizacao.documentos as DocItem[]) ?? [];
  const idx = documentos.findIndex((d) => d.tipo === tipoDocumento);
  if (idx >= 0) {
    documentos[idx] = { ...documentos[idx], enviado: true, urlBlob: blob.url, nomeArquivo: arquivo.name };
  } else {
    documentos.push({ tipo: tipoDocumento, enviado: true, urlBlob: blob.url, nomeArquivo: arquivo.name, validado: false });
  }

  await db
    .update(autorizacoesAnvisa)
    .set({ documentos })
    .where(eq(autorizacoesAnvisa.id, autorizacaoId));

  return NextResponse.json({ sucesso: true, dados: { urlBlob: blob.url } });
}
