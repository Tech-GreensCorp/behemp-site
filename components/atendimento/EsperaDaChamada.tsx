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
 *
 * As peças (orbe, textos, dica, indicador do microfone) são exportadas com `tom`: a teleconsulta
 * as usa no fundo escuro dela (ADR-0029 D-30), no mesmo padrão do `<Consentimento tom="escuro">`.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Headphones, MessageCircle, MonitorUp, User } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { PapelNaChamada } from '@/lib/atendimento/canal';
import {
  alturasDasBarras,
  BARRA_PARADA,
  formatarTempoNaSala,
  type FaseDeEspera,
} from '@/lib/atendimento/espera';

/** O fundo: o creme do atendimento, ou o escuro da teleconsulta (D-30). */
export type Tom = 'claro' | 'escuro';

interface Props {
  papel: PapelNaChamada | null;
  fase: FaseDeEspera;
  /** A faixa do microfone desta tela; `null` sem microfone, e aí o indicador não aparece. */
  microfone: MediaStreamTrack | null;
  mudo: boolean;
}

/** "Você · microfone ligado": quatro barras, cada uma uma faixa da voz, medidas neste aparelho. */
export function IndicadorDoMicrofone({
  microfone,
  mudo,
  tom = 'claro',
  noFluxo = false,
}: {
  microfone: MediaStreamTrack;
  mudo: boolean;
  tom?: Tom;
  /** No fluxo, centrado, em vez do canto: na teleconsulta o canto é da própria câmera. */
  noFluxo?: boolean;
}) {
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
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border py-1.5 pr-3 pl-2.5 text-xs backdrop-blur-[8px]',
        noFluxo ? 'espera-rise espera-d3' : 'absolute bottom-4 left-4',
        tom === 'escuro'
          ? 'border-slate-700 bg-slate-900/80 text-slate-200'
          : 'border-[#E7E1D8] bg-white/[0.82] text-[#3B342D]',
      )}
    >
      <span className={cn('espera-eq', tom === 'escuro' && 'espera-eq-escuro')} aria-hidden="true">
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
    <OrbeDaEspera icone={papel === 'paciente' ? Headphones : papel === 'admin' ? User : null} />
  );
}

/** A orbe, com o ícone de quem se espera (ou nenhum, enquanto não se sabe). */
export function OrbeDaEspera({ icone: Icone }: { icone: typeof User | null }) {
  return (
    <div className="espera-orb size-[72px] md:size-24">
      <div className="espera-halo" />
      <div className="espera-ring" />
      <div className="espera-ring espera-r2" />
      <div className="espera-ring espera-r3" />
      <div className="espera-arc" />
      <div className="espera-face">
        {Icone && <Icone className={ICONE} color="#EA5429" strokeWidth={1.6} aria-hidden="true" />}
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
    <div className="flex shrink-0 flex-col items-center gap-2.5">
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

/**
 * Você e o outro lado, lado a lado. Em `conectando` o trilho é pontilhado; em `conectado`, sem vídeo
 * do outro lado, ele fica contínuo, e os pontos continuam indo e vindo: a voz passando (Davi,
 * 01/10/2026). O trilho encolhe em janela estreita, para os dois rostos não saírem do palco.
 */
function OsDois({ admin, ligados }: { admin: boolean; ligados: boolean }) {
  return (
    <div className="espera-rise flex w-full max-w-[348px] items-center justify-center gap-[22px]">
      <Pessoa
        rotulo="Você"
        icone={admin ? Headphones : User}
        cor="#2D4F3C"
        sombra="rgba(45,79,60,.10)"
      />
      <div className={cn('espera-track mb-[26px] w-40 min-w-8 shrink', ligados && 'espera-ligado')}>
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
  );
}

/**
 * O palco. A altura é a do canvas (16:9 na tela larga, 300 px no celular), mas CRESCE com o conteúdo
 * quando a janela fica estreita: `overflow-clip`, e não `overflow-hidden`, porque só um contêiner de
 * rolagem perde o tamanho mínimo pelo conteúdo; e `md:min-h-auto`, porque um mínimo explícito
 * substitui o automático, e a altura ficava presa nos 16:9 (medido no Chromium, 01/10/2026). O espaço de cima e de baixo é o do contador e do
 * indicador do microfone, que ficam por cima, em `absolute`. Antes, numa janela de ~820 px, a orbe
 * saía cortada e a dica ficava por baixo do microfone (medido por Davi, 01/10/2026).
 */
const PALCO =
  'espera-palco relative box-border flex min-h-[300px] flex-col items-center justify-center gap-[22px] overflow-clip px-5 py-[52px] md:aspect-video md:min-h-auto md:gap-[26px] md:px-6 md:py-[60px]';

export function Textos({
  titulo,
  children,
  tom = 'claro',
}: {
  titulo: string;
  children?: ReactNode;
  tom?: Tom;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-1.5 text-center md:gap-2"
    >
      <p
        className={cn(
          'espera-rise espera-d1 font-heading m-0 text-center! text-lg font-semibold md:text-[21px] md:tracking-[-0.01em]',
          tom === 'escuro' ? 'text-white' : 'text-foreground',
        )}
      >
        {titulo}
      </p>
      {children && (
        <p
          className={cn(
            'espera-rise espera-d2 m-0 text-center! text-[13px] leading-[1.45] md:max-w-[420px] md:text-sm md:leading-normal',
            tom === 'escuro' ? 'text-slate-400' : 'text-[#6B6259]',
          )}
        >
          {children}
        </p>
      )}
    </div>
  );
}

/**
 * Conectado, e o outro lado sem câmera e sem tela: o quadro "os dois, ligados" (ADR-0029 D-29). O
 * texto vem da tela da chamada, que é quem sabe quem é o outro.
 */
export function ChamadaSemVideo({
  papel,
  titulo,
  detalhe,
}: {
  papel: PapelNaChamada | null;
  titulo: string;
  detalhe: string;
}) {
  return (
    <div className={PALCO}>
      <OsDois admin={papel === 'admin'} ligados />
      <Textos titulo={titulo}>{detalhe}</Textos>
    </div>
  );
}

export function Dica({
  icone: Icone,
  children,
  tom = 'claro',
  tambemNoCelular = false,
}: {
  icone: typeof User;
  children: string;
  tom?: Tom;
  /** No atendimento, não: no celular o chat fica ACIMA, e não "ao lado". */
  tambemNoCelular?: boolean;
}) {
  return (
    <p
      className={cn(
        'espera-late m-0 max-w-[440px] items-start gap-2 rounded-[12px] border px-3.5 py-2.5 text-left text-[12.5px] leading-[1.45]',
        tambemNoCelular ? 'inline-flex' : 'hidden md:inline-flex',
        tom === 'escuro'
          ? 'border-slate-700 bg-slate-800/60 text-slate-300'
          : 'border-[#E7E1D8] bg-white/70 text-[#4A423A]',
      )}
    >
      <Icone
        size={15}
        color={tom === 'escuro' ? '#64748B' : '#8A7F73'}
        strokeWidth={1.75}
        className="shrink-0"
        aria-hidden="true"
      />
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
    <div className={PALCO}>
      {fase === 'aguardando' && <TempoNaSala />}

      {fase === 'conectando' ? <OsDois admin={admin} ligados={false} /> : <Orbe papel={papel} />}

      {fase !== 'entrando' && (
        <Textos titulo={titulo}>
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
                Assim que alguém da equipe entrar, a chamada começa sozinha. Não precisa recarregar
                a página.
              </span>
            </>
          )}
        </Textos>
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
