/**
 * O VÍDEO DO PASSO A PASSO DA ANVISA — ADR-0029 D-07.
 *
 * 🎯 Para o vídeo aparecer na tela `/paciente/anvisa`, troque SÓ a `url` abaixo. Nada mais
 * precisa mudar. Com a `url` vazia, a tela mostra "vídeo em breve".
 *
 * Onde o vídeo mora (decisão do Davi, 29/09/2026: _"exatamente seguindo padrão"_): no **Vercel
 * Blob**, o mesmo armazenamento dos outros arquivos. Suba o arquivo `.mp4` no Blob e cole aqui o
 * endereço que ele devolve, do tipo `https://xxxx.public.blob.vercel-storage.com/...mp4`.
 *
 * ⚠️ Por que só esse endereço (ou um caminho do próprio site, começando com `/`): o CSP do site
 * só permite vídeo de `'self'` e de `https://*.public.blob.vercel-storage.com`
 * (`next.config.ts`, `media-src`). Um endereço de outro lugar, como YouTube, seria bloqueado
 * pelo navegador e o player ficaria quebrado — por isso `urlDoVideo()` o recusa e a tela cai no
 * "vídeo em breve". O vídeo é institucional, sem dado de paciente: o store público serve.
 *
 * `legenda` é opcional: um arquivo `.vtt` no mesmo lugar, para quem assiste sem som.
 */
export const VIDEO_DO_PASSO_A_PASSO = {
  url: '',
  legenda: '',
};

const PERMITIDO = /^(\/(?!\/)|https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/)/i;

/** A URL só volta se o navegador vai conseguir tocar. Qualquer outra coisa vira `null`. */
export function urlDoVideo(url: string): string | null {
  const limpa = url.trim();
  return limpa && PERMITIDO.test(limpa) ? limpa : null;
}
