'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { getPusherClient } from '@/lib/integrations/pusher/client';
import { buscarSalaPorRoomId, pacienteEntrarSala } from '../../../_actions/teleconsulta';
import { Mic, MicOff, Video, VideoOff, PhoneOff, AlertCircle, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

function TeleconsultaPacienteContent() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [sala, setSala] = useState<{ salaId: string; medicoNome: string; medicoEspecialidade: string } | null>(null);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [phase, setPhase] = useState<'lobby' | 'connecting' | 'room'>('lobby');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  
  const setLocalVideoEl = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
      el.srcObject = localStreamRef.current;
      el.play().catch(console.warn);
    }
  }, []);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const setRemoteVideoEl = useCallback((el: HTMLVideoElement | null) => {
    remoteVideoRef.current = el;
    if (el && remoteStream && el.srcObject !== remoteStream) {
      el.srcObject = remoteStream;
      el.play().catch(console.warn);
    }
  }, [remoteStream]);
  
  const audioChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);

  // Problema 2 — fila de ICE candidates que chegam antes do remoteDescription
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [cameraOk, setCameraOk] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [remoteConnected, setRemoteConnected] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const verificar = async () => {
      if (!roomId) return;
      const res = await buscarSalaPorRoomId(roomId);
      if (!res.sucesso || !res.dados) {
        setErroAcesso(res.erro ?? 'Sala não encontrada');
      } else {
        setSala(res.dados);
      }
      setCarregando(false);
    };
    verificar();
  }, [roomId]);

  const iniciarMidia = useCallback(async () => {
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(console.warn);
      }
      setCameraOk(true);
    } catch {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        localStreamRef.current = audioStream;
        setCameraOk(true);
        setCamOn(false);
      } catch {
        setMediaError('Câmera/microfone indisponível. Verifique as permissões.');
        setCameraOk(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!sala) return;
    iniciarMidia();
    return () => { localStreamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [sala, iniciarMidia]);

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  };

  const sinalizarWebRTC = async (tipo: string, payload: unknown) => {
    await fetch('/api/teleconsulta/sinalizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, tipo, payload }),
    });
  };

  const entrarNaSala = useCallback(async () => {
    if (!localStreamRef.current || !sala) return;
    setPhase('connecting');

    await pacienteEntrarSala(sala.salaId);

    const pusher = getPusherClient();
    const channel = pusher.subscribe(`presence-sala-${roomId}`);

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    pcRef.current = pc;

    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        setRemoteStream(event.streams[0]);
        setRemoteConnected(true);
        toast.success(`${sala.medicoNome} conectado!`);

        // Quando médico conectar, iniciar mix de áudio dual-channel
        if (localStreamRef.current) {
          try {
            const audioCtx = new window.AudioContext();
            audioCtxRef.current = audioCtx;
            const dest = audioCtx.createMediaStreamDestination();

            // Canal L = paciente (local)
            const localNode = audioCtx.createMediaStreamSource(localStreamRef.current);
            // Canal R = médico (remoto)
            const remoteNode = audioCtx.createMediaStreamSource(event.streams[0]);

            const merger = audioCtx.createChannelMerger(2);
            localNode.connect(merger, 0, 0); // canal L
            remoteNode.connect(merger, 0, 1); // canal R
            merger.connect(dest);

            const mr = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
            audioRecorderRef.current = mr;
            audioChunksRef.current = [];
            mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mr.start(1000);
          } catch (e) {
            console.warn('[Paciente] Mixer de áudio dual-channel não disponível:', e);
          }
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sinalizarWebRTC('ice-candidate', { candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'disconnected' || s === 'failed') {
        setRemoteConnected(false);
      }
    };

    channel.bind('pusher:subscription_succeeded', () => {
      setPhase('room');
      sinalizarWebRTC('peer-joined', { role: 'paciente' });
    });

    channel.bind('webrtc:offer', async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        // Problema 2 — drenar candidates que chegaram antes do remoteDescription
        for (const c of pendingCandidatesRef.current) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* descartado */ }
        }
        pendingCandidatesRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sinalizarWebRTC('answer', { answer });
      } catch (err) {
        console.error('[WebRTC] Erro ao processar offer:', err);
      }
    });

    // Problema 2 — enfileirar candidates que chegam antes do remoteDescription
    channel.bind('webrtc:ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (!pc.remoteDescription) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] ICE candidate inválido:', err);
      }
    });
  }, [sala, roomId]);

  useEffect(() => {
    if (phase !== 'room') return;
    const t = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);



  const encerrar = useCallback(async () => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    
    audioCtxRef.current?.close().catch(() => {});
    audioRecorderRef.current?.stop();

    toast.info('Consulta encerrada.');
    router.push('/paciente');
  }, [router]);

  if (carregando) {
    return <div className="h-screen flex items-center justify-center bg-[#1A1A1A] text-white">Carregando sala...</div>;
  }

  if (erroAcesso) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#1A1A1A] text-white p-6 space-y-4">
        <AlertCircle className="h-16 w-16 text-red-500" />
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p className="text-muted-foreground">{erroAcesso}</p>
        <Button variant="default" onClick={() => router.push('/paciente')} className="mt-4 bg-[#EA5429] hover:bg-[#D4471E]">
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  if (phase === 'lobby' || phase === 'connecting') {
    return (
      <div className="min-h-screen bg-[#1A1A1A] text-white p-6 flex flex-col items-center justify-center">
        <div className="max-w-2xl w-full space-y-6">
          <Button variant="ghost" onClick={() => router.push('/paciente')} className="text-slate-300 hover:text-white">
            <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-display font-bold text-[#EA5429]">Sala de Espera</h1>
            <p className="text-slate-400">
              Consulta com {sala?.medicoNome} {sala?.medicoEspecialidade ? `(${sala.medicoEspecialidade})` : ''}
            </p>
          </div>

          <div className="w-full max-w-sm aspect-video bg-black rounded-xl overflow-hidden border-2 border-[#2D4F3C] mb-8 relative shadow-2xl">
            <video ref={setLocalVideoEl} autoPlay muted playsInline className={`w-full h-full object-cover ${!camOn && 'opacity-0'}`} />
            {!camOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <VideoOff className="h-12 w-12 text-slate-600" />
                <span className="text-sm text-slate-500">Câmera desativada</span>
              </div>
            )}
            <div className="absolute top-4 left-4">
              {cameraOk ? (
                <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/20 border-green-500/30">● Câmera OK</Badge>
              ) : (
                <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/20 border-red-500/30">● Câmera indisponível</Badge>
              )}
            </div>
            {mediaError && (
              <div className="absolute bottom-4 left-4 right-4 bg-red-500/90 text-white text-sm p-3 rounded-lg">
                {mediaError}
              </div>
            )}
          </div>

          <div className="flex gap-4 justify-center">
            <Button onClick={toggleMic} variant={micOn ? 'secondary' : 'destructive'} size="lg" className="rounded-full h-14 w-14 p-0">
              {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>
            <Button onClick={toggleCam} variant={camOn ? 'secondary' : 'destructive'} size="lg" className="rounded-full h-14 w-14 p-0">
              {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
          </div>

          <div className="bg-[#2D4F3C]/20 border border-[#2D4F3C]/30 p-4 rounded-xl text-center">
            <p className="text-sm text-[#2D4F3C] font-medium text-green-300/80">
              Esta consulta pode ser gravada e transcrita com fins clínicos.
            </p>
          </div>

          <Button 
            className="w-full h-14 text-lg font-bold bg-[#EA5429] hover:bg-[#D4471E]" 
            onClick={entrarNaSala} 
            disabled={!cameraOk || phase === 'connecting'}
          >
            {phase === 'connecting' ? 'Conectando...' : 'Entrar na Consulta'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-sm font-medium font-mono">
            AO VIVO {String(Math.floor(duration / 60)).padStart(2, '0')}:{String(duration % 60).padStart(2, '0')}
          </span>
        </div>
        <div className="text-sm font-medium text-slate-300">
          Dr(a). {sala?.medicoNome}
        </div>
      </div>
      
      <div className="flex-1 relative bg-slate-950 flex flex-col justify-center items-center">
        {remoteConnected && remoteStream ? (
          <video
            ref={setRemoteVideoEl}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          !remoteConnected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-[#EA5429] animate-spin" />
              <p className="text-slate-400 font-medium">Aguardando médico...</p>
            </div>
          )
        )}
        
        <div className="absolute bottom-6 right-6 w-48 aspect-video bg-black rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl transition-all hover:scale-105 cursor-pointer">
          <video ref={setLocalVideoEl} autoPlay muted playsInline className={`w-full h-full object-cover ${!camOn && 'opacity-0'}`} />
          {!camOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
              <VideoOff className="h-6 w-6 text-slate-500" />
            </div>
          )}
        </div>
      </div>

      <div className="h-24 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-6 px-6 pb-2">
        <Button onClick={toggleMic} variant={micOn ? 'secondary' : 'destructive'} size="icon" className="rounded-full h-14 w-14 hover:scale-105 transition-transform">
          {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </Button>
        <Button onClick={toggleCam} variant={camOn ? 'secondary' : 'destructive'} size="icon" className="rounded-full h-14 w-14 hover:scale-105 transition-transform">
          {camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </Button>
        <Button onClick={() => {
          if (confirm('Tem certeza que deseja encerrar a consulta?')) {
            encerrar();
          }
        }} variant="destructive" size="icon" className="rounded-full h-14 w-14 hover:scale-105 transition-transform hover:bg-red-600">
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}

export default function TeleconsultaPacientePage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#1A1A1A] text-white">Carregando sala...</div>}>
      <TeleconsultaPacienteContent />
    </Suspense>
  );
}
