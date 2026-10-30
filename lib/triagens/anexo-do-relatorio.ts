/**
 * O relatório médico anexado à triagem — a data URL em base64 que o formulário público grava em
 * `triagens.dados.relatorio_medico_arquivo`.
 *
 * Fonte única de duas pontas: `criarTriagem` valida a gravação com estes tipos, e
 * `/api/triagens/[id]/relatorio` confere a entrega com os mesmos. Lista paralela desatualiza.
 *
 * Puro de propósito: sem `db`, sem `auth`, sem `next/*`.
 */

export const CAMPO_DO_ARQUIVO = 'relatorio_medico_arquivo';

export const MIME_DO_RELATORIO_PERMITIDOS: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/**
 * Prefixo que a listagem confere em SQL (`LIKE`) para dizer que há anexo. É o mesmo formato que
 * `lerDataUrl` aceita: sem isso o botão aparece para um valor que a rota sempre recusa.
 */
export const PADRAO_SQL_DO_ANEXO = 'data:%;base64,%';

/**
 * Mesma semântica de `PADRAO_SQL_DO_ANEXO`: `data:`, qualquer coisa, a PRIMEIRA ocorrência de
 * `;base64,`, e o resto. Tipo vazio ou estranho não recusa aqui — vira `application/octet-stream`
 * em `tipoDaEntrega`. Se as duas pontas divergirem, o botão aparece para o que a rota recusa.
 */
const DATA_URL = /^data:([\s\S]*?);base64,([\s\S]*)$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Decompõe a data URL. `null` quando não é data URL em base64. */
export function lerDataUrl(valor: string): { mimeType: string; conteudo: string } | null {
  const partes = DATA_URL.exec(valor);
  if (!partes) return null;
  return { mimeType: partes[1].trim().toLowerCase(), conteudo: partes[2] };
}

/**
 * Decodifica o base64 do anexo. `null` quando vazio ou corrompido.
 *
 * `Buffer.from(x, 'base64')` nunca lança: descarta o que não é base64 e devolve o resto — e o
 * admin baixaria um arquivo vazio ou quebrado com status 200. Por isso o alfabeto é conferido
 * antes.
 */
export function decodificarConteudo(conteudo: string): Buffer | null {
  const limpo = conteudo.replace(/\s+/g, '');
  if (limpo.length === 0 || limpo.length % 4 !== 0 || !BASE64.test(limpo)) return null;
  const bytes = Buffer.from(limpo, 'base64');
  return bytes.length > 0 ? bytes : null;
}

/**
 * O `content-type` da entrega. Tipo fora da lista vira `application/octet-stream`: triagem
 * antiga pode não ter passado pela validação, e servir `text/html` ou `image/svg+xml` gravado
 * pelo formulário público, na origem do app, seria XSS armazenado na sessão do admin.
 */
export function tipoDaEntrega(mimeType: string): string {
  return MIME_DO_RELATORIO_PERMITIDOS.has(mimeType) ? mimeType : 'application/octet-stream';
}

/**
 * Codifica o valor de `filename*` (RFC 5987/8187). `encodeURIComponent` deixa passar `'`, `(`,
 * `)` e `*`, que não são `attr-char` — e o `'` é o delimitador do próprio campo.
 */
export function codificarNomeRfc5987(nome: string): string {
  return encodeURIComponent(nome).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
