export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { autorizacoesAnvisa, pacientes, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// HTML removido - gerador de PDF agora usa React PDF diretamente

import { put } from '@vercel/blob';
import { procuracoesEspecificas, logsAuditoria } from '@/db/schema';
import { criarEnvelopeEmbedded, docusignConfigurado } from '@/lib/docusign/docusign-service';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

  const body = await request.json();
  const { autorizacaoId, dadosComplementares } = body as {
    autorizacaoId: string;
    dadosComplementares?: {
      nacionalidade?: string;
      estadoCivil?: string;
      profissao?: string;
    };
  };

  if (!autorizacaoId) return NextResponse.json({ erro: 'autorizacaoId obrigatório' }, { status: 400 });

  // Buscar user
  const [user] = await db
    .select({ id: users.id, email: users.email, nome: users.nome, telefone: users.telefone })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);
  if (!user) return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 });

  // Buscar paciente
  const [paciente] = await db
    .select({
      id: pacientes.id,
      cpf: pacientes.cpf,
      rg: pacientes.rg,
      endereco: pacientes.endereco,
      cep: pacientes.cep,
      cidade: pacientes.cidade,
      uf: pacientes.uf,
      nacionalidade: pacientes.nacionalidade,
      estadoCivil: pacientes.estadoCivil,
      profissao: pacientes.profissao,
    })
    .from(pacientes)
    .where(and(eq(pacientes.userId, user.id), isNull(pacientes.deletedAt)))
    .limit(1);
  if (!paciente) return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 });

  console.log('[PROCURACAO DEBUG] Iniciando geração de procuração');
  console.log('[PROCURACAO DEBUG] autorizacaoId:', autorizacaoId);
  console.log('[PROCURACAO DEBUG] user encontrado:', !!user);
  console.log('[PROCURACAO DEBUG] paciente encontrado:', !!paciente);


  // Verificar acesso à autorização
  const [autorizacao] = await db
    .select({ id: autorizacoesAnvisa.id, pacienteId: autorizacoesAnvisa.pacienteId })
    .from(autorizacoesAnvisa)
    .where(and(
      eq(autorizacoesAnvisa.id, autorizacaoId),
      eq(autorizacoesAnvisa.pacienteId, paciente.id),
      isNull(autorizacoesAnvisa.deletedAt),
    ))
    .limit(1);
  if (!autorizacao) return NextResponse.json({ erro: 'Autorização não encontrada' }, { status: 404 });

  // Atualizar dados complementares no perfil do paciente (Opção B — salva permanentemente)
  if (dadosComplementares && Object.keys(dadosComplementares).length > 0) {
    const updates: Record<string, string> = {};
    if (dadosComplementares.nacionalidade) updates.nacionalidade = dadosComplementares.nacionalidade;
    if (dadosComplementares.estadoCivil) updates.estadoCivil = dadosComplementares.estadoCivil;
    if (dadosComplementares.profissao) updates.profissao = dadosComplementares.profissao;
    if (Object.keys(updates).length > 0) {
      await db.update(pacientes).set(updates).where(eq(pacientes.id, paciente.id));
    }
  }

  // Montar dados finais (banco + complementares da requisição)
  const hoje = new Date();
  const dados = {
    nomeCompleto: user.nome,
    nacionalidade: dadosComplementares?.nacionalidade ?? paciente.nacionalidade ?? 'brasileiro(a)',
    estadoCivil: dadosComplementares?.estadoCivil ?? paciente.estadoCivil ?? '',
    profissao: dadosComplementares?.profissao ?? paciente.profissao ?? '',
    rg: paciente.rg ?? '',
    cpf: paciente.cpf ?? '',
    email: user.email,
    telefone: user.telefone ?? '',
    endereco: paciente.endereco ?? '',
    cep: paciente.cep ?? '',
    cidade: paciente.cidade ?? '',
    uf: paciente.uf ?? '',
    dia: String(hoje.getDate()).padStart(2, '0'),
    mes: format(hoje, 'MMMM', { locale: ptBR }),
    ano: String(hoje.getFullYear()),
  };

  // Gerar PDF
  console.log('[PROCURACAO DEBUG] Gerando HTML...');
  console.log('[PROCURACAO DEBUG] Dados:', JSON.stringify({
    nomeCompleto: dados.nomeCompleto,
    cidade: dados.cidade,
    uf: dados.uf,
  }));
  const { gerarPdfProcuracao } = await import('@/lib/receituario/procuracao-pdf');
  const pdfBuffer = await gerarPdfProcuracao(dados);

  // Salvar PDF no Vercel Blob
  const nomeArquivo = `procuracoes/${paciente.id}/${autorizacaoId}-${Date.now()}.pdf`;
  const blob = await put(nomeArquivo, pdfBuffer, { access: 'public' });

  // Criar registro da Procuração Específica
  console.log('[PROCURACAO DEBUG] DocuSign configurado:', docusignConfigurado());
  console.log('[PROCURACAO DEBUG] DOCUSIGN_INTEGRATION_KEY existe:', !!process.env.DOCUSIGN_INTEGRATION_KEY);
  console.log('[PROCURACAO DEBUG] DOCUSIGN_PRIVATE_KEY existe:', !!process.env.DOCUSIGN_PRIVATE_KEY);
  const [procuracao] = await db.insert(procuracoesEspecificas).values({
    pacienteId: paciente.id,
    autorizacaoId,
    nomeCompleto: user.nome,
    cpf: paciente.cpf ?? '',
    rg: paciente.rg ?? '',
    nacionalidade: dados.nacionalidade,
    estadoCivil: dados.estadoCivil,
    profissao: dados.profissao,
    email: user.email,
    telefone: user.telefone ?? '',
    endereco: paciente.endereco ?? '',
    cep: paciente.cep ?? '',
    cidade: paciente.cidade ?? '',
    uf: paciente.uf ?? '',
    urlPdfGerado: blob.url,
    docusignStatus: 'nao_enviado',
    stubAtivo: !docusignConfigurado(),
  }).returning();

  // Auditoria
  await db.insert(logsAuditoria).values({
    acao: 'GERAR_PROCURACAO_ESPECIFICA',
    entidade: 'procuracoes_especificas',
    entidadeId: procuracao.id,
  }).catch(() => {});

  // Retornar procuracaoId para que o frontend possa
  // chamar /api/anvisa/procuracao/signing-url e abrir o embedded signing
  return NextResponse.json({
    sucesso: true,
    dados: {
      procuracaoId: procuracao.id,
      urlPdf: blob.url,
      docusignStatus: 'nao_enviado',
      stub: false,
      mensagem: 'Procuração Específica gerada. Clique em "Assinar Agora" para assinar digitalmente.',
    },
  });
}
