/**
 * O cabeçalho `content-disposition` de um arquivo de paciente, seguro para QUALQUER nome.
 *
 * 🔴 O nome ia cru: `inline; filename="${nome}"`. Valor de cabeçalho só aceita Latin-1, e um
 * nome com travessão ("—", U+2014), aspas curvas ou ideograma faz `new Response(...)` LANÇAR —
 * a rota caía no `catch` e respondia 502 "Documento indisponível" para um arquivo que existe.
 * Aspas e `\r\n` no nome, além disso, abrem injeção de cabeçalho.
 *
 * RFC 6266 / 5987: `filename` com fallback ASCII para clientes antigos e `filename*` em UTF-8
 * para o nome verdadeiro.
 */
export function disposicaoInline(nome: string | null | undefined, fallback: string): string {
  const limpo = (nome ?? '').replace(/[\r\n]+/g, ' ').trim() || fallback;

  const ascii =
    limpo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\;]/g, '_')
      .trim() || 'arquivo';

  // `encodeURIComponent` deixa passar ! ' ( ) * — e o RFC 5987 não os aceita em `filename*`.
  const utf8 = encodeURIComponent(limpo).replace(
    /['()*!]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `inline; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
