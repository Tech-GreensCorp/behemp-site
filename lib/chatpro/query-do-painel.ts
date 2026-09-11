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
 * 🔴 RECEBE `request.url` (string), NUNCA `request.nextUrl` — e o porquê é honesto: eu ainda
 * NÃO sei qual é a causa em produção.
 *
 * A primeira versão passava `request.nextUrl` e **não funcionou em produção**, com o código já
 * no servidor. Medido depois do deploy, com telefones novos e pausa entre as chamadas:
 *
 *     ?tem=autorizacao_anvisa**&**sessionId=…  →  "já recebemos": 1 seção
 *     ?tem=autorizacao_anvisa**?**sessionId=…  →  "já recebemos": 0 seções
 *
 * ⚠️ RETRATAÇÃO: eu tinha escrito aqui que o `NextURL` normaliza a query. **Medi, e é falso.**
 * Com `new NextRequest(url)` no Node, `nextUrl.search` preserva o `?` e devolve exatamente o
 * mesmo que `new URL(request.url)`. A causa em produção é outra, e não a isolei.
 *
 * **Por que ainda assim mudei para `request.url`:** ela é a string que o runtime recebeu, sem
 * nenhum parser intermediário entre o cliente e esta função. Se houver normalização em algum
 * ponto do caminho — proxy, runtime, ou construção do `NextURL` a partir do request HTTP real,
 * que é diferente de construí-lo de uma string —, é o `request.url` que tem a melhor chance de
 * escapar dela. É uma hipótese com custo baixo, não uma causa provada.
 *
 * 🔴 **O QUE FAZER SE CONTINUAR FALHANDO DEPOIS DESTE DEPLOY:** o próximo passo é fazer o
 * servidor dizer o que viu — um campo no `/api/parceiros/health`, ou um log que se consiga ler.
 * Sem isso, a próxima tentativa é adivinhação outra vez, e já gastamos um deploy assim.
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
  return new URLSearchParams(bruto.replace(/\?/g, '&'));
}

/** `true` quando a URL veio com o separador errado — para o log dizer que isso aconteceu. */
export function separadorFoiCorrigido(urlCrua: string): boolean {
  const inicio = urlCrua.indexOf('?');
  return inicio !== -1 && urlCrua.slice(inicio + 1).includes('?');
}
