/**
 * A ESPERA DA CHAMADA — ADR-0029 D-28.
 *
 * Puro, sem React: são as duas regras que o guarda executa.
 *
 * 1. O que o palco mostra. Antes de a conexão se completar, o outro lado ainda não está na sala, e
 *    dizer "{outro} está sem câmera" era dizer uma coisa falsa sobre quem nem chegou. A espera vence
 *    qualquer vídeo até `conectado`.
 * 2. A altura das barras do "Você · microfone ligado". Elas seguem o nível medido no próprio aparelho
 *    e ficam paradas sem som: barra que mexe sem voz diria ao paciente que ele está sendo ouvido
 *    quando não está (Davi, 01/10/2026).
 */
export type FaseDaChamada =
  | 'entrando'
  | 'aguardando'
  | 'conectando'
  | 'conectado'
  | 'encerrada'
  | 'erro';

export type FaseDeEspera = 'entrando' | 'aguardando' | 'conectando';

export type NoPalco = 'espera' | 'destaque' | 'sem-camera' | 'nada';

export function oQueOPalcoMostra(fase: FaseDaChamada, temDestaque: boolean): NoPalco {
  if (fase === 'entrando' || fase === 'aguardando' || fase === 'conectando') return 'espera';
  if (fase === 'conectado') return temDestaque ? 'destaque' : 'sem-camera';
  return 'nada';
}

/** A barra parada, como no canvas (`bh-eq` vai de `scaleY(.25)` a `scaleY(1)`). */
export const BARRA_PARADA = 0.25;

/**
 * As faixas de cada uma das quatro barras, em índices de `getByteFrequencyData` com `fftSize` 256 a
 * 48 kHz (187,5 Hz por índice): de ~190 Hz a ~4 kHz, onde está a voz.
 */
const FAIXAS: ReadonlyArray<readonly [number, number]> = [
  [1, 3],
  [4, 7],
  [8, 13],
  [14, 21],
];

/** Abaixo disto é ruído de fundo, e a barra não sobe (escala de 0 a 1 do byte de frequência). */
export const LIMIAR_DE_SOM = 0.18;

export function alturasDasBarras(espectro: ArrayLike<number>, mudo: boolean): number[] {
  return FAIXAS.map(([de, ate]) => {
    if (mudo) return BARRA_PARADA;
    let soma = 0;
    for (let i = de; i <= ate; i++) soma += espectro[i] ?? 0;
    const nivel = soma / (ate - de + 1) / 255;
    if (!(nivel > LIMIAR_DE_SOM)) return BARRA_PARADA;
    const acima = Math.min(1, (nivel - LIMIAR_DE_SOM) / (1 - LIMIAR_DE_SOM) / 0.6);
    return BARRA_PARADA + (1 - BARRA_PARADA) * acima;
  });
}

/** "Na sala há m:ss". */
export function formatarTempoNaSala(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
