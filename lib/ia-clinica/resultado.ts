/**
 * `ResultadoAction` — declarada UMA vez para o módulo de IA clínica.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * `interface ActionResult` está duplicada em **10+ arquivos** de action deste repositório
 * (Prioridade 3 do `03-CHECKLIST-MESTRE.md`). Cada cópia divergiu um pouco: umas têm `dados`,
 * outras `data`, umas `erro`, outras `error`. O módulo novo não vira a 11ª cópia.
 *
 * ⚠️ **Não retroage.** As cópias existentes ficam onde estão — unificá-las tocaria 10+ arquivos
 * em produção, é dívida catalogada e precisa de autorização própria. Esta declaração vale para
 * o código **novo** do módulo.
 *
 * A forma segue o padrão medido em `06-PADROES-DO-CODIGO.md` §5: `{ sucesso, dados?, erro? }`.
 */

/**
 * União discriminada de propósito: `sucesso: false` **não** carrega `dados`, então o
 * TypeScript obriga quem chama a tratar a falha antes de ler o resultado. Um objeto com os
 * dois campos opcionais permitiria ler `dados` de uma resposta que falhou — que é exatamente
 * o bug silencioso que este tipo existe para tornar impossível.
 */
export type ResultadoAction<T = undefined> =
  | { sucesso: true; dados: T }
  | { sucesso: false; erro: string };

/** Atalho para o caso de sucesso sem payload. */
export type ResultadoSimples = ResultadoAction<undefined>;

export function ok<T>(dados: T): ResultadoAction<T> {
  return { sucesso: true, dados };
}

export function falha(erro: string): { sucesso: false; erro: string } {
  return { sucesso: false, erro };
}
