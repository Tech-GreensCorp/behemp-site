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
 */

/**
 * Lê os parâmetros tolerando `?` usado como separador.
 *
 * O primeiro `?` separa caminho de query; do segundo em diante, vira `&`.
 */
export function parametrosDoPainel(url: URL): URLSearchParams {
  const bruto = url.search.startsWith('?') ? url.search.slice(1) : url.search;
  if (!bruto.includes('?')) return url.searchParams;
  return new URLSearchParams(bruto.replace(/\?/g, '&'));
}

/** `true` quando a URL veio com o separador errado — para o log dizer que isso aconteceu. */
export function separadorFoiCorrigido(url: URL): boolean {
  return url.search.slice(1).includes('?');
}
