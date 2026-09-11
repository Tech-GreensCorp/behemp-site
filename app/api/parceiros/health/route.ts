/**
 * `GET /api/parceiros/health` — o diagnóstico da integração com o parceiro, em dois `curl`.
 *
 * 🔴 POR QUE ESTA ROTA EXISTE, e o dia em que a falta dela custou.
 *
 * Em 11/09/2026 a tela da Greens mostrou _"Não conseguimos levar você agora"_ enquanto o
 * cadastro nascia aqui normalmente. Para investigar do lado deles bastou um `curl` no health
 * que **eles** têm. Do nosso lado não havia nenhum: a única forma de saber se um handoff
 * chegou era abrir o Postgres de produção — e ninguém faz isso no meio de uma apresentação.
 *
 * A Greens propôs a simetria no §12 do contrato-ponte, e o argumento é bom: _"os dois lados
 * respondem a MESMA forma, e é isso que faz a investigação caber em dois `curl`"_.
 *
 * ⚠️ PÚBLICO, E POR ISSO INÓCUO POR CONSTRUÇÃO.
 *
 * A proposta original foi nossa, em 10/09: _"um health que exige autenticação vira mais uma
 * coisa que não funciona na madrugada; um que não exige precisa ser inócuo se vazar"_. Então
 * o que sai daqui é **booleano e contagem de fila** — nada derivado de segredo, nenhum
 * `referralId`, nenhum protocolo, nenhuma contagem de paciente.
 *
 * 🔴 `configurado` NÃO diz qual segredo, nem o tamanho, nem parte dele. Diz que existe. Quem
 * já sabe que a integração existe não aprende nada; quem não sabe, também não.
 *
 * ⚠️ `ultimoEventoEm` é a data do último evento **enviado**, não do último recebido. A fila
 * daqui é de saída; a entrada (handoff) não passa por ela. Um handoff que chegou e um que não
 * chegou são indistinguíveis neste campo — e dizer isso é melhor que deixar alguém concluir o
 * contrário de um número.
 */

import { NextRequest, NextResponse } from 'next/server';
import { count, eq, max } from 'drizzle-orm';

import { db } from '@/lib/db';
import { parceiroEventosSaida } from '@/db/schema';
import { transferenciaAtiva } from '@/lib/parceiros/pode-transferir';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';

/** Generoso para quem investiga, estreito para quem varre. */
const LIMITE = 60;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const limite = consumir(identificarChamador(request.headers, 'healthparceiro'), LIMITE, 60);
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: 'Muitas requisições' },
      { status: 429, headers: cabecalhosDoLimite(limite, LIMITE) },
    );
  }

  try {
    const [porStatus, [ultimo]] = await Promise.all([
      db
        .select({ status: parceiroEventosSaida.status, quantos: count() })
        .from(parceiroEventosSaida)
        .groupBy(parceiroEventosSaida.status),
      db
        .select({ em: max(parceiroEventosSaida.enviadoEm) })
        .from(parceiroEventosSaida)
        .where(eq(parceiroEventosSaida.status, 'enviado')),
    ]);

    const quantos = (estado: string) => porStatus.find((l) => l.status === estado)?.quantos ?? 0;

    return NextResponse.json(
      {
        /** A mesma forma que a Greens publica, para os dois lados se lerem igual. */
        configurado: Boolean(
          process.env.PARCEIRO_GREENS_API_URL?.trim() &&
            process.env.PARCEIRO_GREENS_SEGREDO_SAIDA?.trim(),
        ),
        ultimoEventoEm: ultimo?.em ? new Date(ultimo.em).toISOString() : null,
        pendentes: quantos('pendente') + quantos('enviando'),
        falhados: quantos('falhou'),
        /** O par do S2 é separado do S1 — um configurado não implica o outro. */
        cadastroConfigurado: Boolean(process.env.PARCEIRO_GREENS_SEGREDO_CADASTRO?.trim()),
        /**
         * 🔴 A TRAVA, que é nossa e não tem equivalente do lado deles.
         *
         * Sem ela em `1`, nenhuma transferência sai — e essa é a primeira pergunta de quem
         * investiga "por que o cadastro não chegou lá". Expor o booleano evita a hipótese
         * errada; expor o valor não acrescentaria nada.
         */
        transferenciaAtiva: transferenciaAtiva(),
        /** Para o handoff de ENTRADA: sem isto, nada que a Greens manda é aceito. */
        entradaConfigurada: Boolean(process.env.PARCEIRO_GREENS_SEGREDO_ENTRADA?.trim()),
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (erro) {
    /**
     * ⚠️ 503 e corpo mínimo. Um health que devolve stack trace entrega a topologia de quem
     * o consulta — e quem o consulta, aqui, é qualquer um.
     */
    console.error('[parceiros] health indisponível', {
      erro: erro instanceof Error ? erro.name : 'desconhecida',
    });
    return NextResponse.json({ erro: 'Indisponível' }, { status: 503 });
  }
}
