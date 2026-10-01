'use client';

/**
 * A tela da chamada de atendimento com suporte — ADR-0029 §10 (D-12 a D-19; `DO-74`).
 *
 * Paciente e admin usam a MESMA tela, com o papel vindo do servidor (`entrarNoAtendimento`):
 *   · a voz vai e volta;
 *   · os DOIS ligam e desligam a própria câmera (D-21; a câmera começa desligada);
 *   · os DOIS mostram a tela quando o navegador deixa (computador); no celular o botão não
 *     existe, e o chat com print é o caminho (D-16, D-22);
 *   · o chat fica à ESQUERDA na tela larga, e primeiro na estreita (D-17);
 *   · nada é gravado: não há `MediaRecorder` aqui (D-19).
 *
 * A negociação é `lib/atendimento/negociacao.ts`, provada no Chromium com dois pares reais: o admin
 * oferece, o paciente responde, e mostrar a tela troca a faixa sem renegociar.
 */
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Channel, Members, PresenceChannel } from 'pusher-js';
import {
  ArrowLeft,
  Loader2,
  Maximize,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  ShieldCheck,
  Video,
  VideoOff,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { entrarNoAtendimento, encerrarAtendimento } from '@/app/_actions/chamada-de-atendimento';
import { canalDoAtendimento, type PapelNaChamada } from '@/lib/atendimento/canal';
import { escolherDestaque } from '@/lib/atendimento/destaque';
import { oQueOPalcoMostra } from '@/lib/atendimento/espera';
import {
  aceitarResposta,
  criarFilaDeCandidatos,
  criarOfertaDoAdmin,
  faixaDoTransceptor,
  podeCompartilharTela,
  responderComoPaciente,
  trocarCamera,
  trocarTela,
} from '@/lib/atendimento/negociacao';
import { getPusherClient } from '@/lib/integrations/pusher/client';

import { ChatDoAtendimento, type MensagemDoChat } from './ChatDoAtendimento';
import { EsperaDaChamada } from './EsperaDaChamada';

type Fase = 'entrando' | 'aguardando' | 'conectando' | 'conectado' | 'encerrada' | 'erro';

interface Props {
  pedidoId: string;
  /** Para onde "Voltar" leva: a tela da ANVISA do paciente, ou a do admin. */
  voltarPara: string;
}

interface ConfigIce {
  iceServers: RTCIceServer[];
  turnDisponivel: boolean;
}

/** O que cada lado está mandando agora. Vai pela sinalização: a faixa vazia não diz isso sozinha. */
interface EstadoDaMidia {
  camera: boolean;
  tela: boolean;
}

const sinalizarNaSala = (sala: string | null, tipo: string, payload: object) =>
  fetch('/api/atendimento/sinalizar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sala,
      tipo,
      payload,
      socketId: getPusherClient().connection.socket_id,
    }),
  }).catch(() => {});

/**
 * O que dizer quando a câmera não abre, pelo nome do erro do navegador (`getUserMedia`, MDN). Medido
 * por Davi em 30/09/2026: com a MESMA câmera nas duas janelas, a segunda não abre, ou uma trava. A
 * câmera atende um programa por vez, e a tela tem de dizer isso em vez de um "não conseguimos".
 */
function motivoDaCamera(erro: unknown): string {
  const nome = erro instanceof DOMException ? erro.name : '';
  if (nome === 'NotAllowedError')
    return 'O navegador não deu permissão para a câmera. Libere no cadeado ao lado do endereço.';
  if (nome === 'NotReadableError' || nome === 'AbortError')
    return 'A câmera está em uso por outro programa ou outra janela. Feche o outro uso e tente de novo.';
  if (nome === 'NotFoundError' || nome === 'OverconstrainedError')
    return 'Não encontramos uma câmera neste aparelho.';
  return 'Não conseguimos usar a sua câmera.';
}

/**
 * Um `<video>` para um fluxo. O `srcObject` é posto num efeito porque o elemento pode remontar
 * (a câmera do outro lado passa do destaque para a miniatura quando ele começa a mostrar a tela).
 * Sem áudio: a voz vai pelo `<audio>` da chamada.
 */
function VideoDoFluxo({
  fluxo,
  rotulo,
  espelhar = false,
  className,
}: {
  fluxo: MediaStream;
  rotulo: string;
  espelhar?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = fluxo;
  }, [fluxo]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      aria-label={rotulo}
      className={cn('bg-black object-contain', espelhar && '-scale-x-100', className)}
    />
  );
}

export function ChamadaDeAtendimento({ pedidoId, voltarPara }: Props) {
  const [fase, setFase] = useState<Fase>('entrando');
  const [erro, setErro] = useState<string | null>(null);
  const [papel, setPapel] = useState<PapelNaChamada | null>(null);
  const [sala, setSala] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemDoChat[]>([]);
  const [semMicrofone, setSemMicrofone] = useState(false);
  const [temMicrofone, setTemMicrofone] = useState(false);
  /** A mesma faixa de `microfone`, em estado: a espera mede o nível dela (D-28). */
  const [faixaDoMicrofone, setFaixaDoMicrofone] = useState<MediaStreamTrack | null>(null);
  const [mudo, setMudo] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [cameraLocal, setCameraLocal] = useState<MediaStream | null>(null);
  const [ligandoCamera, setLigandoCamera] = useState(false);
  const [midiaRemota, setMidiaRemota] = useState<EstadoDaMidia>({ camera: false, tela: false });
  const [cameraRemota, setCameraRemota] = useState<MediaStream | null>(null);
  /** Com câmera E tela do outro lado, qual fica grande. Clicar na miniatura troca (D-25). */
  const [destaquePreferido, setDestaquePreferido] = useState<'tela' | 'camera'>('tela');
  const [telaRemota, setTelaRemota] = useState<MediaStream | null>(null);
  const [avisoDeTela, setAvisoDeTela] = useState(false);
  const [podeMostrarTela, setPodeMostrarTela] = useState(false);
  const [repetida, setRepetida] = useState(false);

  const pc = useRef<RTCPeerConnection | null>(null);
  const fila = useRef<ReturnType<typeof criarFilaDeCandidatos> | null>(null);
  const microfone = useRef<MediaStreamTrack | null>(null);
  const faixaDeTela = useRef<MediaStreamTrack | null>(null);
  const camera = useRef<MediaStreamTrack | null>(null);
  /**
   * A chamada ainda está viva nesta tela? Falso depois de sair, encerrar ou o pedido encerrar. A
   * permissão de câmera e o seletor de tela esperam o clique da pessoa, e o que chegar depois disso
   * não pode ficar aceso (revisão de 30/09/2026).
   */
  const viva = useRef(false);
  /** Os avisos de `midia` saem um de cada vez, e cada um lê o estado na hora de sair. */
  const filaDeAvisos = useRef<Promise<unknown>>(Promise.resolve());
  const ice = useRef<ConfigIce | null>(null);
  const canal = useRef<Channel | null>(null);
  const audioRemoto = useRef<HTMLAudioElement>(null);
  const palco = useRef<HTMLDivElement>(null);

  const acrescentar = useCallback((m: MensagemDoChat) => {
    setMensagens((atual) => (atual.some((x) => x.id === m.id) ? atual : [...atual, m]));
  }, []);

  useEffect(() => {
    let ativo = true;
    let salaAtual: string | null = null;
    let papelAtual: PapelNaChamada | null = null;
    /**
     * Revisão de 30/09/2026. `negociacao`: o id da oferta em curso — resposta e candidato de outra
     * negociação são ignorados, e duas ofertas não se atropelam. `repetida`: esta aba chegou quando
     * já havia outra do MESMO papel (outra aba, ou outro admin); ela fica só com as mensagens e não
     * disputa a voz, que é o que derrubava a primeira em silêncio.
     */
    let negociacao: string | null = null;
    let repetida = false;
    viva.current = true;

    const sinalizar = (tipo: string, payload: object) => sinalizarNaSala(salaAtual, tipo, payload);

    const fecharConexao = () => {
      pc.current?.close();
      pc.current = null;
      fila.current = null;
      faixaDeTela.current?.stop();
      faixaDeTela.current = null;
      if (ativo) {
        setCompartilhando(false);
        // O outro lado reenvia o que está mandando quando a nova conexão se completa.
        setMidiaRemota({ camera: false, tela: false });
      }
    };

    const novaConexao = () => {
      fecharConexao();
      const conexao = new RTCPeerConnection({ iceServers: ice.current?.iceServers ?? [] });
      pc.current = conexao;
      fila.current = criarFilaDeCandidatos(conexao);
      const idDaConexao = negociacao;
      conexao.onicecandidate = (e) => {
        if (e.candidate)
          void sinalizar('ice-candidate', {
            candidato: e.candidate.toJSON(),
            negociacao: idDaConexao,
          });
      };
      conexao.ontrack = (e) => {
        const qual = faixaDoTransceptor(conexao, e.transceiver);
        if (qual === 'audio' && audioRemoto.current)
          audioRemoto.current.srcObject = e.streams[0] ?? new MediaStream([e.track]);
        if (!ativo) return;
        if (qual === 'camera') setCameraRemota(new MediaStream([e.track]));
        if (qual === 'tela') setTelaRemota(new MediaStream([e.track]));
      };
      conexao.onconnectionstatechange = () => {
        if (!ativo) return;
        if (conexao.connectionState === 'connected') {
          setFase('conectado');
          filaDeAvisos.current = filaDeAvisos.current.then(() =>
            sinalizar('midia', {
              camera: camera.current !== null,
              tela: faixaDeTela.current !== null,
            }),
          );
        }
        if (conexao.connectionState === 'failed') {
          setFase('aguardando');
          // Sem conexão, o destaque não congela no último quadro.
          setMidiaRemota({ camera: false, tela: false });
          toast.error('A conexão caiu. Assim que a outra pessoa voltar, ela se refaz.');
        }
      };
      return conexao;
    };

    const oferecer = async () => {
      if (repetida) return;
      negociacao = crypto.randomUUID();
      const conexao = novaConexao();
      if (ativo) setFase('conectando');
      const oferta = await criarOfertaDoAdmin(conexao, microfone.current, camera.current);
      await sinalizar('offer', { ...oferta, negociacao });
    };

    const outraPessoaPresente = (membros: Members) => {
      let presente = false;
      membros.each((m: { info?: { papel?: string } }) => {
        if (m.info?.papel && m.info.papel !== papelAtual) presente = true;
      });
      return presente;
    };

    (async () => {
      const r = await entrarNoAtendimento({ pedidoId }).catch(() => null);
      if (!ativo) return;
      if (!r?.sucesso || !r.dados) {
        setErro(r?.erro ?? 'Não foi possível entrar no atendimento.');
        setFase('erro');
        return;
      }
      salaAtual = r.dados.sala;
      papelAtual = r.dados.papel;
      setSala(r.dados.sala);
      setPapel(r.dados.papel);
      setMensagens(r.dados.mensagens);
      setPodeMostrarTela(podeCompartilharTela());

      try {
        const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
        // A pessoa saiu durante o pedido de permissão: o microfone não pode ficar aceso.
        if (!ativo) {
          fluxo.getTracks().forEach((t) => t.stop());
          return;
        }
        microfone.current = fluxo.getAudioTracks()[0] ?? null;
        setTemMicrofone(microfone.current !== null);
        setFaixaDoMicrofone(microfone.current);
      } catch {
        // Sem microfone, o chat continua valendo: o atendimento não para por isso.
        if (ativo) setSemMicrofone(true);
      }

      ice.current = await fetch(`/api/atendimento/ice-servers?sala=${r.dados.sala}`, {
        cache: 'no-store',
      })
        .then((x) => (x.ok ? (x.json() as Promise<ConfigIce>) : null))
        .catch(() => null);
      if (ativo && ice.current && !ice.current.turnDisponivel) {
        toast.warning(
          'Sem servidor de retransmissão: se a conexão direta falhar, a voz pode não completar.',
        );
      }
      if (!ativo) return;

      const pusher = getPusherClient();
      const ch = pusher.subscribe(canalDoAtendimento(r.dados.sala)) as PresenceChannel;
      canal.current = ch;

      ch.bind('pusher:subscription_error', () => {
        if (!ativo) return;
        setErro('Não foi possível entrar no atendimento. Ele pode ter sido encerrado.');
        setFase('erro');
      });
      ch.bind('pusher:subscription_succeeded', (membros: Members) => {
        if (!ativo) return;
        membros.each((m: { id: string; info?: { papel?: string } }) => {
          if (m.id !== membros.me?.id && m.info?.papel === papelAtual) repetida = true;
        });
        if (repetida) {
          setRepetida(true);
          setFase('aguardando');
          return;
        }
        const presente = outraPessoaPresente(membros);
        setFase(presente ? 'conectando' : 'aguardando');
        if (presente && papelAtual === 'admin') void oferecer();
      });
      ch.bind('pusher:member_added', (m: { info?: { papel?: string } }) => {
        // Outra aba do meu papel chegou: é ela quem se percebe repetida, não eu.
        if (!ativo || repetida || m.info?.papel === papelAtual) return;
        if (papelAtual === 'admin') void oferecer();
        else setFase('conectando');
      });
      ch.bind('pusher:member_removed', (m: { info?: { papel?: string } }) => {
        if (!ativo || repetida || m.info?.papel === papelAtual) return;
        // Saiu UMA aba do outro lado; se ainda há outra, a chamada segue com ela.
        if (outraPessoaPresente(ch.members)) return;
        fecharConexao();
        setFase('aguardando');
      });
      ch.bind(
        'webrtc:offer',
        async (dados: RTCSessionDescriptionInit & { negociacao?: string }) => {
          if (!ativo || repetida || papelAtual !== 'paciente' || !dados.negociacao) return;
          negociacao = dados.negociacao;
          const conexao = novaConexao();
          const resposta = await responderComoPaciente(
            conexao,
            { type: dados.type, sdp: dados.sdp },
            microfone.current,
            camera.current,
          );
          // A câmera pode ter sido ligada enquanto a resposta se montava: ela entra agora.
          if (camera.current) await trocarCamera(conexao, camera.current).catch(() => false);
          await fila.current?.esvaziar();
          await sinalizar('answer', { ...resposta, negociacao });
        },
      );
      ch.bind(
        'webrtc:answer',
        async (dados: RTCSessionDescriptionInit & { negociacao?: string }) => {
          if (!ativo || repetida || papelAtual !== 'admin' || !pc.current) return;
          // Resposta de outra negociação, ou chegando fora de hora, é ignorada — não derruba nada.
          if (dados.negociacao !== negociacao || pc.current.signalingState !== 'have-local-offer')
            return;
          try {
            await aceitarResposta(pc.current, { type: dados.type, sdp: dados.sdp });
            await fila.current?.esvaziar();
          } catch {
            toast.error('A conexão não se completou. Ela se refaz quando o paciente voltar.');
          }
        },
      );
      ch.bind(
        'webrtc:ice-candidate',
        (dados: { candidato?: RTCIceCandidateInit; negociacao?: string }) => {
          if (!ativo || repetida || !dados.candidato || dados.negociacao !== negociacao) return;
          void fila.current?.receber(dados.candidato);
        },
      );
      ch.bind('webrtc:midia', (dados: Partial<EstadoDaMidia>) => {
        if (!ativo || repetida) return;
        setMidiaRemota({ camera: dados.camera === true, tela: dados.tela === true });
      });
      ch.bind('chat:mensagem', (m: MensagemDoChat) => {
        if (ativo) acrescentar(m);
      });
      ch.bind('chamada:encerrada', () => {
        if (!ativo) return;
        viva.current = false;
        fecharConexao();
        microfone.current?.stop();
        camera.current?.stop();
        camera.current = null;
        setCameraLocal(null);
        setTemMicrofone(false);
        setFase('encerrada');
      });
    })();

    return () => {
      ativo = false;
      viva.current = false;
      fecharConexao();
      microfone.current?.stop();
      microfone.current = null;
      camera.current?.stop();
      camera.current = null;
      if (canal.current && salaAtual) {
        canal.current.unbind_all();
        getPusherClient().unsubscribe(canalDoAtendimento(salaAtual));
      }
      canal.current = null;
    };
  }, [pedidoId, acrescentar]);

  const alternarMudo = () => {
    if (!microfone.current) return;
    microfone.current.enabled = mudo;
    setMudo(!mudo);
  };

  /** Diz ao outro lado o que este está mandando, para ele mostrar o vídeo ou o aviso certo. */
  const avisarMidia = () => {
    filaDeAvisos.current = filaDeAvisos.current.then(() =>
      sinalizarNaSala(sala, 'midia', {
        camera: camera.current !== null,
        tela: faixaDeTela.current !== null,
      }),
    );
  };

  const ligarCamera = async () => {
    setLigandoCamera(true);
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({
        // Resolução contida: sem servidor de retransmissão, a banda é a da conexão direta.
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 360 } },
        audio: false,
      });
      const faixa = fluxo.getVideoTracks()[0];
      if (!faixa) return;
      // Saiu, ou a chamada encerrou, durante o pedido de permissão: a câmera não pode ficar acesa.
      if (!viva.current) {
        fluxo.getTracks().forEach((t) => t.stop());
        return;
      }
      // ANTES de qualquer espera: uma oferta ou resposta em curso a leva junto.
      camera.current = faixa;
      setCameraLocal(new MediaStream([faixa]));
      if (pc.current) await trocarCamera(pc.current, faixa).catch(() => false);
      avisarMidia();
    } catch (erro) {
      toast.error(`${motivoDaCamera(erro)} A voz e as mensagens continuam.`);
    } finally {
      setLigandoCamera(false);
    }
  };

  const desligarCamera = async () => {
    // `stop`, e não só `enabled = false`: é o que apaga a luz da câmera. E vem ANTES da troca,
    // para uma troca que falhe não deixar a luz acesa.
    camera.current?.stop();
    camera.current = null;
    setCameraLocal(null);
    if (pc.current) await trocarCamera(pc.current, null).catch(() => false);
    avisarMidia();
  };

  const mostrarTela = async () => {
    setAvisoDeTela(false);
    if (!pc.current) {
      toast.error(
        papel === 'admin'
          ? 'Espere o paciente entrar na chamada para mostrar a tela.'
          : 'Espere a equipe entrar na chamada para mostrar a tela.',
      );
      return;
    }
    try {
      const fluxo = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const faixa = fluxo.getVideoTracks()[0];
      if (!faixa) return;
      // A conexão pode ter caído (ou a chamada encerrado) enquanto a pessoa escolhia a tela.
      const conexao = viva.current ? pc.current : null;
      const trocou = conexao ? await trocarTela(conexao, faixa).catch(() => false) : false;
      if (!trocou) {
        faixa.stop();
        if (viva.current)
          toast.error('Não foi possível mostrar a tela agora. Tente de novo, ou mande um print.');
        return;
      }
      faixaDeTela.current = faixa;
      setCompartilhando(true);
      avisarMidia();
      // Parar pelo botão do próprio navegador também para o compartilhamento aqui.
      faixa.onended = () => void pararTela();
    } catch {
      // Cancelar a escolha da tela não é erro: a pessoa desistiu.
    }
  };

  const pararTela = async () => {
    faixaDeTela.current?.stop();
    faixaDeTela.current = null;
    setCompartilhando(false);
    if (pc.current) await trocarTela(pc.current, null).catch(() => false);
    avisarMidia();
  };

  /** D-26: tela cheia no vídeo em destaque. O vídeo sozinho, para o navegador o encaixar na tela. */
  const telaCheia = () => {
    const video = palco.current?.querySelector('video') as
      | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
      | null
      | undefined;
    if (!video) return;
    if (video.requestFullscreen) void video.requestFullscreen().catch(() => {});
    // Safari do iPhone não tem `requestFullscreen` em vídeo, só o próprio dele.
    else video.webkitEnterFullscreen?.();
  };

  const encerrar = async () => {
    if (!sala) return;
    const r = await encerrarAtendimento({ sala }).catch(() => null);
    if (r?.sucesso) {
      viva.current = false;
      pc.current?.close();
      pc.current = null;
      microfone.current?.stop();
      camera.current?.stop();
      camera.current = null;
      setCameraLocal(null);
      // Quem encerra pode estar mostrando a tela: a captura para junto, não fica aberta.
      faixaDeTela.current?.stop();
      faixaDeTela.current = null;
      setCompartilhando(false);
      setTemMicrofone(false);
      setFase('encerrada');
    } else toast.error(r?.erro ?? 'Não foi possível encerrar agora.');
  };

  if (fase === 'erro') {
    return (
      <div role="alert" className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-semibold text-red-700">{erro}</p>
        <Link
          href={voltarPara}
          className="text-primary inline-flex items-center gap-1.5 text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>
    );
  }

  const estado: Record<Exclude<Fase, 'erro'>, string> = {
    entrando: 'Entrando no atendimento…',
    aguardando: papel === 'admin' ? 'Aguardando o paciente entrar' : 'Aguardando a equipe entrar',
    conectando: 'Conectando a chamada',
    conectado: 'Chamada em andamento',
    encerrada: 'Atendimento encerrado',
  };

  const outro = papel === 'admin' ? 'O paciente' : 'A equipe';
  // O destaque é a tela do outro lado, se ele está mostrando; senão, a câmera dele. Com as duas, a
  // outra vai para a miniatura, e clicar nela troca (D-25).
  const remotos = {
    tela:
      midiaRemota.tela && telaRemota
        ? { fluxo: telaRemota, rotulo: `Tela mostrada por ${outro.toLowerCase()}`, nome: 'a tela' }
        : null,
    camera:
      midiaRemota.camera && cameraRemota
        ? { fluxo: cameraRemota, rotulo: `Câmera de ${outro.toLowerCase()}`, nome: 'a câmera' }
        : null,
  };
  const {
    destaque,
    miniatura: miniaturaRemota,
    aoClicarNaMiniatura,
  } = escolherDestaque(remotos, destaquePreferido);
  // D-28: antes de conectar, o outro lado ainda não chegou, e o palco é a espera.
  const noPalco = oQueOPalcoMostra(fase, destaque !== null);

  return (
    <div className="grid gap-4 md:grid-cols-[20rem_1fr]">
      {/* D-17: o chat à esquerda na tela larga, e primeiro na estreita. */}
      <div className="md:order-first">
        {sala && papel ? (
          <ChatDoAtendimento
            sala={sala}
            papel={papel}
            mensagens={mensagens}
            encerrada={fase === 'encerrada'}
            onEnviada={acrescentar}
          />
        ) : (
          <div className="border-border flex h-full min-h-[24rem] items-center justify-center rounded-2xl border bg-white">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="border-border flex items-center justify-between gap-3 rounded-2xl border bg-white p-4">
          <div className="flex items-center gap-2.5" role="status">
            {fase === 'entrando' && (
              <Loader2 className="text-primary h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {fase === 'aguardando' && <span className="espera-ping" aria-hidden="true" />}
            <p className="text-foreground inline-flex items-center text-sm font-semibold">
              {estado[fase]}
              {fase === 'conectando' && (
                <span className="espera-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              )}
            </p>
          </div>
          <Link
            href={voltarPara}
            className="text-muted-foreground inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
        </div>

        {fase !== 'encerrada' && !repetida && (
          <div className="space-y-2">
            <div
              ref={palco}
              className="border-border espera-palco relative overflow-hidden rounded-2xl border"
            >
              {noPalco === 'espera' &&
                (fase === 'entrando' || fase === 'aguardando' || fase === 'conectando') && (
                  <EsperaDaChamada
                    key={fase}
                    papel={papel}
                    fase={fase}
                    microfone={semMicrofone ? null : faixaDoMicrofone}
                    mudo={mudo}
                  />
                )}
              {/* A passagem para conectado: ~200 ms de esmaecimento, por cima do fundo da espera. */}
              {noPalco === 'destaque' && destaque && (
                <div className="animate-in fade-in duration-200 motion-reduce:animate-none">
                  <VideoDoFluxo
                    fluxo={destaque.fluxo}
                    rotulo={destaque.rotulo}
                    className="aspect-video w-full"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={telaCheia}
                    aria-label="Tela cheia"
                    className="absolute top-2 right-2 gap-1.5 bg-white/90"
                  >
                    <Maximize className="h-4 w-4" /> Tela cheia
                  </Button>
                </div>
              )}
              {noPalco === 'sem-camera' && (
                // Até 30/09/2026 isto era um quadro preto, que parecia câmera quebrada.
                <div className="bg-muted/40 animate-in fade-in flex aspect-video flex-col items-center justify-center gap-2 p-6 text-center duration-200 motion-reduce:animate-none">
                  <VideoOff className="text-muted-foreground h-6 w-6" aria-hidden="true" />
                  <p className="text-foreground text-sm font-medium">
                    {outro} está sem câmera e não está mostrando a tela.
                  </p>
                  <p className="text-muted-foreground text-xs">
                    A voz e as mensagens funcionam do mesmo jeito.
                  </p>
                </div>
              )}
            </div>
            {(miniaturaRemota || cameraLocal || compartilhando) && (
              <div className="flex flex-wrap items-end gap-2">
                {miniaturaRemota && (
                  <button
                    type="button"
                    onClick={() => setDestaquePreferido(aoClicarNaMiniatura)}
                    aria-label={`Pôr ${miniaturaRemota.nome} de ${outro.toLowerCase()} em destaque`}
                    className="w-36 cursor-pointer space-y-1 text-left"
                  >
                    <VideoDoFluxo
                      fluxo={miniaturaRemota.fluxo}
                      rotulo={miniaturaRemota.rotulo}
                      className="border-border aspect-video w-full rounded-lg border"
                    />
                    <span className="text-muted-foreground block text-xs">
                      {outro} · clique para trocar
                    </span>
                  </button>
                )}
                {cameraLocal && (
                  <figure className="w-36 space-y-1">
                    <VideoDoFluxo
                      fluxo={cameraLocal}
                      rotulo="A sua câmera"
                      espelhar
                      className="border-border aspect-video w-full rounded-lg border"
                    />
                    <figcaption className="text-muted-foreground text-xs">Você</figcaption>
                  </figure>
                )}
                {compartilhando && (
                  <p className="border-border bg-muted/40 text-muted-foreground flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs">
                    <MonitorUp className="h-3.5 w-3.5" aria-hidden="true" />
                    Você está mostrando a sua tela.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {/* A voz da outra pessoa. Sem `controls`: é a chamada, não um arquivo. */}
        <audio ref={audioRemoto} autoPlay />

        {repetida && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            {papel === 'admin'
              ? 'Outra pessoa da equipe (ou outra aba sua) já está neste atendimento. Por aqui você acompanha só as mensagens.'
              : 'Este atendimento já está aberto em outra aba. Por aqui você acompanha só as mensagens.'}
          </p>
        )}

        {semMicrofone && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            Não conseguimos usar o seu microfone. Você ainda pode conversar pelas mensagens.
          </p>
        )}

        {papel === 'paciente' && !podeMostrarTela && fase !== 'encerrada' && (
          <p className="border-border bg-muted/40 text-muted-foreground rounded-xl border p-3 text-xs">
            Neste aparelho não dá para mostrar a tela pela chamada. Mande um print pelas mensagens:
            a equipe vê na hora.
          </p>
        )}

        {/*
          D-22: o admin também mostra a tela. O risco muda de lado: a tela da equipe pode ter dado de
          OUTROS pacientes (a lista da ANVISA, o painel), e o paciente veria. O aviso diz isso.
        */}

        {avisoDeTela && (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">Antes de mostrar a sua tela</p>
            {papel === 'admin' ? (
              <p className="text-xs leading-relaxed text-amber-700">
                O paciente vai ver o que aparece na sua tela enquanto você compartilhar. Feche antes
                tudo que tiver dado de outros pacientes, e prefira mostrar só uma janela (no Chrome,
                a aba desta chamada não aparece na lista). Não mostre senhas. Nada é gravado: nem a
                voz, nem a tela.
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-amber-700">
                A equipe vai ver o que aparece na sua tela enquanto você compartilhar. No Chrome,
                escolha uma janela ou a tela inteira: a aba desta chamada não aparece na lista. Não
                mostre senhas. Nada é gravado: nem a voz, nem a tela.
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={mostrarTela} className="gap-1.5">
                <MonitorUp className="h-4 w-4" /> Entendi, mostrar a tela
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAvisoDeTela(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {fase !== 'encerrada' && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={alternarMudo}
              disabled={!temMicrofone}
              className="gap-1.5"
            >
              {mudo ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {mudo ? 'Ativar microfone' : 'Silenciar'}
            </Button>
            {cameraLocal ? (
              <Button variant="outline" size="sm" onClick={desligarCamera} className="gap-1.5">
                <VideoOff className="h-4 w-4" /> Desligar câmera
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={ligarCamera}
                disabled={repetida || ligandoCamera}
                className="gap-1.5"
              >
                {ligandoCamera ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Video className="h-4 w-4" />
                )}
                Ligar câmera
              </Button>
            )}
            {podeMostrarTela &&
              (compartilhando ? (
                <Button variant="outline" size="sm" onClick={pararTela} className="gap-1.5">
                  <MonitorX className="h-4 w-4" /> Parar de mostrar a tela
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setAvisoDeTela(true)}
                  disabled={fase !== 'conectado'}
                  className="gap-1.5"
                >
                  <MonitorUp className="h-4 w-4" /> Mostrar minha tela
                </Button>
              ))}
            {papel === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                onClick={encerrar}
                className="gap-1.5 text-red-700"
              >
                <PhoneOff className="h-4 w-4" /> Encerrar atendimento
              </Button>
            )}
          </div>
        )}

        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Nada nesta chamada é gravado. As mensagens ficam registradas no atendimento.
        </p>
      </div>
    </div>
  );
}
