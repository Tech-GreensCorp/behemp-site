/**
 * O motivo de uma falha, em forma que serve para diagnóstico e não vaza nada.
 *
 * 🔴 POR QUE EXISTE, e o custo medido de não ter existido.
 *
 * `erro.name` de um `new Error` é **sempre** `'Error'`. Catorze lugares deste repositório
 * logavam exatamente isso, e um deles escondeu por quatro dias o
 * `Cannot use private access on a public store` que impedia TODO documento de paciente de ser
 * gravado — do anexo do formulário ao que a Greens envia. O log existia, rodava, e não dizia
 * nada: `{ erro: 'Error' }`.
 *
 * ⚠️ E a correção óbvia — trocar por `erro.message` — introduz um defeito pior.
 *
 * A `message` de um erro de `fetch` costuma trazer o endereço, e o do parceiro carrega a
 * assinatura de acesso ao S3 dele. Log não é lugar de credencial, e URL presignada É
 * credencial: quem a lê baixa o documento. Por isso aqui a URL é **redigida**, não truncada —
 * truncar deixaria o começo, e o começo é o bastante para identificar o bucket.
 *
 * Esta função nasceu dentro de `lib/parceiros/documentos-do-parceiro.ts` em 13/09/2026, e foi
 * extraída no mesmo dia ao se descobrir que o elo SEGUINTE do mesmo fluxo
 * (`materializar-documentos.ts`) repetia o defeito que ela resolve.
 */

/** Tamanho máximo do motivo. Cabe num log e numa coluna, sem truncar o que importa. */
const LIMITE = 120;

/** O que o driver do Postgres anexa ao erro. Nenhum destes campos carrega VALOR de coluna. */
type CausaDeBanco = { code?: string; constraint?: string; table?: string };

/**
 * SQLSTATE tem cinco caracteres e começa por dígito (`23505` unique, `22P02` texto inválido).
 * É o que distingue erro de BANCO de erro de REDE, que usa `ECONNREFUSED` e afins no mesmo
 * campo `cause.code`.
 */
const SQLSTATE = /^\d[0-9A-Z]{4}$/;

export function motivoLegivel(erro: unknown): string {
  if (!(erro instanceof Error)) return 'erro_desconhecido';

  const causa = (erro as { cause?: CausaDeBanco }).cause;

  /**
   * 🔴 ERRO DE BANCO: NADA da mensagem serve, e isto foi MEDIDO em 13/09/2026.
   *
   * O Drizzle monta a `message` com a QUERY INTEIRA e os valores inline:
   *
   *     Failed query: insert into t2 values ('529.982.247-25', 'rg_maria_silva.pdf')
   *
   * Num `insert` de paciente isso é CPF, telefone e texto clínico direto no log — pior que o
   * `detail` do Postgres, que ao menos traz só a coluna que violou. Redigir por regex não
   * resolve: os valores chegam sem rótulo, e uma regex de CPF não reconhece nome de arquivo,
   * endereço nem queixa clínica.
   *
   * `code` + `constraint` + `table` dizem exatamente o que falhou e **não carregam valor
   * nenhum** — é diagnóstico melhor que a mensagem, além de seguro. `23505:documentos_url_key`
   * responde a pergunta; `Failed query: insert…` responde e entrega o paciente junto.
   */
  if (causa?.code && SQLSTATE.test(causa.code)) {
    return ['banco', causa.code, causa.constraint, causa.table]
      .filter(Boolean)
      .join(':')
      .slice(0, LIMITE);
  }

  /**
   * ⚠️ Erro de REDE: `cause.code` antes da mensagem, e a ordem importa.
   *
   * `fetch` do Node traz a mensagem genérica `fetch failed` e guarda o que interessa —
   * `ECONNREFUSED`, `ENOTFOUND`, `UND_ERR_CONNECT_TIMEOUT` — em `cause.code`. Sem isto, três
   * falhas muito diferentes chegam ao log com o mesmo texto.
   */
  const texto = (causa?.code ? causa.code + ': ' + erro.message : erro.message) || erro.name;

  /**
   * 🔴 Rede de segurança: uma mensagem de query que tenha escapado do ramo acima — driver
   * diferente, erro sem `cause`, versão nova do Drizzle — não passa daqui inteira.
   */
  if (/^Failed query:/i.test(texto)) return 'banco:query_falhou';

  return texto
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LIMITE);
}
