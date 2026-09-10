/**
 * `GET /api/chatpro/start` — o paciente clica e cai no formulário já preenchido.
 *
 * POR QUE ESTE CAMINHO É NECESSÁRIO, E NÃO UMA RESERVA
 * O caminho principal (`/bot-link`) depende de o fluxo do chatbot ALCANÇAR o bloco de
 * requisição. E o menu do bot só aparece quando não há conversa aberta. Em operação real,
 * quase todo paciente já falou com a empresa antes — dúvida, orçamento, retorno. Para esses,
 * o caminho principal nunca entrega o link.
 *
 * Aqui o bot envia sempre a MESMA URL, com as variáveis do contato interpoladas na mensagem.
 * Isso exige do construtor de fluxo apenas o recurso mais básico que existe: colocar uma
 * variável dentro de um texto.
 *
 * 🔴 SEGURANÇA — a diferença em relação ao caminho principal
 * Esta URL é clicável, logo pública. Não há segredo em cabeçalho. As mitigações:
 *
 * 1. o identificador do contato é um UUID — não é adivinhável, e cumpre o papel de segredo;
 * 2. confirmação reversa na API do ChatPro antes de criar qualquer coisa;
 * 3. só telefone, sem confirmação → RECUSA. Telefone é adivinhável, e quem soubesse o número
 *    de um paciente descobriria o nome dele no pré-preenchimento;
 * 4. a resposta é sempre um redirecionamento — nunca um erro técnico na tela do paciente, e
 *    a página de indisponibilidade é a MESMA para "contato não confirmado" e "parâmetro
 *    inválido", para não revelar se aquele número existe na base.
 */

import { NextRequest, NextResponse } from 'next/server';

import { ServicoDeSolicitacao } from '@/lib/chatpro/solicitacao';

export const dynamic = 'force-dynamic';

function urlBase(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || 'http://localhost:3000';
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;

  try {
    const resultado = await new ServicoDeSolicitacao().start({
      lead: q.get('lead') ?? q.get('leadId'),
      telefone: q.get('phone') ?? q.get('telefone') ?? q.get('number'),
      session: q.get('session') ?? q.get('sessionId'),
    });

    if (!resultado) {
      const caminho = process.env.CHATPRO_CADASTRO_PATH?.trim() || '/cadastro';
      return NextResponse.redirect(`${urlBase()}${caminho}/indisponivel`, 302);
    }

    return NextResponse.redirect(resultado.linkDeAcesso, 302);
  } catch (erro) {
    console.error('[chatpro] start: falha inesperada', {
      mensagem: erro instanceof Error ? erro.message : String(erro),
    });
    const caminho = process.env.CHATPRO_CADASTRO_PATH?.trim() || '/cadastro';
    return NextResponse.redirect(`${urlBase()}${caminho}/indisponivel`, 302);
  }
}
