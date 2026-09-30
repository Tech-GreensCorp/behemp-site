/**
 * A NEGOCIAÇÃO WebRTC DA CHAMADA DE ATENDIMENTO — ADR-0029 D-15 e D-16, revistas em D-21 e D-22.
 *
 * Só navegador; sem `db`, sem `auth`, sem `next/*`. Separado da tela de propósito: é este módulo que
 * o teste no Chromium executa com dois pares reais e mídia falsa, e a tela usa o mesmo, sem cópia.
 *
 * O desenho, para NÃO precisar renegociar quando alguém liga a câmera ou mostra a tela:
 *
 *   admin    oferta:   áudio sendrecv  +  vídeo "câmera" sendrecv  +  vídeo "tela" sendrecv
 *   paciente resposta: os mesmos três, sendrecv, vazios até a pessoa ligar
 *
 * Ligar a câmera ou mostrar a tela é `replaceTrack` no envio que já foi negociado — o mesmo mecanismo
 * que a teleconsulta usa para a tela do médico (`GlobalTeleconsultaHost.tsx:437`). Desligar é
 * `replaceTrack(null)`: o canal continua negociado e pode voltar a ser usado.
 *
 * ⚠️ Qual vídeo é a câmera e qual é a tela sai da ORDEM dos transceptores, e a ordem é da
 * especificação: `getTransceivers()` devolve na ordem de criação, e quem responde os cria na ordem
 * das linhas `m=` da oferta. O primeiro vídeo é a câmera, o segundo é a tela, nos dois lados. Até
 * 30/09/2026 havia um vídeo só (a tela do paciente), e o tipo de mídia bastava para achá-lo.
 */

/** O navegador deixa compartilhar a tela? No celular (Chrome Android, Safari iOS) não deixa. */
export function podeCompartilharTela(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function'
  );
}

export type Faixa = 'audio' | 'camera' | 'tela';

/** Os transceptores na ordem negociada: áudio, câmera, tela. Ver a nota do topo. */
function transceptores(pc: RTCPeerConnection) {
  const todos = pc.getTransceivers();
  const videos = todos.filter((t) => t.receiver.track.kind === 'video');
  return {
    audio: todos.find((t) => t.receiver.track.kind === 'audio'),
    camera: videos[0],
    tela: videos[1],
  };
}

/** O que uma faixa que CHEGA é: a voz, a câmera ou a tela do outro lado. */
export function faixaDoTransceptor(pc: RTCPeerConnection, t: RTCRtpTransceiver): Faixa | null {
  const { audio, camera, tela } = transceptores(pc);
  if (t === audio) return 'audio';
  if (t === camera) return 'camera';
  if (t === tela) return 'tela';
  return null;
}

/** Admin: monta a oferta com a voz dele, a câmera (se já ligada) e um canal de tela para cada lado. */
export async function criarOfertaDoAdmin(
  pc: RTCPeerConnection,
  microfone: MediaStreamTrack | null,
  camera: MediaStreamTrack | null = null,
): Promise<RTCSessionDescriptionInit> {
  pc.addTransceiver(microfone ?? 'audio', { direction: 'sendrecv' });
  pc.addTransceiver(camera ?? 'video', { direction: 'sendrecv' });
  pc.addTransceiver('video', { direction: 'sendrecv' });
  const oferta = await pc.createOffer();
  await pc.setLocalDescription(oferta);
  return { type: 'offer', sdp: pc.localDescription?.sdp };
}

/** Paciente: aceita a oferta, liga a voz (e a câmera, se já ligada) e deixa a tela pronta e vazia. */
export async function responderComoPaciente(
  pc: RTCPeerConnection,
  oferta: RTCSessionDescriptionInit,
  microfone: MediaStreamTrack | null,
  camera: MediaStreamTrack | null = null,
): Promise<RTCSessionDescriptionInit> {
  await pc.setRemoteDescription(oferta);
  const t = transceptores(pc);
  if (t.audio && microfone) await t.audio.sender.replaceTrack(microfone);
  if (t.camera && camera) await t.camera.sender.replaceTrack(camera);
  for (const x of [t.audio, t.camera, t.tela]) if (x) x.direction = 'sendrecv';
  const resposta = await pc.createAnswer();
  await pc.setLocalDescription(resposta);
  return { type: 'answer', sdp: pc.localDescription?.sdp };
}

/** Admin: recebe a resposta do paciente. */
export async function aceitarResposta(
  pc: RTCPeerConnection,
  resposta: RTCSessionDescriptionInit,
): Promise<void> {
  await pc.setRemoteDescription(resposta);
}

async function trocar(
  pc: RTCPeerConnection,
  qual: 'camera' | 'tela',
  faixa: MediaStreamTrack | null,
): Promise<boolean> {
  const t = transceptores(pc)[qual];
  if (!t) return false;
  await t.sender.replaceTrack(faixa);
  return true;
}

/**
 * Qualquer lado: começa (faixa) ou para (null) de mostrar a tela, SEM nova oferta.
 * Devolve `false` se não havia canal de tela negociado — a tela avisa em vez de fingir.
 */
export function trocarTela(pc: RTCPeerConnection, faixa: MediaStreamTrack | null) {
  return trocar(pc, 'tela', faixa);
}

/** Qualquer lado: liga (faixa) ou desliga (null) a câmera, SEM nova oferta. */
export function trocarCamera(pc: RTCPeerConnection, faixa: MediaStreamTrack | null) {
  return trocar(pc, 'camera', faixa);
}

/**
 * Candidatos ICE que chegam antes da descrição remota não podem ser aplicados ainda: a fila guarda
 * e aplica na ordem, quando der. Sem isso, a conexão perde caminhos e falha de vez em quando.
 */
export function criarFilaDeCandidatos(pc: RTCPeerConnection) {
  const pendentes: RTCIceCandidateInit[] = [];
  return {
    async receber(candidato: RTCIceCandidateInit) {
      if (pc.remoteDescription) await pc.addIceCandidate(candidato).catch(() => {});
      else pendentes.push(candidato);
    },
    async esvaziar() {
      while (pendentes.length > 0) {
        const c = pendentes.shift();
        if (c) await pc.addIceCandidate(c).catch(() => {});
      }
    },
  };
}
