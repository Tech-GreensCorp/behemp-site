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

import { lerSegredoDoCabecalho } from '@/lib/chatpro/segredo';
import { lerManifestoDaUrl } from '@/lib/chatpro/manifesto-da-url';
import { contasConfiguradas, identificarConta } from '@/lib/chatpro/contas';
import { ErroDeContatoNaoConfirmado, ServicoDeSolicitacao } from '@/lib/chatpro/solicitacao';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';

/** Folgado para bot real, estreito para força bruta. */
const LIMITE_DO_BOT = 60;

/** Nunca cacheia: cada chamada cria ou reemite um link. */
export const dynamic = 'force-dynamic';

function textoPuro(corpo: string, status: number): NextResponse {
  return new NextResponse(corpo, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function GET(request: NextRequest) {
  /**
   * 🔴 LIMITE ANTES DE TUDO — OWASP API4:2023.
   *
   * Aqui o segredo no cabeçalho é o único portão: quem o tiver, gera link de cadastro. A
   * comparação é em tempo constante, mas isso não impede tentar. E o custo de cada tentativa
   * é nosso, não de quem tenta.
   *
   * 60/min é folgado para um bot atendendo pacientes de verdade, e estreito para força bruta.
   */
  const limite = consumir(identificarChamador(request.headers, 'botlink'), LIMITE_DO_BOT, 60);
  if (!limite.permitido) {
    return new NextResponse('Muitas requisições. Tente novamente em instantes.', {
      status: 429,
      headers: cabecalhosDoLimite(limite, LIMITE_DO_BOT),
    });
  }

  /**
   * 🔴 O SEGREDO IDENTIFICA A CONTA (ADR-0018 D-01).
   *
   * O mesmo endpoint atende a conta da BeHemp e a da Greens, e cada uma tem o seu segredo.
   * Isso não é só separação de credencial: é o que diz DE ONDE veio a chamada, sem
   * depender de um parâmetro na URL que o painel poderia preencher errado — ou que alguém
   * poderia trocar.
   *
   * A conta decide o `parceiro` da solicitação e para onde o paciente volta no fim.
   */
  if (contasConfiguradas().length === 0) {
    console.error('[chatpro] nenhuma conta configurada — bot-link indisponível');
    return textoPuro('Integração indisponível no momento.', 503);
  }

  const conta = identificarConta(lerSegredoDoCabecalho(request.headers));
  if (!conta) {
    // Nunca logar o segredo recebido nem o corpo da requisição.
    console.warn('[chatpro] bot-link com segredo inválido', {
      caminho: request.nextUrl.pathname,
    });
    return textoPuro('Não autorizado.', 401);
  }

  const q = request.nextUrl.searchParams;

  /**
   * 🔴 O QUE O PACIENTE JÁ TEM, declarado pelo bot.
   *
   * Sem isto a solicitação nascia sem manifesto, e o cadastro considerava que **falta tudo** —
   * o que mandava o paciente de recompra para a mesma tela do paciente novo. Ver
   * `lib/chatpro/manifesto-da-url.ts` para por que chave desconhecida é ignorada em vez de
   * recusar a chamada.
   */
  const manifesto = lerManifestoDaUrl(q);
  if (manifesto.ignorados.length > 0) {
    // Nomes de documento não são dado pessoal — podem ir ao log, e é assim que um typo no
    // painel deixa de ser invisível.
    console.warn('[chatpro] bot-link: documentos não reconhecidos no manifesto', {
      ignorados: manifesto.ignorados,
      conta: conta.id,
    });
  }

  try {
    const { mensagem } = await new ServicoDeSolicitacao().linkParaOBot({
      // 🔴 Vem do SEGREDO, nunca da URL. Decide o `parceiro` da solicitação e para onde
      // o paciente volta ao terminar (ADR-0018 D-01 e D-03).
      conta,
      sessionId: q.get('sessionId'),
      leadId: q.get('leadId'),
      nome: q.get('name') ?? q.get('nome'),
      // 🔴 O campo que o fluxo da Greens não tem: aqui o bot pergunta o e-mail antes de
      // gerar o link, porque é por e-mail que a confirmação e o acompanhamento chegam.
      email: q.get('email') ?? q.get('e-mail'),
      telefone: q.get('phone') ?? q.get('telefone'),
      number: q.get('number'),
      documentosDeclarados: manifesto.declarado ? manifesto.documentos : null,
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
