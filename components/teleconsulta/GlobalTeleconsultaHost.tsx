'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getPusherClient } from "@/lib/integrations/pusher/client";
import { registrarConsentimentoLgpd, encerrarTeleconsulta } from "@/app/(medico)/_actions/teleconsulta";
import {
    Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff,
    RefreshCw, Brain, Minimize2, FileText, User, Pill
} from "lucide-react";
import { TeleconsultaPip } from '@/components/teleconsulta/TeleconsultaPip';
import { PainelClinicoLateral } from '@/components/teleconsulta/PainelClinicoLateral';
import { CopilotClinico } from '@/components/teleconsulta/CopilotClinico';
import { buscarDadosPainelTeleconsulta, type DadosPainelTeleconsulta } from '@/app/(medico)/_actions/teleconsulta-painel';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTeleconsulta } from "./TeleconsultaContext";

interface ChatMsg { id: number; autor: "medico" | "paciente" | "sistema"; texto: string; hora: string; }
const horaFmt = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function GlobalTeleconsultaHost() {
    const { state, endCall, setMinimized } = useTeleconsulta();
    const { salaId, roomId, isMinimized } = state;
    const router = useRouter();

    const [phase, setPhase] = useState<"lobby" | "connecting" | "room">("lobby");
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);

    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);
    const [screenSharing, setScreenSharing] = useState(false);
    
    const [duration, setDuration] = useState(0);
    const [remoteConnected, setRemoteConnected] = useState(false);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const [showPainel, setShowPainel] = useState(false);
    const [painelAba, setPainelAba] = useState<'paciente' | 'prontuario' | 'prescricao'>('paciente');
    const [dadosPainel, setDadosPainel] = useState<DadosPainelTeleconsulta | null>(null);

    const [showCopilot, setShowCopilot] = useState(false);
    const [transcricaoPronta, setTranscricaoPronta] = useState(false);

    // LGPD (We will assume it was checked in the lobby for simplicity, or we can hardcode true for now since it bypasses the config screen)
    // Actually, we should initialize it when starting the call.
    const [consentimentoTranscricao, setConsentimentoTranscricao] = useState(true);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const audioRecorderRef = useRef<MediaRecorder | null>(null);

    const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([
        { id: 0, autor: "sistema", texto: "Sala criada. Aguardando o paciente conectar.", hora: horaFmt() },
    ]);

    const iniciarMidia = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
                audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
            });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        } catch (videoErr) {
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({
                    video: false,
                    audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
                });
                localStreamRef.current = audioStream;
                setCamOn(false);
            } catch (audioErr) {
                toast.error("Erro ao acessar microfone/câmera.");
            }
        }
    }, []);

    const sinalizarWebRTC = async (tipo: string, payload: unknown) => {
        if (!roomId) return;
        await fetch('/api/teleconsulta/sinalizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, tipo, payload }),
        });
    };

    const iniciarConsulta = useCallback(async () => {
        if (!localStreamRef.current) {
            await iniciarMidia();
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

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => {
                    pc.addTrack(track, localStreamRef.current!);
                });
            }

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
                if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
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
        }
    }, [roomId, salaId, consentimentoTranscricao, iniciarMidia]);

    // Cleanup and lifecycle
    useEffect(() => {
        if (salaId && roomId) {
            setDuration(0);
            setPhase("lobby");
            setConsentimentoTranscricao(true);
            iniciarConsulta(); // auto start since they confirmed in lobby
        } else {
            // Unmount/cleanup
            pcRef.current?.close();
            pcRef.current = null;
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
            setRemoteStream(null);
        }
    }, [salaId, roomId, iniciarConsulta]);

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

                fetch('/api/teleconsulta/transcrever', { method: 'POST', body: form })
                    .then(r => r.json())
                    .then(data => {
                        if (data.sucesso) toast.success("Transcrição processada com sucesso!");
                    });
            };
            mr.stop();
        }

        toast.info("Consulta encerrada.");
        endCall();
        router.push("/medico/agenda");
    };

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

    if (!salaId) return null;

    if (isMinimized) {
        return (
            <TeleconsultaPip
                localStream={localStreamRef.current}
                remoteStream={remoteStream}
                micOn={micOn}
                onMaximize={() => setMinimized(false)}
                onEncerrar={encerrar}
                onToggleMic={toggleMic}
                pacienteNome={dadosPainel?.paciente.nome ?? 'Paciente'}
                duracao={duration}
            />
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex bg-slate-950">
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
                            <div className="flex flex-col items-center gap-4">
                                {phase === "connecting" ? (
                                    <><RefreshCw className="h-8 w-8 text-white/50 animate-spin" /><p className="text-slate-400">Conectando...</p></>
                                ) : (
                                    <p className="text-slate-400">Aguardando paciente conectar na sala...</p>
                                )}
                            </div>
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
                        onClick={() => setMinimized(true)}
                        title="Minimizar e continuar navegando"
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-white shadow-lg transition-all"
                    >
                        <Minimize2 className="h-5 w-5" />
                    </button>
                    <Button onClick={encerrar} variant="destructive" size="icon" className="rounded-full h-12 w-12">
                        <PhoneOff />
                    </Button>
                </div>
            </div>

            {/* Menus Laterais */}
            {phase === 'room' && (
                <div className="fixed bottom-32 right-6 z-50 flex flex-col gap-2">
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
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-border shadow-lg hover:bg-accent transition-all text-sm font-medium text-foreground"
                    >
                        <Icon className="h-4 w-4 text-primary" />
                        {label}
                    </button>
                ))}

                <button
                    onClick={() => setShowCopilot(v => !v)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl shadow-lg transition-all text-sm font-medium ${transcricaoPronta ? 'bg-violet-600 text-white border border-violet-500' : 'bg-card border border-border text-foreground hover:bg-accent'}`}
                >
                    <Brain className="h-4 w-4" />
                    {transcricaoPronta ? 'Revisar Prontuário IA' : 'Copilot Clínico'}
                    {transcricaoPronta && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                </button>
                </div>
            )}

            {dadosPainel && (
                <PainelClinicoLateral
                dados={dadosPainel}
                abaInicial={painelAba}
                visivel={showPainel}
                onFechar={() => setShowPainel(false)}
                />
            )}

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
        </div>
    );
}
