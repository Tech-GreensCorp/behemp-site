export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { procuracoesEspecificas, pacientes, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { criarEnvelopeEmbedded } from '@/lib/docusign/docusign-service';
import { env } from '@/lib/env';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

  const body = (await request.json()) as { procuracaoId: string };
  const { procuracaoId } = body;

  if (!procuracaoId) {
    return NextResponse.json({ erro: 'procuracaoId obrigatório' }, { status: 400 });
  }

  // Verificar usuário
  const [user] = await db
    .select({ id: users.id, email: users.email, nome: users.nome })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);
  if (!user) return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 });

  // Verificar paciente
  const [paciente] = await db
    .select({ id: pacientes.id, cpf: pacientes.cpf })
    .from(pacientes)
    .where(and(eq(pacientes.userId, user.id), isNull(pacientes.deletedAt)))
    .limit(1);
  if (!paciente) return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 });

  // Buscar procuração — verificar que pertence ao paciente
  const [procuracao] = await db
    .select({
      id: procuracoesEspecificas.id,
      pacienteId: procuracoesEspecificas.pacienteId,
      urlPdfGerado: procuracoesEspecificas.urlPdfGerado,
      docusignEnvelopeId: procuracoesEspecificas.docusignEnvelopeId,
      docusignStatus: procuracoesEspecificas.docusignStatus,
      email: procuracoesEspecificas.email,
      nomeCompleto: procuracoesEspecificas.nomeCompleto,
    })
    .from(procuracoesEspecificas)
    .where(
      and(
        eq(procuracoesEspecificas.id, procuracaoId),
        eq(procuracoesEspecificas.pacienteId, paciente.id),
        isNull(procuracoesEspecificas.deletedAt),
      ),
    )
    .limit(1);

  if (!procuracao) {
    return NextResponse.json({ erro: 'Procuração não encontrada' }, { status: 404 });
  }

  // Usar URL base do request atual — evita redirect loop entre
  // behemp-site.vercel.app e URLs de preview da Vercel
  const requestUrl = new URL(request.url);
  const appUrl = `${requestUrl.protocol}//${requestUrl.host}`;
  const returnUrl = `${appUrl}/api/anvisa/signing-complete?procuracaoId=${procuracaoId}&event=signing_complete`;

  // Baixar PDF do Vercel Blob para reenviar ao DocuSign
  let pdfBuffer: Buffer;
  try {
    const response = await fetch(procuracao.urlPdfGerado!);
    if (!response.ok) throw new Error('PDF não encontrado no storage');
    pdfBuffer = Buffer.from(await response.arrayBuffer());
  } catch {
    return NextResponse.json({ erro: 'PDF da procuração não encontrado' }, { status: 404 });
  }

  // Criar envelope embedded no DocuSign
  const resultado = await criarEnvelopeEmbedded({
    pacienteNome: procuracao.nomeCompleto,
    pacienteEmail: procuracao.email,
    pacienteCpf: paciente.cpf ?? '',
    pdfBuffer,
    procuracaoId,
    returnUrl,
  });

  if (!resultado.sucesso) {
    // Erro de consentimento JWT — primeira vez usando a conta developer
    if (resultado.erro === 'CONSENT_REQUIRED') {
      const consentUrl = `${env.DOCUSIGN_OAUTH_BASE_URL}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${env.DOCUSIGN_INTEGRATION_KEY}&redirect_uri=${encodeURIComponent(returnUrl)}`;
      return NextResponse.json(
        {
          erro: 'CONSENT_REQUIRED',
          consentUrl,
          mensagem: 'Autorização inicial necessária. Acesse o link para autorizar o app DocuSign.',
        },
        { status: 403 },
      );
    }
    return NextResponse.json({ erro: resultado.erro }, { status: 500 });
  }

  // Salvar envelopeId na procuração e marcar como não-stub
  await db
    .update(procuracoesEspecificas)
    .set({
      docusignEnvelopeId: resultado.envelopeId,
      docusignStatus: 'enviado',
      stubAtivo: false,
    })
    .where(eq(procuracoesEspecificas.id, procuracaoId));

  return NextResponse.json({
    sucesso: true,
    dados: {
      signingUrl: resultado.signingUrl,
      envelopeId: resultado.envelopeId,
    },
  });
}
