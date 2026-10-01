'use client';

/**
 * O palco da chamada enquanto o outro lado não chegou — ADR-0029 D-28 (aprovado por Davi em
 * 01/10/2026, a partir do canvas `docs/decisoes-visuais/teleconsulta-1..4.html`).
 *
 * Até aqui o palco dizia "{outro} está sem câmera" também em `entrando`, `aguardando` e
 * `conectando`, quando o outro lado nem estava na sala. Agora a regra é `oQueOPalcoMostra`, e este
 * componente é o que ela manda mostrar antes de `conectado`.
 *
 * As duas diferenças em relação ao canvas são as aprovadas: as barras do microfone seguem o nível
 * medido AQUI (um `AnalyserNode` local; nada sai do aparelho), paradas sem som ou silenciado; e o
 * contador conta. Ele começa do zero porque a tela monta este componente com `key={fase}`.
 */
import { useEffect, useRef, useState } from 'react';
import { Headphones, MessageCircle, MonitorUp, User } from 'lucide-react';

import type { PapelNaChamada } from '@/lib/atendimento/canal';
import {
  alturasDasBarras,
  BARRA_PARADA,
  formatarTempoNaSala,
  type FaseDeEspera,
} from '@/lib/atendimento/espera';

interface Props {
  papel: PapelNaChamada | null;
  fase: FaseDeEspera;
  /** A faixa do microfone desta tela; `null` sem microfone, e aí o indicador não aparece. */
  microfone: MediaStreamTrack | null;
  mudo: boolean;
}

/** "Você · microfone ligado": quatro barras, cada uma uma faixa da voz, medidas neste aparelho. */
function IndicadorDoMicrofone({ microfone, mudo }: { microfone: MediaStreamTrack; mudo: boolean }) {
  const barras = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const pousar = () =>
      barras.current.forEach((b) => {
        if (b) b.style.transform = `scaleY(${BARRA_PARADA})`;
      });
    if (mudo || typeof AudioContext === 'undefined') {
      pousar();
      return;
    }
    const contexto = new AudioContext();
    // Só o analisador: nada vai para `destination` (alto-falante) nem para fora daqui.
    const fonte = contexto.createMediaStreamSource(new MediaStream([microfone]));
    const analisador = contexto.createAnalyser();
    analisador.fftSize = 256;
    analisador.smoothingTimeConstant = 0.5;
    analisador.minDecibels = -70;
    analisador.maxDecibels = -20;
    fonte.connect(analisador);
    const espectro = new Uint8Array(analisador.frequencyBinCount);
    const atual = [BARRA_PARADA, BARRA_PARADA, BARRA_PARADA, BARRA_PARADA];
    let quadro = 0;
    const desenhar = () => {
      analisador.getByteFrequencyData(espectro);
      alturasDasBarras(espectro, mudo).forEach((alvo, i) => {
        // Sobe na hora e desce em ~200 ms, como a curva do canvas; sem som, volta a parar.
        const v = alvo > atual[i]! ? alvo : atual[i]! + (alvo - atual[i]!) * 0.25;
        atual[i] = Math.abs(v - alvo) < 0.01 ? alvo : v;
        const barra = barras.current[i];
        if (barra) barra.style.transform = `scaleY(${atual[i]})`;
      });
      quadro = requestAnimationFrame(desenhar);
    };
    // O navegador pode criar o contexto suspenso até um gesto da pessoa.
    const destravar = () => void contexto.resume().catch(() => {});
    destravar();
    window.addEventListener('pointerdown', destravar);
    quadro = requestAnimationFrame(desenhar);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('pointerdown', destravar);
      fonte.disconnect();
      void contexto.close().catch(() => {});
      pousar();
    };
  }, [microfone, mudo]);

  return (
    <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full border border-[#E7E1D8] bg-white/[0.82] py-1.5 pr-3 pl-2.5 text-xs text-[#3B342D] backdrop-blur-[8px]">
      <span className="espera-eq" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <i
            key={i}
            ref={(el) => {
              barras.current[i] = el;
            }}
          />
        ))}
      </span>
      {mudo ? 'Você · microfone silenciado' : 'Você · microfone ligado'}
    </div>
  );
}

/** "Na sala há m:ss", contado neste relógio desde que esta fase começou. */
function TempoNaSala() {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const inicio = Date.now();
    const id = setInterval(() => setSegundos((Date.now() - inicio) / 1000), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="absolute top-4 right-[18px] m-0 text-xs text-[#6B6259] tabular-nums">
      Na sala há {formatarTempoNaSala(segundos)}
    </p>
  );
}

const ICONE = 'size-[26px] md:size-[34px]';

function Orbe({ papel }: { papel: PapelNaChamada | null }) {
  // Quem se espera: a equipe, para o paciente; o paciente, para a equipe.
  return (
    <div className="espera-orb size-[72px] md:size-24">
      <div className="espera-halo" />
      <div className="espera-ring" />
      <div className="espera-ring espera-r2" />
      <div className="espera-ring espera-r3" />
      <div className="espera-arc" />
      <div className="espera-face">
        {papel === 'paciente' && (
          <Headphones className={ICONE} color="#EA5429" strokeWidth={1.6} aria-hidden="true" />
        )}
        {papel === 'admin' && (
          <User className={ICONE} color="#EA5429" strokeWidth={1.6} aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

function Pessoa({
  rotulo,
  icone: Icone,
  cor,
  sombra,
}: {
  rotulo: string;
  icone: typeof User;
  cor: string;
  sombra: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div
        className="espera-face relative flex size-[72px] items-center justify-center rounded-full bg-white"
        style={{ boxShadow: `0 0 0 6px ${sombra}, 0 18px 40px -20px rgba(26,22,18,.45)` }}
      >
        <Icone size={28} color={cor} strokeWidth={1.6} aria-hidden="true" />
      </div>
      <span className="text-xs font-medium text-[#4A423A]">{rotulo}</span>
    </div>
  );
}

function Dica({ icone: Icone, children }: { icone: typeof User; children: string }) {
  // No celular o chat fica ACIMA, e não "ao lado": o quadro do celular não tem dica.
  return (
    <p className="espera-late m-0 hidden max-w-[440px] items-start gap-2 rounded-[12px] border border-[#E7E1D8] bg-white/70 px-3.5 py-2.5 text-left text-[12.5px] leading-[1.45] text-[#4A423A] md:inline-flex">
      <Icone size={15} color="#8A7F73" strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function EsperaDaChamada({ papel, fase, microfone, mudo }: Props) {
  const admin = papel === 'admin';

  const titulo =
    fase === 'conectando'
      ? admin
        ? 'O paciente chegou'
        : 'A equipe chegou'
      : admin
        ? 'O paciente ainda não entrou'
        : 'Você já está na sala';

  return (
    <div className="espera-palco relative box-border flex h-[300px] flex-col items-center justify-center gap-[22px] overflow-hidden p-5 md:aspect-video md:h-auto md:gap-[26px] md:p-6">
      {fase === 'aguardando' && <TempoNaSala />}

      {fase === 'conectando' ? (
        <div className="espera-rise flex items-center gap-[22px]">
          <Pessoa
            rotulo="Você"
            icone={admin ? Headphones : User}
            cor="#2D4F3C"
            sombra="rgba(45,79,60,.10)"
          />
          <div className="espera-track mb-[26px] w-16 md:w-40">
            <span className="espera-pkt" />
            <span className="espera-pkt espera-back" />
          </div>
          <Pessoa
            rotulo={admin ? 'Paciente' : 'Equipe'}
            icone={admin ? User : Headphones}
            cor="#EA5429"
            sombra="rgba(234,84,41,.10)"
          />
        </div>
      ) : (
        <Orbe papel={papel} />
      )}

      {fase !== 'entrando' && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-1.5 text-center md:gap-2"
        >
          <p className="espera-rise espera-d1 font-heading text-foreground m-0 text-center! text-lg font-semibold md:text-[21px] md:tracking-[-0.01em]">
            {titulo}
          </p>
          <p className="espera-rise espera-d2 m-0 text-center! text-[13px] leading-[1.45] text-[#6B6259] md:max-w-[420px] md:text-sm md:leading-normal">
            {fase === 'conectando' ? (
              'Ligando a voz. Leva só alguns segundos.'
            ) : admin ? (
              'A chamada começa sozinha quando ele abrir este atendimento. O que você escrever no chat agora fica à espera dele.'
            ) : (
              <>
                <span className="md:hidden">
                  A chamada começa sozinha quando alguém da equipe entrar.
                </span>
                <span className="hidden md:inline">
                  Assim que alguém da equipe entrar, a chamada começa sozinha. Não precisa
                  recarregar a página.
                </span>
              </>
            )}
          </p>
        </div>
      )}

      {fase === 'conectando' && (
        <Dica icone={MessageCircle}>
          Se a voz não completar, a conversa continua pelo chat ao lado.
        </Dica>
      )}
      {fase === 'aguardando' &&
        (admin ? (
          <Dica icone={MonitorUp}>
            Antes de mostrar a sua tela, feche o que tiver dado de outros pacientes.
          </Dica>
        ) : (
          <Dica icone={MessageCircle}>
            Enquanto espera, você pode adiantar pelo chat ao lado: escreva a sua dúvida ou mande um
            print.
          </Dica>
        ))}

      {fase === 'aguardando' && microfone && (
        <IndicadorDoMicrofone microfone={microfone} mudo={mudo} />
      )}
    </div>
  );
}
