'use client';

/**
 * A tela da chamada de atendimento com suporte — ADR-0029 §10 (D-12 a D-19; `DO-74`).
 *
 * Paciente e admin usam a MESMA tela, com o papel vindo do servidor (`entrarNoAtendimento`):
 *   · a voz vai e volta;
 *   · o paciente mostra a tela quando o navegador deixa (computador); no celular o botão não
 *     existe, e o chat com print é o caminho (D-16);
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
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { entrarNoAtendimento, encerrarAtendimento } from '@/app/_actions/chamada-de-atendimento';
import { canalDoAtendimento, type PapelNaChamada } from '@/lib/atendimento/canal';
import {
  aceitarResposta,
  criarFilaDeCandidatos,
  criarOfertaDoAdmin,
  podeCompartilharTela,
  responderComoPaciente,
  trocarTela,
} from '@/lib/atendimento/negociacao';
import { getPusherClient } from '@/lib/integrations/pusher/client';

import { ChatDoAtendimento, type MensagemDoChat } from './ChatDoAtendimento';

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

export function ChamadaDeAtendimento({ pedidoId, voltarPara }: Props) {
  const [fase, setFase] = useState<Fase>('entrando');
  const [erro, setErro] = useState<string | null>(null);
  const [papel, setPapel] = useState<PapelNaChamada | null>(null);
  const [sala, setSala] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemDoChat[]>([]);
  const [semMicrofone, setSemMicrofone] = useState(false);
  const [temMicrofone, setTemMicrofone] = useState(false);
  const [mudo, setMudo] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [avisoDeTela, setAvisoDeTela] = useState(false);
  const [podeMostrarTela, setPodeMostrarTela] = useState(false);
  const [repetida, setRepetida] = useState(false);

  const pc = useRef<RTCPeerConnection | null>(null);
  const fila = useRef<ReturnType<typeof criarFilaDeCandidatos> | null>(null);
  const microfone = useRef<MediaStreamTrack | null>(null);
  const faixaDeTela = useRef<MediaStreamTrack | null>(null);
  const ice = useRef<ConfigIce | null>(null);
  const canal = useRef<Channel | null>(null);
  const audioRemoto = useRef<HTMLAudioElement>(null);
  const telaRemota = useRef<HTMLVideoElement>(null);

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

    const sinalizar = (tipo: string, payload: object) =>
      fetch('/api/atendimento/sinalizar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sala: salaAtual,
          tipo,
          payload,
          socketId: getPusherClient().connection.socket_id,
        }),
      }).catch(() => {});

    const fecharConexao = () => {
      pc.current?.close();
      pc.current = null;
      fila.current = null;
      faixaDeTela.current?.stop();
      faixaDeTela.current = null;
      if (ativo) setCompartilhando(false);
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
        const fluxo = e.streams[0] ?? new MediaStream([e.track]);
        if (e.track.kind === 'audio' && audioRemoto.current) audioRemoto.current.srcObject = fluxo;
        if (e.track.kind === 'video' && telaRemota.current)
          telaRemota.current.srcObject = new MediaStream([e.track]);
      };
      conexao.onconnectionstatechange = () => {
        if (!ativo) return;
        if (conexao.connectionState === 'connected') setFase('conectado');
        if (conexao.connectionState === 'failed') {
          setFase('aguardando');
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
      const oferta = await criarOfertaDoAdmin(conexao, microfone.current);
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
      setPodeMostrarTela(r.dados.papel === 'paciente' && podeCompartilharTela());

      try {
        const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
        // A pessoa saiu durante o pedido de permissão: o microfone não pode ficar aceso.
        if (!ativo) {
          fluxo.getTracks().forEach((t) => t.stop());
          return;
        }
        microfone.current = fluxo.getAudioTracks()[0] ?? null;
        setTemMicrofone(microfone.current !== null);
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
          );
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
      ch.bind('chat:mensagem', (m: MensagemDoChat) => {
        if (ativo) acrescentar(m);
      });
      ch.bind('chamada:encerrada', () => {
        if (!ativo) return;
        fecharConexao();
        microfone.current?.stop();
        setTemMicrofone(false);
        setFase('encerrada');
      });
    })();

    return () => {
      ativo = false;
      fecharConexao();
      microfone.current?.stop();
      microfone.current = null;
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

  const mostrarTela = async () => {
    setAvisoDeTela(false);
    if (!pc.current) {
      toast.error('Espere a equipe entrar na chamada para mostrar a tela.');
      return;
    }
    try {
      const fluxo = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const faixa = fluxo.getVideoTracks()[0];
      if (!faixa) return;
      const trocou = await trocarTela(pc.current, faixa);
      if (!trocou) {
        faixa.stop();
        toast.error('Não foi possível mostrar a tela nesta chamada. Mande um print pelo chat.');
        return;
      }
      faixaDeTela.current = faixa;
      setCompartilhando(true);
      // Parar pelo botão do próprio navegador também para o compartilhamento aqui.
      faixa.onended = () => void pararTela();
    } catch {
      // Cancelar a escolha da tela não é erro: a pessoa desistiu.
    }
  };

  const pararTela = async () => {
    if (pc.current) await trocarTela(pc.current, null);
    faixaDeTela.current?.stop();
    faixaDeTela.current = null;
    setCompartilhando(false);
  };

  const encerrar = async () => {
    if (!sala) return;
    const r = await encerrarAtendimento({ sala }).catch(() => null);
    if (r?.sucesso) {
      pc.current?.close();
      pc.current = null;
      microfone.current?.stop();
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
    conectando: 'Conectando a chamada…',
    conectado: 'Chamada em andamento',
    encerrada: 'Atendimento encerrado',
  };

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
          <div className="flex items-center gap-2" role="status">
            {(fase === 'entrando' || fase === 'conectando') && (
              <Loader2 className="text-primary h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            <p className="text-foreground text-sm font-semibold">{estado[fase]}</p>
          </div>
          <Link
            href={voltarPara}
            className="text-muted-foreground inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
        </div>

        {papel === 'admin' && (
          <div className="border-border overflow-hidden rounded-2xl border bg-black">
            <video
              ref={telaRemota}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full object-contain"
              aria-label="Tela compartilhada pelo paciente"
            />
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

        {avisoDeTela && (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">Antes de mostrar a sua tela</p>
            <p className="text-xs leading-relaxed text-amber-700">
              A equipe vai ver o que aparece na sua tela enquanto você compartilhar. Não mostre
              senhas. Nada é gravado: nem a voz, nem a tela.
            </p>
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
