/**
 * `GET /api/chatpro/bot-link` — O CAMINHO PRINCIPAL.
 *
 * 🔴 A RESPOSTA DESTE ENDPOINT VIRA A MENSAGEM DO WHATSAPP.
 * O bloco "Requisição externa" do construtor de fluxo do ChatPro chama esta URL e entrega o
 * CORPO DA RESPOSTA diretamente na conversa do paciente. Por isso:
 *
 * - responde `text/plain`, não JSON — o que sai daqui é literalmente o que ele lê;
 * - em caso de erro, responde status não-2xx **de propósito**: o painel do ChatPro tem uma
 *   "Ação em caso de falha" configurada para transferir o atendimento a uma pessoa. Ou seja,
 *   a degradação é automática, e o paciente vai para um humano em vez de ver erro.
 *
 * MÉTODO GET porque é o que a plataforma dispara — o painel não oferece seletor de método, e
 * manda os parâmetros na query.
 *
 * ⚠️ LIMITAÇÃO CONHECIDA, medida em produção no projeto irmão: este caminho só funciona no
 * PRIMEIRO contato. O menu do chatbot só aparece quando não há conversa aberta; com um
 * atendimento em andamento, o fluxo não recomeça e este endpoint nunca é chamado — sem
 * deixar rastro no log, o que é indistinguível de "não configurado". Para quem já tem
 * conversa, o caminho é `/api/chatpro/start`.
 */

import { NextRequest, NextResponse } from 'next/server';

import { lerSegredoDoCabecalho, segredosConferem } from '@/lib/chatpro/segredo';
import { ErroDeContatoNaoConfirmado, ServicoDeSolicitacao } from '@/lib/chatpro/solicitacao';

/** Nunca cacheia: cada chamada cria ou reemite um link. */
export const dynamic = 'force-dynamic';

function textoPuro(corpo: string, status: number): NextResponse {
  return new NextResponse(corpo, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function GET(request: NextRequest) {
  const esperado = process.env.CHATPRO_INTAKE_SECRET;

  // Sem segredo configurado a rota fica FECHADA. Endpoint que cria cadastro de paciente
  // nunca deve ficar aberto por falta de configuração.
  if (!esperado) {
    console.error('[chatpro] CHATPRO_INTAKE_SECRET ausente — bot-link indisponível');
    return textoPuro('Integração indisponível no momento.', 503);
  }

  const recebido = lerSegredoDoCabecalho(request.headers);
  if (!segredosConferem(recebido, esperado)) {
    // Nunca logar o segredo recebido nem o corpo da requisição.
    console.warn('[chatpro] bot-link com segredo inválido', {
      caminho: request.nextUrl.pathname,
    });
    return textoPuro('Não autorizado.', 401);
  }

  const q = request.nextUrl.searchParams;

  try {
    const { mensagem } = await new ServicoDeSolicitacao().linkParaOBot({
      sessionId: q.get('sessionId'),
      leadId: q.get('leadId'),
      nome: q.get('name') ?? q.get('nome'),
      // 🔴 O campo que o fluxo da Greens não tem: aqui o bot pergunta o e-mail antes de
      // gerar o link, porque é por e-mail que a confirmação e o acompanhamento chegam.
      email: q.get('email') ?? q.get('e-mail'),
      telefone: q.get('phone') ?? q.get('telefone'),
      number: q.get('number'),
    });

    return textoPuro(mensagem, 200);
  } catch (erro) {
    if (erro instanceof ErroDeContatoNaoConfirmado) {
      console.warn('[chatpro] bot-link: contato não identificado');
      // Status não-2xx dispara a "Ação em caso de falha" do painel: transfere para atendente.
      return textoPuro('Não consegui identificar o seu contato. Vou chamar um atendente.', 422);
    }

    console.error('[chatpro] bot-link: falha inesperada', {
      mensagem: erro instanceof Error ? erro.message : String(erro),
    });
    return textoPuro('Tive um problema para gerar o seu link. Vou chamar um atendente.', 500);
  }
}
