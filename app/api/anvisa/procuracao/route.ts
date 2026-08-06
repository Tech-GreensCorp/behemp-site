export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { autorizacoesAnvisa, pacientes, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Gera o HTML da Procuração Específica IDÊNTICO ao modelo oficial Be4Hope
// Layout verificado página a página no documento original
function gerarHtmlProcuracao(dados: {
  nomeCompleto: string;
  nacionalidade: string;
  estadoCivil: string;
  profissao: string;
  rg: string;
  cpf: string;
  email: string;
  telefone: string;
  endereco: string;
  cep: string;
  cidade: string;
  uf: string;
  dia: string;
  mes: string;
  ano: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #000;
  }

  /* Título — centralizado, negrito, maiúsculas */
  .titulo {
    font-size: 14pt;
    font-weight: bold;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }

  /* Subtítulo — centralizado, fonte normal */
  .subtitulo {
    font-size: 11pt;
    text-align: center;
    margin-bottom: 24px;
  }

  /* Seções — negrito, SEM linha divisória, SEM uppercase */
  .secao {
    font-size: 12pt;
    font-weight: bold;
    margin: 18px 0 6px;
  }

  /* Parágrafos — texto justificado */
  p {
    text-align: justify;
    margin-bottom: 10px;
    font-size: 12pt;
    line-height: 1.5;
  }

  /* Lista numerada com espaço entre itens */
  ol {
    margin: 6px 0 12px 22px;
  }
  ol li {
    text-align: justify;
    margin-bottom: 10px;
    font-size: 12pt;
    line-height: 1.5;
    padding-left: 4px;
  }

  /* Data e local */
  .data-local {
    margin-top: 20px;
    margin-bottom: 50px;
    font-size: 12pt;
    line-height: 1.5;
  }

  /* Título da assinatura — negrito */
  .assinatura-titulo {
    font-size: 12pt;
    font-weight: bold;
    margin-bottom: 80px;
  }

  /* Linha de assinatura — centralizada */
  .linha-assinatura {
    border-top: 1px solid #000;
    width: 380px;
    margin: 0 auto 12px;
  }

  /* Nome e CPF abaixo da linha — centralizados */
  .assinatura-info {
    text-align: center;
    font-size: 12pt;
    line-height: 2;
  }

  /* Forçar quebra de página */
  .quebra-pagina {
    page-break-before: always;
  }
</style>
</head>
<body>

<!-- TÍTULO PRINCIPAL -->
<div class="titulo">PROCURAÇÃO</div>
<div class="subtitulo">(Autorização para solicitação de uso de produtos à base de canabidiol via GOV.BR/ANVISA)</div>

<!-- OUTORGANTE -->
<div class="secao">OUTORGANTE</div>
<p>
  ${dados.nomeCompleto}, ${dados.nacionalidade || 'brasileiro(a)'}, ${dados.estadoCivil || '[estado civil]'}, ${dados.profissao || '[profissão]'}, RG nº ${dados.rg || '[________]'}, CPF nº
  ${dados.cpf || '[________]'}, e-mail ${dados.email}, telefone ${dados.telefone || '[________]'}, residente à ${dados.endereco || '[endereço completo]'}, CEP
  ${dados.cep || '[________]'}.
</p>

<!-- OUTORGADO -->
<div class="secao">OUTORGADO</div>
<p>
  ASSOCIAÇÃO BEHEMP DE DESENVOLVIMENTO, PESQUISA E FOMENTO EM
  CANNABIS NO BRASIL – ABH, CNPJ nº 07.578.940/0001-01, com sede na R. Gomes de
  Carvalho, 1629 – Vila Olímpia – São Paulo/SP, e-mail contato@be4hope.org, doravante denominada
  ASSOCIAÇÃO.
</p>

<!-- OBJETO -->
<div class="secao">OBJETO</div>
<p>
  A presente procuração tem por objeto outorgar poderes específicos à ASSOCIAÇÃO para
  emitir/solicitar a autorização da ANVISA para uso de produtos à base de canabidiol por meio do
  acesso GOV.BR do Outorgante (ou, se menor, do Representante Legal), exclusivamente para fins de
  tratamento de saúde, nos termos da regulamentação sanitária aplicável.
</p>

<!-- PODERES ESPECÍFICOS -->
<div class="secao">PODERES ESPECÍFICOS</div>
<ol>
  <li>
    Acessar e operar a conta GOV.BR do Outorgante, exclusivamente para solicitar, emitir, renovar e
    acompanhar autorização sanitária perante a ANVISA para produtos à base de canabidiol;
  </li>
  <li>
    Preencher, anexar e protocolar formulários, requerimentos, receitas e demais documentos
    necessários à solicitação/renovação da autorização, inclusive assinar eletronicamente quando
    cabível;
  </li>
  <li>
    Acompanhar o processo administrativo, receber comunicações e intimações, prestar
    esclarecimentos e corrigir/complementar informações;
  </li>
  <li>
    Obter cópias e certidões relacionadas ao processo e compartilhar documentos com profissionais
    de saúde vinculados ao tratamento, observada a confidencialidade.
  </li>
</ol>

<!-- LIMITAÇÃO — inline, sem seção separada -->
<p class="quebra-pagina">
  Limitação: Os poderes ora concedidos restringem-se ao objetivo descrito neste instrumento, vedado
  qualquer uso para finalidades diversas.
</p>

<!-- PROTEÇÃO DE DADOS -->
<div class="secao">PROTEÇÃO DE DADOS</div>
<p>
  O Outorgante autoriza o tratamento dos dados pessoais e documentos estritamente necessários ao
  trâmite do pedido junto à ANVISA e ao GOV.BR, nos termos da legislação aplicável, exclusivamente
  para a finalidade desta procuração.
</p>

<!-- VALIDADE -->
<div class="secao">VALIDADE</div>
<p>
  Esta procuração é válida por 24 (vinte e quatro) meses contados da data de assinatura, expirando
  automaticamente ao término desse prazo. Poderá ser revogada a qualquer tempo, mediante
  comunicação por escrito à ASSOCIAÇÃO.
</p>

<!-- DATA E LOCAL -->
<p class="data-local">${dados.cidade}/${dados.uf}, ${dados.dia} de ${dados.mes} de ${dados.ano}.</p>

<!-- ASSINATURA -->
<div class="assinatura-titulo">ASSINATURA DO OUTORGANTE (ou do REPRESENTANTE LEGAL, se menor):</div>

<div class="linha-assinatura"></div>
<div class="assinatura-info">
  Nome: ${dados.nomeCompleto}<br>
  CPF: ${dados.cpf || ''}
</div>

</body>
</html>`;
}

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
  const html = gerarHtmlProcuracao(dados);
  const { htmlParaPdf } = await import('@/lib/receituario/html-para-pdf');
  
  const footerTemplate = `
    <div style="width: 100%; font-size: 9px; font-family: 'Times New Roman', Times, serif; text-align: center; padding: 0 3cm 0.5cm 3cm; position: relative;">
      <div style="font-weight: bold; color: black;">Associação Behemp de Desenvolvimento Pesquisa e Fomento em Cannabis no Brasil</div>
      <div style="color: black;">R. Gomes de Carvalho, 1629, Vila Olímpia - São Paulo</div>
      <div style="color: black;">www.be4hope.org &nbsp;-&nbsp; contato@be4hope.org</div>
      <div style="color: #EA5429; font-weight: bold;">be.4hope</div>
      <div style="position: absolute; right: 3cm; bottom: 0.5cm; font-weight: bold; color: black; font-size: 8px;">
        Página <span class="pageNumber"></span> de <span class="totalPages"></span>
      </div>
    </div>
  `;

  const pdfBuffer = await htmlParaPdf(html, {
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: footerTemplate,
    margin: { top: '2.5cm', bottom: '2.5cm', left: '3cm', right: '3cm' },
  });

  // Salvar PDF no Vercel Blob
  const nomeArquivo = `procuracoes/${paciente.id}/${autorizacaoId}-${Date.now()}.pdf`;
  const blob = await put(nomeArquivo, pdfBuffer, { access: 'public' });

  // Criar registro da Procuração Específica
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
