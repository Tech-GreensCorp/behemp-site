import { NextResponse } from 'next/server';

import {
  validarTokenDeCadastro,
  registrarPrimeiroAcesso,
  type MotivoDeRecusa,
} from '@/lib/chatpro/token-de-cadastro';

export const dynamic = 'force-dynamic';

/**
 * O QUE A TELA DE CADASTRO LÊ AO ABRIR O LINK.
 *
 * A página é trabalho da Dryelle. Esta rota existe para que a regra de validade do token
 * more num lugar só: se a tela reimplementasse "expirou?", uma mudança de TTL passaria a
 * exigir dois deploys coordenados para continuar coerente.
 *
 * Um Server Component pode chamar `validarTokenDeCadastro` direto e pular esta rota — é
 * inclusive o caminho preferido (`AGENTS.md`: não chamar Route Handler local quando a
 * chamada direta evita round-trip). A rota atende o caso client-side.
 *
 * 🔴 ISTO É UMA URL-CAPACIDADE: quem tem o token vê o nome, o e-mail e o telefone da
 * solicitação. É o desenho pretendido — o token é o que o paciente recebeu no WhatsApp e
 * é a única credencial que ele tem antes de existir conta. As defesas são: 256 bits de
 * entropia, validade curta, uso único, e o formato conferido antes de qualquer consulta.
 * O que NÃO se faz aqui é devolver dado clínico: esta rota entrega o que o próprio
 * paciente digitou no bot, nada além.
 */
const RESPOSTA_DA_RECUSA: Record<MotivoDeRecusa, { http: number; mensagem: string }> = {
  // 404 para o inválido: quem chutou não fica sabendo se acertou um protocolo que existe.
  invalido: { http: 404, mensagem: 'Link inválido.' },
  // 410 diz "existiu e acabou" — e aqui isso é informação útil, não vazamento: o paciente
  // precisa saber que deve pedir outro, em vez de achar que digitou errado.
  expirado: { http: 410, mensagem: 'Este link expirou. Peça um novo pelo WhatsApp.' },
  ja_utilizado: { http: 409, mensagem: 'Este link já foi utilizado. Já recebemos seus dados.' },
  cancelado: { http: 410, mensagem: 'Esta solicitação foi cancelada. Fale com o atendimento.' },
};

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const resultado = await validarTokenDeCadastro(token);

    if (!resultado.valida) {
      const { http, mensagem } = RESPOSTA_DA_RECUSA[resultado.motivo];
      return NextResponse.json(
        { sucesso: false, erro: mensagem, codigo: resultado.motivo.toUpperCase() },
        { status: http },
      );
    }

    // Só depois de validar. Um token inválido não deve produzir escrita nenhuma.
    await registrarPrimeiroAcesso(resultado.id);

    return NextResponse.json({
      sucesso: true,
      dados: {
        protocolo: resultado.protocolo,
        // ⚠️ Qualquer um destes pode ser `null` — a plataforma tem contato sem nome
        // nenhum. A tela pede o que faltar, em vez de assumir presença.
        nomeCompleto: resultado.nomeCompleto,
        email: resultado.email,
        telefone: resultado.telefone,
        expiraEm: resultado.expiraEm.toISOString(),
      },
    });
  } catch (erro) {
    console.error('[chatpro] solicitação: falha ao validar token', {
      mensagem: erro instanceof Error ? erro.message : 'desconhecida',
    });
    return NextResponse.json({ sucesso: false, erro: 'Falha ao validar o link' }, { status: 500 });
  }
}
