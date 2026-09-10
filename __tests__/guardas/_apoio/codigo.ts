/**
 * Ler código como código — sem os comentários.
 *
 * 🔴 POR QUE ISTO É UM MÓDULO, E NÃO UMA FUNÇÃO SOLTA EM CADA GUARDA
 * Guarda estrutural que varre texto acusa o comentário que **explica a regra**. Aconteceu duas
 * vezes neste repositório: o guarda de relay casou o comentário que documentava a correção, e o
 * de driver casou a frase *"sem `process.env`"*. É a Regra 2 da técnica (granularidade do
 * defeito): casar um texto onde ele **não decide nada** é falsa acusação.
 *
 * Como dois guardas passaram a precisar disto, ele vira módulo — duplicado, divergiria.
 *
 * ⚠️ Não é um parser. Não trata `//` dentro de string nem regex literal. Serve para o uso que
 * tem: reduzir falsa acusação em varredura de fonte. Onde a precisão importar mais, o guarda
 * deve casar a **posição** do valor, não a presença dele.
 */

/** Remove comentários de bloco e de linha. Preserva `://` de URL. */
export function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** O corpo de uma `interface`/`type` nomeada, sem comentários. Vazio se não achar. */
export function corpoDoTipo(fonte: string, nome: string): string {
  const limpo = semComentarios(fonte);
  const i = limpo.search(new RegExp(`(interface|type)\\s+${nome}\\b`));
  if (i < 0) return '';
  const abre = limpo.indexOf('{', i);
  if (abre < 0) return '';
  let nivel = 0;
  for (let j = abre; j < limpo.length; j++) {
    if (limpo[j] === '{') nivel++;
    else if (limpo[j] === '}' && --nivel === 0) return limpo.slice(abre + 1, j);
  }
  return '';
}

/** Os nomes de campo declarados no corpo de um tipo. */
export function camposDo(corpo: string): string[] {
  return [...corpo.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*\??\s*:/gm)].map((m) => m[1]);
}

/**
 * Os valores literais de um `export type X = 'a' | 'b' | 'c'` do contrato.
 *
 * Existe para que guarda de duas pontas possa **derivar** o conjunto válido do próprio contrato,
 * em vez de manter uma lista paralela — lista paralela é a coisa que diverge, e um guarda que
 * valida contra a própria cópia desatualizada aprova o errado.
 */
export function valoresDeUnion(fonte: string, nomeDoTipo: string): string[] {
  const limpo = semComentarios(fonte);
  const m = limpo.match(new RegExp(`type\\s+${nomeDoTipo}\\s*=([^;]+);`));
  if (!m) return [];
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

/**
 * Os valores literais de um campo declarado inline num tipo:
 *   procedencia: 'inferido_ia' | 'catalogo_validado';
 */
export function valoresDeCampoInline(corpoDoTipo: string, campo: string): string[] {
  const m = corpoDoTipo.match(new RegExp(`\\b${campo}\\s*\\??\\s*:([^;]+);`));
  if (!m) return [];
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}
