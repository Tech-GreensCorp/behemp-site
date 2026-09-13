/**
 * `GET /api/fluxo/situacao` — a sentinela respondendo sobre si mesma.
 *
 * 🔴 POR QUE ESTA ROTA EXISTE — ADR-0022, §32 e D-16.
 *
 * O S8.1 da Sprint 8 era _"consultar em produção por que o aviso de cadastro pendente não
 * apareceu"_. Em 13/09/2026 o dono informou que **não tem acesso ao banco de produção nem à
 * VPS, e não vai conseguir** — e esse item bloqueava a sentinela inteira.
 *
 * ⚠️ A SAÍDA NÃO É ESPERAR O ACESSO: é construir o instrumento. Foi a lição que o `%3F` cobrou
 * em 11/09 — duas correções falharam por adivinhação, e o que resolveu foi criar
 * `GET /api/chatpro/eco` e **perguntar ao servidor o que ele via**. O comentário que ficou lá
 * diz: _"o instrumento custou menos que a segunda tentativa"_.
 *
 * 🔴 E ISTO NÃO É CONTORNO TEMPORÁRIO. A sentinela já ia ter de responder "o ponto **e o
 * porquê**" (D-06). Esta rota só **expõe** esse porquê — construir o instrumento é construir
 * metade dela, não um desvio.
 *
 * ## O que ela devolve, e por que é inócua
 *
 * O ponto do fluxo, o motivo em uma frase, o destino e a origem. **Nada de dado pessoal**: nem
 * e-mail, nem CPF, nem nome, nem o conteúdo de documento nenhum. O protocolo aparece dentro do
 * `porque` porque é o identificador que o atendimento usa para achar o caso — e ele não
 * identifica pessoa sozinho.
 *
 * ⚠️ EXIGE O MESMO SEGREDO do `bot-link` e da rota de eco, pelas mesmas duas razões: uma rota
 * que descreve o estado de uma conta é ferramenta de sondagem se ficar aberta, e quem pode
 * gerar link para um paciente pode diagnosticar por que ele travou.
 *
 * ⚠️ E NÃO ECOA CABEÇALHO NEM CORPO. Ecoar cabeçalho devolveria o próprio segredo a quem o
 * mandou, e um dia alguém colaria essa resposta num chamado de suporte.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { contasConfiguradas, identificarConta } from '@/lib/chatpro/contas';
import { lerSegredoDoCabecalho } from '@/lib/chatpro/segredo';
import { situacaoDoFluxo } from '@/lib/fluxo/sentinela';
import { parametrosDoPainel } from '@/lib/chatpro/query-do-painel';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';

const LIMITE = 20;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const limite = consumir(identificarChamador(request.headers, 'fluxo-situacao'), LIMITE, 60);
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: 'Muitas requisições' },
      { status: 429, headers: cabecalhosDoLimite(limite, LIMITE) },
    );
  }

  if (contasConfiguradas().length === 0) {
    return NextResponse.json({ erro: 'Não configurado' }, { status: 503 });
  }
  if (!identificarConta(lerSegredoDoCabecalho(request.headers))) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
  }

  /**
   * ⚠️ `parametrosDoPainel`, não `searchParams` cru — o proxy reverso percent-encoda o segundo
   * `?` como `%3F`, e ler cru devolveria tudo como um parâmetro só. É o defeito que o guarda
   * `a-query-do-painel-aguenta-o-separador-errado` fecha, e esta rota não pode repeti-lo.
   */
  const email = parametrosDoPainel(request.url).get('email')?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ erro: 'Informe ?email=' }, { status: 400 });
  }

  /**
   * A sentinela trabalha por `clerkId`, que é como as telas a chamam. Aqui o diagnóstico parte
   * do e-mail, que é o que o atendimento tem em mãos quando um paciente liga.
   */
  const [pessoa] = await db
    .select({ clerkId: users.clerkId })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  const situacao = await situacaoDoFluxo(pessoa?.clerkId);

  return NextResponse.json(
    {
      /** `false` quando nem existe linha em `users` para esse e-mail. */
      encontrado: Boolean(pessoa),
      ponto: situacao.ponto,
      porque: situacao.porque,
      destino: situacao.destino,
      origem: situacao.origem,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
