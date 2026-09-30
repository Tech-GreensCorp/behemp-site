/**
 * A área grande de vídeo no topo do passo a passo da ANVISA — ADR-0029 D-07 (`DO-69`).
 *
 * Nasce pronta: o vídeo entra trocando uma linha em `lib/anvisa/video-do-passo-a-passo.ts`.
 * Sem vídeo, ela diz isso — nunca um player quebrado nem um espaço em branco, que fariam o
 * paciente achar que a página não carregou.
 */
import { PlayCircle } from 'lucide-react';

import { urlDoVideo, VIDEO_DO_PASSO_A_PASSO } from '@/lib/anvisa/video-do-passo-a-passo';

export function VideoDoPassoAPasso() {
  const url = urlDoVideo(VIDEO_DO_PASSO_A_PASSO.url);
  const legenda = urlDoVideo(VIDEO_DO_PASSO_A_PASSO.legenda);

  if (!url) {
    return (
      <div className="border-border bg-muted/40 flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border text-center">
        <PlayCircle className="text-muted-foreground h-12 w-12" aria-hidden="true" />
        <div className="space-y-1 px-6">
          <p className="text-foreground text-sm font-semibold">Vídeo do passo a passo em breve</p>
          <p className="text-muted-foreground text-xs">
            Enquanto isso, siga os passos abaixo. Se precisar, peça atendimento com suporte no fim
            da página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <video
      controls
      playsInline
      preload="metadata"
      className="aspect-video w-full rounded-2xl bg-black"
      aria-label="Vídeo do passo a passo da autorização ANVISA"
    >
      <source src={url} />
      {legenda && <track kind="captions" src={legenda} srcLang="pt-BR" label="Português" default />}
      Seu navegador não conseguiu tocar o vídeo. Siga os passos abaixo.
    </video>
  );
}
