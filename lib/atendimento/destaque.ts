/**
 * O QUE FICA GRANDE NA CHAMADA — ADR-0029 D-25.
 *
 * Puro, sem React: é a regra que o guarda executa. A tela do outro lado vence a câmera dele; com as
 * duas, a preferida vai ao destaque e a outra à miniatura, e clicar na miniatura a torna preferida.
 */
export type Qual = 'tela' | 'camera';

export function escolherDestaque<T>(
  remotos: Record<Qual, T | null>,
  preferido: Qual,
): { destaque: T | null; miniatura: T | null; aoClicarNaMiniatura: Qual } {
  const outro: Qual = preferido === 'tela' ? 'camera' : 'tela';
  const noDestaque: Qual | null = remotos[preferido] ? preferido : remotos[outro] ? outro : null;
  const naMiniatura: Qual | null =
    noDestaque && remotos[noDestaque === 'tela' ? 'camera' : 'tela']
      ? noDestaque === 'tela'
        ? 'camera'
        : 'tela'
      : null;
  return {
    destaque: noDestaque ? remotos[noDestaque] : null,
    miniatura: naMiniatura ? remotos[naMiniatura] : null,
    aoClicarNaMiniatura: naMiniatura ?? preferido,
  };
}
