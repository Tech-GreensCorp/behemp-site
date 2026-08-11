'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getPusherClient } from "@/lib/integrations/pusher/client";
import { registrarConsentimentoLgpd, encerrarTeleconsulta } from "../../_actions/teleconsulta";
import {
    Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff,
    Wifi, WifiOff, ChevronLeft, RefreshCw, AlertTriangle, MessageSquare, Send,
    User, Pill, Brain, Minimize2, FileText
} from "lucide-react";
import { TeleconsultaPip } from '@/components/teleconsulta/TeleconsultaPip';
import { PainelClinicoLateral } from '@/components/teleconsulta/PainelClinicoLateral';
import { CopilotClinico } from '@/components/teleconsulta/CopilotClinico';
import { buscarDadosPainelTeleconsulta, type DadosPainelTeleconsulta } from '@/app/(medico)/_actions/teleconsulta-painel';
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ChatMsg { id: number; autor: "medico" | "paciente" | "sistema"; texto: string; hora: string; }
const horaFmt = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function TeleconsultaContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const salaId = searchParams.get('salaId');
    const roomId = searchParams.get('roomId') || Math.random().toString(36).slice(2, 8).toUpperCase();

    const [phase, setPhase] = useState<"lobby" | "connecting" | "room">("lobby");

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);

    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);
    const [screenSharing, setScreenSharing] = useState(false);
    const [hasCamera, setHasCamera] = useState(true);
    const [hasMic, setHasMic] = useState(true);
    const [mediaError, setMediaError] = useState<string | null>(null);

    const [duration, setDuration] = useState(0);
    const [remoteConnected, setRemoteConnected] = useState(false);
    const [quality, setQuality] = useState<"excellent" | "good" | "poor" | "offline">("offline");

    const [minimizado, setMinimizado] = useState(false);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const [showPainel, setShowPainel] = useState(false);
    const [painelAba, setPainelAba] = useState<'paciente' | 'prontuario' | 'prescricao'>('paciente');
    const [dadosPainel, setDadosPainel] = useState<DadosPainelTeleconsulta | null>(null);

    const [showCopilot, setShowCopilot] = useState(false);
    const [transcricaoPronta, setTranscricaoPronta] = useState(false);

    const [consentimentoTranscricao, setConsentimentoTranscricao] = useState(false);
    const [transcricaoStatus, setTranscricaoStatus] = useState<"idle" | "enviando" | "processando" | "concluida" | "erro">("idle");
    const audioChunksRef = useRef<Blob[]>([]);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const audioRecorderRef = useRef<MediaRecorder | null>(null);

    const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([
        { id: 0, autor: "sistema", texto: "Sala criada. Aguardando o paciente conectar.", hora: horaFmt() },
    ]);
    const [chatInput, setChatInput] = useState("");
    const chatEndRef = useRef<HTMLDivElement>(null);

    const iniciarMidia = useCallback(async () => {
        setMediaError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
                audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
            });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            setHasCamera(stream.getVideoTracks().length > 0);
            setHasMic(stream.getAudioTracks().length > 0);
        } catch (videoErr: unknown) {
            console.warn("[Teleconsulta] Câmera indisponível, tentando áudio-only:", videoErr instanceof Error ? videoErr.name : String(videoErr));
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({
                    video: false,
                    audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
                });
                localStreamRef.current = audioStream;
                setHasCamera(false);
                setHasMic(true);
            } catch (audioErr: unknown) {
                const msg = "Erro ao acessar microfone/câmera.";
                setMediaError(msg);
                setHasCamera(false);
                setHasMic(false);
                toast.error(msg);
            }
        }
    }, []);

    useEffect(() => {
        iniciarMidia();
        return () => {
            localStreamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, [iniciarMidia]);

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

    const toggleScreen = async () => {
        if (screenSharing) {
            const camTrack = localStreamRef.current?.getVideoTracks()[0];
            if (camTrack) camTrack.enabled = true;
            setScreenSharing(false);
            const sender = pcRef.current?.getSenders().find(s => s.track?.kind === "video");
            if (sender && camTrack) { await sender.replaceTrack(camTrack); }
        } else {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { displaySurface: "monitor" } as unknown as MediaTrackConstraints,
                    audio: false,
                });
                const screenTrack = screenStream.getVideoTracks()[0];
                if (localVideoRef.current) {
                    const newStream = new MediaStream([
                        screenTrack,
                        ...(localStreamRef.current?.getAudioTracks() || []),
                    ]);
                    localVideoRef.current.srcObject = newStream;
                }
                const sender = pcRef.current?.getSenders().find(s => s.track?.kind === "video");
                if (sender) await sender.replaceTrack(screenTrack);

                screenTrack.onended = () => {
                    setScreenSharing(false);
                    if (localVideoRef.current && localStreamRef.current) {
                        localVideoRef.current.srcObject = localStreamRef.current;
                    }
                };
                setScreenSharing(true);
            } catch (err: unknown) {
                if (err instanceof Error && err.name !== "NotAllowedError") toast.error("Erro ao compartilhar tela.");
            }
        }
    };

    const sinalizarWebRTC = async (tipo: string, payload: unknown) => {
        await fetch('/api/teleconsulta/sinalizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, tipo, payload }),
        });
    };

    const iniciarConsulta = useCallback(async () => {
        if (!localStreamRef.current) {
            toast.error("Câmera/Mic não inicializados.");
            return;
        }
        
        if (salaId && consentimentoTranscricao) {
            await registrarConsentimentoLgpd(salaId, consentimentoTranscricao);
        }

        setPhase("connecting");

        try {
            const pusher = getPusherClient();
            const channel = pusher.subscribe(`presence-sala-${roomId}`);

            const pc = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });
            pcRef.current = pc;

            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });

            pc.ontrack = (event) => {
                if (remoteVideoRef.current && event.streams[0]) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                    setRemoteStream(event.streams[0]);
                    setRemoteConnected(true);
                    setChatMsgs(prev => [...prev, { id: Date.now(), autor: "sistema", texto: "✅ Paciente conectado.", hora: horaFmt() }]);

                    if (consentimentoTranscricao && localStreamRef.current) {
                        try {
                            const audioCtx = new window.AudioContext();
                            audioCtxRef.current = audioCtx;
                            const dest = audioCtx.createMediaStreamDestination();
                            const localNode = audioCtx.createMediaStreamSource(localStreamRef.current);
                            const remoteNode = audioCtx.createMediaStreamSource(event.streams[0]);
                            const merger = audioCtx.createChannelMerger(2);
                            localNode.connect(merger, 0, 0);
                            remoteNode.connect(merger, 0, 1);
                            merger.connect(dest);
                            
                            const mr = new MediaRecorder(dest.stream, { mimeType: "audio/webm;codecs=opus" });
                            audioRecorderRef.current = mr;
                            audioChunksRef.current = [];
                            mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
                            mr.start(1000);
                        } catch (e) {
                            console.warn("Mixer error:", e);
                        }
                    }
                }
            };

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    sinalizarWebRTC("ice-candidate", { candidate: event.candidate });
                }
            };

            pc.onconnectionstatechange = () => {
                if (pc.connectionState === "connected") setQuality("excellent");
                else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
                    setQuality("offline");
                    setRemoteConnected(false);
                }
            };

            channel.bind('pusher:subscription_succeeded', () => {
                setPhase("room");
                sinalizarWebRTC("peer-joined", { role: "medico" });
            });

            channel.bind('webrtc:peer-joined', async ({ role }: { role: string }) => {
                if (role === "paciente") {
                    try {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        sinalizarWebRTC("offer", { offer });
                    } catch (err) {}
                }
            });

            channel.bind('webrtc:answer', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (err) {}
            });

            channel.bind('webrtc:ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {}
            });

        } catch (err) {
            toast.error("Erro ao iniciar a sala.");
            setPhase("lobby");
        }
    }, [roomId, salaId, consentimentoTranscricao]);

    useEffect(() => {
        if (phase !== "room") return;
        const t = setInterval(() => setDuration(d => d + 1), 1000);
        return () => clearInterval(t);
    }, [phase]);

    useEffect(() => {
        if (phase !== 'room' || !salaId) return;
        buscarDadosPainelTeleconsulta(salaId).then((res) => {
            if (res.sucesso && res.dados) setDadosPainel(res.dados);
        });
    }, [phase, salaId]);

    const encerrar = async () => {
        pcRef.current?.close();
        pcRef.current = null;
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        audioCtxRef.current?.close();

        if (salaId) await encerrarTeleconsulta(salaId, duration);
        
        const mr = audioRecorderRef.current;
        if (mr && mr.state !== "inactive" && consentimentoTranscricao && salaId) {
            mr.onstop = () => {
                if (audioChunksRef.current.length === 0) return;
                const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                const form = new FormData();
                form.append("salaId", salaId);
                form.append("consentimento", "true");
                form.append("audio", blob, "teleconsulta.webm");

                setTranscricaoStatus("enviando");
                fetch('/api/teleconsulta/transcrever', { method: 'POST', body: form })
                    .then(r => r.json())
                    .then(data => {
                        if (data.sucesso) {
                            toast.success("Transcrição enviada para processamento com sucesso!");
                        } else {
                            toast.error("Falha na transcrição.");
                        }
                    })
                    .catch(() => toast.error("Falha no upload da transcrição."));
            };
            mr.stop();
        }

        toast.info("Consulta encerrada.");
        router.push("/medico/agenda");
    };

    if (phase === "lobby" || phase === "connecting") {
        return (
            <div className="p-8 max-w-4xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => router.push("/medico/agenda")}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                
                <h1 className="text-2xl font-bold text-[var(--primary)]">Teleconsulta</h1>
                <p className="text-muted-foreground">Verifique sua câmera e microfone antes de entrar.</p>

                <div className="relative aspect-video bg-black rounded-lg overflow-hidden border">
                    <video ref={localVideoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover ${!camOn && "opacity-0"}`} />
                    {!camOn && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <VideoOff className="h-12 w-12 text-white/50" />
                        </div>
                    )}
                </div>

                <div className="flex gap-4 justify-center">
                    <Button onClick={toggleMic} variant={micOn ? "secondary" : "destructive"}>
                        {micOn ? <Mic /> : <MicOff />}
                    </Button>
                    <Button onClick={toggleCam} variant={camOn ? "secondary" : "destructive"}>
                        {camOn ? <Video /> : <VideoOff />}
                    </Button>
                    <Button onClick={toggleScreen} variant={screenSharing ? "default" : "secondary"}>
                        {screenSharing ? <MonitorOff /> : <Monitor />}
                    </Button>
                </div>

                <div className="bg-card p-4 rounded-lg border flex items-center space-x-2">
                    <Checkbox id="lgpd" checked={consentimentoTranscricao} onCheckedChange={(c) => setConsentimentoTranscricao(!!c)} />
                    <label htmlFor="lgpd" className="text-sm font-medium leading-none">
                        Confirmo que tenho o consentimento do paciente para gravar e transcrever esta sessão (LGPD).
                    </label>
                </div>

                <Button className="w-full" size="lg" onClick={iniciarConsulta} disabled={phase === "connecting"}>
                    {phase === "connecting" ? "Conectando..." : "Iniciar Sala"}
                </Button>
            </div>
        );
    }

    return (
        <>
            <div className={`h-screen flex bg-slate-950 ${minimizado ? 'hidden' : ''}`}>
            <div className="flex-1 flex flex-col relative">
                <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-white text-sm font-medium">AO VIVO {String(Math.floor(duration / 60)).padStart(2, "0")}:{String(duration % 60).padStart(2, "0")}</span>
                    </div>
                </div>
                
                <div className="flex-1 relative">
                    <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                    {!remoteConnected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                            <p className="text-slate-400">Aguardando paciente...</p>
                        </div>
                    )}
                    
                    <div className="absolute bottom-4 right-4 w-48 aspect-video bg-black rounded-lg overflow-hidden border-2 border-slate-700 shadow-xl">
                        <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${!camOn && "opacity-0"}`} />
                    </div>
                </div>

                <div className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-4">
                    <Button onClick={toggleMic} variant={micOn ? "secondary" : "destructive"} size="icon" className="rounded-full h-12 w-12">
                        {micOn ? <Mic /> : <MicOff />}
                    </Button>
                    <Button onClick={toggleCam} variant={camOn ? "secondary" : "destructive"} size="icon" className="rounded-full h-12 w-12">
                        {camOn ? <Video /> : <VideoOff />}
                    </Button>
                    <button
                      onClick={() => setMinimizado(true)}
                      title="Minimizar (continuar em segundo plano)"
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700
                                 text-white shadow-lg transition-all"
                    >
                      <Minimize2 className="h-5 w-5" />
                    </button>
                    <Button onClick={encerrar} variant="destructive" size="icon" className="rounded-full h-12 w-12">
                        <PhoneOff />
                    </Button>
                </div>
            </div>
            </div>

            {/* Botões flutuantes — Menu Rápido Clínico */}
            {!minimizado && phase === 'room' && (
              <div className="fixed bottom-32 right-6 z-40 flex flex-col gap-2">
                {[
                  { label: 'Paciente', icon: User, aba: 'paciente' },
                  { label: 'Prontuário', icon: FileText, aba: 'prontuario' },
                  { label: 'Prescrição', icon: Pill, aba: 'prescricao' },
                ].map(({ label, icon: Icon, aba }) => (
                  <button
                    key={aba}
                    onClick={() => {
                      setPainelAba(aba as 'paciente' | 'prontuario' | 'prescricao');
                      setShowPainel(true);
                    }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border
                               border-border shadow-lg hover:bg-accent transition-all text-sm
                               font-medium text-foreground"
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    {label}
                  </button>
                ))}

                <button
                  onClick={() => setShowCopilot(v => !v)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl shadow-lg
                             transition-all text-sm font-medium
                             ${transcricaoPronta
                               ? 'bg-violet-600 text-white border border-violet-500'
                               : 'bg-card border border-border text-foreground hover:bg-accent'
                             }`}
                >
                  <Brain className="h-4 w-4" />
                  {transcricaoPronta ? 'Revisar Prontuário IA' : 'Copilot Clínico'}
                  {transcricaoPronta && (
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  )}
                </button>
              </div>
            )}

            {/* PiP Flutuante — quando minimizado */}
            {minimizado && (
              <TeleconsultaPip
                localStream={localStreamRef.current}
                remoteStream={remoteStream}
                micOn={micOn}
                onMaximize={() => setMinimizado(false)}
                onEncerrar={encerrar}
                onToggleMic={toggleMic}
                pacienteNome={dadosPainel?.paciente.nome ?? 'Paciente'}
                duracao={duration}
              />
            )}

            {/* Painel Clínico Lateral */}
            {dadosPainel && (
              <PainelClinicoLateral
                dados={dadosPainel}
                abaInicial={painelAba}
                visivel={showPainel}
                onFechar={() => setShowPainel(false)}
              />
            )}

            {/* Copilot Clínico */}
            {salaId && dadosPainel && (
              <CopilotClinico
                salaId={salaId}
                roomId={roomId as string}
                pacienteNome={dadosPainel.paciente.nome}
                pacienteId={dadosPainel.paciente.id}
                consultaId={dadosPainel.consultaId}
                visivel={showCopilot}
                onFechar={() => setShowCopilot(false)}
                onTranscricaoPronta={() => setTranscricaoPronta(true)}
              />
            )}
        </>
    );
}

export default function TeleconsultaMedico() {
    return (
        <Suspense fallback={<div>Carregando sala...</div>}>
            <TeleconsultaContent />
        </Suspense>
    );
}
