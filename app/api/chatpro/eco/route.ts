/**
 * `GET /api/chatpro/eco` — o servidor diz o que recebeu. Só isso.
 *
 * 🔴 POR QUE ESTA ROTA EXISTE, e o deploy que ela teria evitado.
 *
 * Em 11/09/2026 o painel do ChatPro montou a URL com `?` no lugar de `&`, e o manifesto se
 * perdia. Escrevi a correção, subi, **e continuou falhando** — medido em produção, com o
 * código já no servidor. A explicação que eu tinha dado (o `NextURL` normalizaria a query)
 * era falsa: medi `new NextRequest(url)` e ela preserva o `?`.
 *
 * Aí a investigação parou, porque **não havia como perguntar ao servidor o que ele viu**. Log
 * de produção não é acessível daqui, e a resposta do `bot-link` é a mensagem do paciente — não
 * cabe diagnóstico nela. O passo seguinte teria sido outra hipótese, outro deploy, outra
 * medição indireta.
 *
 * ⚠️ ISTO NÃO É UM ENDPOINT DE PRODUTO. É instrumento: existe para transformar "acho que o
 * runtime normaliza" em "o runtime recebeu exatamente isto".
 *
 * ## O que ela devolve, e por que é inócua
 *
 * Só o que o **próprio chamador** acabou de enviar: a URL crua, o que o `nextUrl` fez com ela,
 * e como cada leitura interpreta os parâmetros. Quem chama já sabe tudo isso — não há
 * informação nova para quem não deveria estar aqui.
 *
 * 🔴 E MESMO ASSIM EXIGE O SEGREDO. Duas razões: uma rota que ecoa entrada é ferramenta de
 * sondagem se ficar aberta, e o mesmo portão do `bot-link` mantém as duas com a mesma
 * superfície — quem pode gerar link pode diagnosticar por que ele saiu errado.
 *
 * ⚠️ NADA DO CORPO, NADA DE CABEÇALHO. Só a URL. Ecoar cabeçalho devolveria o próprio segredo
 * a quem o mandou, e um dia alguém colaria essa resposta num chamado de suporte.
 */

import { NextRequest, NextResponse } from 'next/server';

import { lerSegredoDoCabecalho } from '@/lib/chatpro/segredo';
import { contasConfiguradas, identificarConta } from '@/lib/chatpro/contas';
import { lerManifestoDaUrl } from '@/lib/chatpro/manifesto-da-url';
import { parametrosDoPainel, separadorFoiCorrigido } from '@/lib/chatpro/query-do-painel';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';

const LIMITE = 30;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const limite = consumir(identificarChamador(request.headers, 'eco'), LIMITE, 60);
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: 'Muitas requisições' },
      { status: 429, headers: cabecalhosDoLimite(limite, LIMITE) },
    );
  }

  if (contasConfiguradas().length === 0) {
    return NextResponse.json({ erro: 'Não configurado' }, { status: 503 });
  }
  const conta = identificarConta(lerSegredoDoCabecalho(request.headers));
  if (!conta) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
  }

  /**
   * As três leituras lado a lado. A diferença entre elas é a resposta que faltava: se
   * `cru` e `crua` divergirem, alguém entre o cliente e o Next reescreveu a URL.
   */
  const cru = Object.fromEntries(request.nextUrl.searchParams.entries());
  const tolerante = Object.fromEntries(parametrosDoPainel(request.url).entries());

  return NextResponse.json(
    {
      conta: conta.id,
      url: {
        /** A string que chegou ao handler. */
        crua: request.url,
        /** O que o `NextURL` fez com ela. */
        nextUrlSearch: request.nextUrl.search,
        /** `true` se ainda há `?` depois do primeiro — o defeito que se investiga. */
        temSeparadorErrado: separadorFoiCorrigido(request.url),
      },
      parametros: {
        /** Como o Next lê sozinho. */
        comoONextLe: cru,
        /** Como nós lemos, tolerando o `?`. */
        comoNosLemos: tolerante,
      },
      manifesto: {
        doNext: lerManifestoDaUrl(request.nextUrl.searchParams),
        nosso: lerManifestoDaUrl(parametrosDoPainel(request.url)),
      },
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
