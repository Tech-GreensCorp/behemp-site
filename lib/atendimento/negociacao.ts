/**
 * A NEGOCIAÇÃO WebRTC DA CHAMADA DE ATENDIMENTO — ADR-0029 D-15 e D-16.
 *
 * Só navegador; sem `db`, sem `auth`, sem `next/*`. Separado da tela de propósito: é este módulo que
 * o teste no Chromium executa com dois pares reais e mídia falsa, e a tela usa o mesmo, sem cópia.
 *
 * O desenho, para NÃO precisar renegociar quando o paciente começa a mostrar a tela:
 *
 *   admin    oferta:  áudio  sendrecv  +  vídeo  recvonly
 *   paciente resposta: áudio  sendrecv  +  vídeo  sendonly (vazio até compartilhar)
 *
 * Compartilhar a tela é `replaceTrack` no envio de vídeo que já foi negociado — o mesmo mecanismo que
 * a teleconsulta usa para a tela do médico (`GlobalTeleconsultaHost.tsx:437`). Parar é
 * `replaceTrack(null)`: o canal continua negociado e pode voltar a ser usado.
 */

/** O navegador deixa compartilhar a tela? No celular (Chrome Android, Safari iOS) não deixa. */
export function podeCompartilharTela(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function'
  );
}

/** O transceptor pelo tipo de mídia que ele RECEBE — estável, ao contrário da ordem ou do `mid`. */
function transceptor(
  pc: RTCPeerConnection,
  tipo: 'audio' | 'video',
): RTCRtpTransceiver | undefined {
  return pc.getTransceivers().find((t) => t.receiver.track.kind === tipo);
}

/** Admin: monta a oferta com a voz dele e um canal para RECEBER a tela do paciente. */
export async function criarOfertaDoAdmin(
  pc: RTCPeerConnection,
  microfone: MediaStreamTrack | null,
): Promise<RTCSessionDescriptionInit> {
  pc.addTransceiver(microfone ?? 'audio', { direction: 'sendrecv' });
  pc.addTransceiver('video', { direction: 'recvonly' });
  const oferta = await pc.createOffer();
  await pc.setLocalDescription(oferta);
  return { type: 'offer', sdp: pc.localDescription?.sdp };
}

/** Paciente: aceita a oferta, liga a voz e deixa o envio de vídeo pronto e vazio. */
export async function responderComoPaciente(
  pc: RTCPeerConnection,
  oferta: RTCSessionDescriptionInit,
  microfone: MediaStreamTrack | null,
): Promise<RTCSessionDescriptionInit> {
  await pc.setRemoteDescription(oferta);
  const audio = transceptor(pc, 'audio');
  const video = transceptor(pc, 'video');
  if (audio) {
    if (microfone) await audio.sender.replaceTrack(microfone);
    audio.direction = 'sendrecv';
  }
  if (video) video.direction = 'sendonly';
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

/**
 * Paciente: começa (faixa) ou para (null) de mostrar a tela, SEM nova oferta.
 * Devolve `false` se não havia canal de vídeo negociado — a tela avisa em vez de fingir.
 */
export async function trocarTela(
  pc: RTCPeerConnection,
  faixa: MediaStreamTrack | null,
): Promise<boolean> {
  const video = transceptor(pc, 'video');
  if (!video) return false;
  await video.sender.replaceTrack(faixa);
  return true;
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
