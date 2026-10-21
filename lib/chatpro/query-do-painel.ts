/**
 * A QUERY STRING QUE O PAINEL DO CHATPRO MONTA — e por que ela precisa ser consertada aqui.
 *
 * 🔴 O DEFEITO, medido em produção em 11/09/2026, depois de a Greens o prever.
 *
 * O painel acrescenta os parâmetros dele à URL configurada. Quando essa URL **já tem** query
 * (`?tem=receita_medica`), o painel pode emendar com `?` em vez de `&`:
 *
 *     .../bot-link?tem=receita_medica?sessionId=abc
 *                                   ↑ o segundo `?`
 *
 * O `URLSearchParams` lê isso como **um** parâmetro: `tem` = `receita_medica?sessionId=abc`.
 * O manifesto se perde, e o `sessionId` junto.
 *
 * ⚠️ E O MODO COMO ISSO FALHA É O PIOR POSSÍVEL: silenciosamente. Medi os dois casos contra
 * produção, com o mesmo segredo e telefones diferentes:
 *
 *     ?tem=receita_medica?sessionId=…  →  HTTP 200, link válido, "já recebemos": 0 seções
 *     ?tem=receita_medica&sessionId=…  →  HTTP 200, link válido, "já recebemos": 1 seção
 *
 * Ninguém vê erro. O paciente recebe o link, abre, e a tela pede documento que ele já mandou.
 *
 * 🔴 POR QUE CONSERTAR AQUI, E NÃO PEDIR UMA ROTA POR FLUXO.
 *
 * A saída que a Greens levantou era criar um endpoint por fluxo, para nenhuma URL precisar de
 * query. Isso multiplica rotas por uma limitação de UI de terceiro, e cada rota nova é mais
 * uma superfície para manter, documentar e proteger. **Uma query string válida nunca tem `?`
 * depois do primeiro** — então o segundo em diante só pode ser separador mal escrito, e
 * tratá-lo como tal não é adivinhação: é a única leitura possível.
 *
 * ⚠️ Vale para o que o PAINEL monta, não para o que o paciente digita. Estas rotas são
 * chamadas por máquina, com segredo no cabeçalho — não há caso em que um `?` literal dentro de
 * um valor seja intencional.
 *
 * 🔴 A CAUSA, ENFIM MEDIDA: O SEGUNDO `?` CHEGA COMO `%3F`.
 *
 * Duas tentativas falharam antes desta, e as duas por eu adivinhar. A resposta veio quando
 * criei `GET /api/chatpro/eco` e **perguntei ao servidor o que ele tinha recebido**:
 *
 * ```jsonc
 * "crua": "https://0.0.0.0:3000/api/chatpro/eco?tem=autorizacao_anvisa%3FsessionId%3Dabc&name=X"
 * //                                                              ↑ %3F, não `?`
 * "temSeparadorErrado": false      // não havia `?` literal para trocar
 * ```
 *
 * O `0.0.0.0:3000` entrega o resto da história: quem chega ao Next é o request **reescrito
 * pelo proxy reverso**, e é ele que percent-encoda o segundo `?` (e o `=` seguinte, como
 * `%3D`). Nenhuma das duas versões anteriores podia funcionar — as duas procuravam um `?` que
 * já não existia ali.
 *
 * ⚠️ RETRATAÇÃO DUPLA, e as duas ficam escritas porque o caminho ensina mais que o destino:
 *
 *   1. escrevi que o `NextURL` normalizava a query. **Falso** — medido com `new NextRequest`,
 *      `nextUrl.search` preserva o `?` e é idêntico a `new URL(request.url)`;
 *   2. troquei para `request.url` chamando de "hipótese de custo baixo". Era hipótese mesmo, e
 *      **estava errada**: a reescrita acontece antes das duas leituras.
 *
 * 🔴 A LIÇÃO, que vale mais que a correção: **eu gastei dois deploys porque não havia como
 * perguntar ao servidor o que ele via.** O instrumento custou menos que a segunda tentativa.
 */

/**
 * Lê os parâmetros tolerando `?` usado como separador.
 *
 * O primeiro `?` separa caminho de query; do segundo em diante, vira `&`.
 */
export function parametrosDoPainel(urlCrua: string): URLSearchParams {
  const inicio = urlCrua.indexOf('?');
  if (inicio === -1) return new URLSearchParams();
  const bruto = urlCrua.slice(inicio + 1);

  /**
   * Primeiro o `?` literal — o caso de quem chama sem passar por proxy, como um `curl` direto
   * ou um teste. Depois o `%3F`, que é como ele chega em produção.
   */
  const semLiteral = bruto.replace(/\?/g, '&');

  /**
   * 🔴 O QUE VEM DEPOIS DO `%3F` FOI CODIFICADO COMO SE FOSSE VALOR, e por isso o `=` do
   * primeiro par virou `%3D` e um eventual `&` virou `%26`. Decodificar só **nesses segmentos**
   * é o que separa "conserto" de "estrago": decodificar a query inteira quebraria qualquer
   * valor legítimo que contenha `=` ou `&` escapados de propósito.
   */
  const partes = semLiteral.split(/%3F/i);
  if (partes.length === 1) return new URLSearchParams(semLiteral);

  const remontado = partes
    .map((parte, i) => (i === 0 ? parte : parte.replace(/%3D/gi, '=').replace(/%26/gi, '&')))
    .join('&');

  return new URLSearchParams(remontado);
}

/** `true` quando a URL veio com o separador errado — para o log dizer que isso aconteceu. */
export function separadorFoiCorrigido(urlCrua: string): boolean {
  const inicio = urlCrua.indexOf('?');
  if (inicio === -1) return false;
  const query = urlCrua.slice(inicio + 1);
  // As duas formas: o `?` literal e o `%3F` que o proxy produz.
  return query.includes('?') || /%3F/i.test(query);
}
