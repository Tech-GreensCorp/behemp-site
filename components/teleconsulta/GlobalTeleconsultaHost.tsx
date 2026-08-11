'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getPusherClient } from "@/lib/integrations/pusher/client";
import { registrarConsentimentoLgpd, encerrarTeleconsulta } from "@/app/(medico)/_actions/teleconsulta";
import {
    Video, VideoOff, Mic, MicOff, PhoneOff,
    Monitor, MonitorOff, RefreshCw, Brain, Minimize2,
    FileText, User, Pill, VideoIcon
} from "lucide-react";
import { TeleconsultaPip } from '@/components/teleconsulta/TeleconsultaPip';
import { PainelClinicoLateral } from '@/components/teleconsulta/PainelClinicoLateral';
import { CopilotClinico } from '@/components/teleconsulta/CopilotClinico';
import { buscarDadosPainelTeleconsulta, type DadosPainelTeleconsulta } from '@/app/(medico)/_actions/teleconsulta-painel';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTeleconsulta } from "./TeleconsultaContext";

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

    const [consentimentoTranscricao] = useState(true);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const audioRecorderRef = useRef<MediaRecorder | null>(null);

    // FIX: garante que o vídeo local sempre exibe o stream assim que o ref e o stream estiverem prontos
    useEffect(() => {
        if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }
    });

    const iniciarMidia = useCallback(async (): Promise<MediaStream | null> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
                audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
            });
            localStreamRef.current = stream;
            // Conecta imediatamente ao elemento de vídeo
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            return stream;
        } catch {
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({
                    video: false,
                    audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
                });
                localStreamRef.current = audioStream;
                setCamOn(false);
                return audioStream;
            } catch {
                toast.error("Erro ao acessar microfone/câmera.");
                return null;
            }
        }
    }, []);

    const sinalizarWebRTC = useCallback(async (tipo: string, payload: unknown) => {
        if (!roomId) return;
        await fetch('/api/teleconsulta/sinalizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, tipo, payload }),
        });
    }, [roomId]);

    const iniciarConsulta = useCallback(async () => {
        // Garantir que a mídia está pronta ANTES de criar a PeerConnection
        let stream = localStreamRef.current;
        if (!stream) {
            stream = await iniciarMidia();
        }

        if (salaId && consentimentoTranscricao) {
            await registrarConsentimentoLgpd(salaId, consentimentoTranscricao);
        }

        setPhase("connecting");

        try {
            const pusher = getPusherClient();
            const channel = pusher.subscribe(`presence-sala-${roomId}`);

            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" },
                ],
            });
            pcRef.current = pc;

            // FIX: adicionar tracks SOMENTE após garantir que o stream existe
            if (stream) {
                stream.getTracks().forEach(track => {
                    pc.addTrack(track, stream!);
                });
            }

            pc.ontrack = (event) => {
                if (remoteVideoRef.current && event.streams[0]) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                    setRemoteStream(event.streams[0]);
                    setRemoteConnected(true);

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
                if (event.candidate) sinalizarWebRTC("ice-candidate", { candidate: event.candidate });
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
                    } catch (err) { console.error("Offer error:", err); }
                }
            });

            channel.bind('webrtc:answer', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
                try { await pc.setRemoteDescription(new RTCSessionDescription(answer)); } catch (err) {}
            });

            channel.bind('webrtc:ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
                try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (err) {}
            });

        } catch (err) {
            toast.error("Erro ao iniciar a sala.");
        }
    }, [roomId, salaId, consentimentoTranscricao, iniciarMidia, sinalizarWebRTC]);

    // Lifecycle: iniciar/encerrar ao mudar salaId
    useEffect(() => {
        if (salaId && roomId) {
            setDuration(0);
            setPhase("lobby");
            setRemoteConnected(false);
            setRemoteStream(null);
            setDadosPainel(null);
            setShowPainel(false);
            setShowCopilot(false);
            iniciarConsulta();
        } else {
            pcRef.current?.close();
            pcRef.current = null;
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
            audioCtxRef.current?.close();
            setRemoteStream(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [salaId, roomId]);

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
                    .then(data => { if (data.sucesso) toast.success("Transcrição processada!"); });
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

    // FIX: Compartilhamento de tela
    const toggleScreen = async () => {
        if (screenSharing) {
            // Voltar para câmera
            const camTrack = localStreamRef.current?.getVideoTracks()[0];
            if (camTrack) camTrack.enabled = true;
            const sender = pcRef.current?.getSenders().find(s => s.track?.kind === "video");
            if (sender && camTrack) await sender.replaceTrack(camTrack);
            if (localVideoRef.current && localStreamRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
            }
            setScreenSharing(false);
        } else {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { displaySurface: "monitor" } as unknown as MediaTrackConstraints,
                    audio: false,
                });
                const screenTrack = screenStream.getVideoTracks()[0];
                if (localVideoRef.current) {
                    const previewStream = new MediaStream([
                        screenTrack,
                        ...(localStreamRef.current?.getAudioTracks() || []),
                    ]);
                    localVideoRef.current.srcObject = previewStream;
                }
                const sender = pcRef.current?.getSenders().find(s => s.track?.kind === "video");
                if (sender) await sender.replaceTrack(screenTrack);

                screenTrack.onended = () => {
                    setScreenSharing(false);
                    if (localVideoRef.current && localStreamRef.current) {
                        localVideoRef.current.srcObject = localStreamRef.current;
                    }
                    const originalCam = localStreamRef.current?.getVideoTracks()[0];
                    const snd = pcRef.current?.getSenders().find(s => s.track?.kind === "video");
                    if (snd && originalCam) snd.replaceTrack(originalCam);
                };
                setScreenSharing(true);
            } catch (err: unknown) {
                if (err instanceof Error && err.name !== "NotAllowedError") toast.error("Erro ao compartilhar tela.");
            }
        }
    };

    // Abrir painel clínico (funciona mesmo sem dadosPainel ainda carregado)
    const abrirPainel = (aba: 'paciente' | 'prontuario' | 'prescricao') => {
        setPainelAba(aba);
        setShowPainel(true);
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

    const fmtDuration = `${String(Math.floor(duration / 60)).padStart(2, "0")}:${String(duration % 60).padStart(2, "0")}`;

    return (
        <div className="fixed inset-0 z-50 flex bg-slate-950">

            {/* ── Painel clínico lateral (ESQUERDA) — aparece ao clicar nos botões ── */}
            {dadosPainel && showPainel && (
                <PainelClinicoLateral
                    dados={dadosPainel}
                    abaInicial={painelAba}
                    visivel={showPainel}
                    onFechar={() => setShowPainel(false)}
                />
            )}

            {/* ── Área principal de vídeo ── */}
            <div className="flex-1 flex flex-col relative min-w-0">
                {/* Header */}
                <div className="h-14 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between px-4 z-10">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-white text-sm font-medium">AO VIVO {fmtDuration}</span>
                    </div>
                    {remoteConnected && (
                        <span className="text-xs text-emerald-400 font-medium">
                            ✓ {dadosPainel?.paciente.nome ?? 'Paciente'} conectado
                        </span>
                    )}
                </div>

                {/* Área de vídeo */}
                <div className="flex-1 relative overflow-hidden">
                    {/* Vídeo remoto (paciente) — fundo principal */}
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                    />

                    {/* Estado de aguardando */}
                    {!remoteConnected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                            <div className="flex flex-col items-center gap-4 text-center">
                                {phase === "connecting" ? (
                                    <>
                                        <RefreshCw className="h-8 w-8 text-white/50 animate-spin" />
                                        <p className="text-slate-400 text-sm">Conectando à sala...</p>
                                    </>
                                ) : (
                                    <>
                                        <VideoIcon className="h-10 w-10 text-slate-600" />
                                        <p className="text-slate-400 text-sm">Aguardando paciente entrar na sala...</p>
                                        <p className="text-slate-500 text-xs">O paciente foi notificado. Aguarde a conexão.</p>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* PiP local (médico) — canto INFERIOR ESQUERDO para não sobrepor câmera do paciente */}
                    <div className="absolute bottom-4 left-4 w-44 aspect-video bg-black rounded-xl overflow-hidden border-2 border-slate-600 shadow-2xl z-10">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className={`w-full h-full object-cover ${!camOn && "opacity-0"}`}
                        />
                        {!camOn && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                                <VideoOff className="h-6 w-6 text-slate-500" />
                            </div>
                        )}
                        <span className="absolute bottom-1 left-1 text-[9px] text-white/70 bg-black/40 rounded px-1">Você</span>
                    </div>

                    {/* ── Botões clínicos — ESQUERDA superior, abaixo do header ── */}
                    {phase === 'room' && (
                        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                            {([
                                { label: 'Paciente', icon: User, aba: 'paciente' as const },
                                { label: 'Prontuário', icon: FileText, aba: 'prontuario' as const },
                                { label: 'Prescrição', icon: Pill, aba: 'prescricao' as const },
                            ]).map(({ label, icon: Icon, aba }) => (
                                <button
                                    key={aba}
                                    onClick={() => abrirPainel(aba)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg transition-all text-sm font-medium backdrop-blur-sm ${
                                        showPainel && painelAba === aba
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-slate-900/80 border border-slate-700 text-white hover:bg-slate-800/90'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </button>
                            ))}

                            <button
                                onClick={() => setShowCopilot(v => !v)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg transition-all text-sm font-medium backdrop-blur-sm ${
                                    transcricaoPronta
                                        ? 'bg-violet-600 text-white border border-violet-500'
                                        : showCopilot
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-slate-900/80 border border-slate-700 text-white hover:bg-slate-800/90'
                                }`}
                            >
                                <Brain className="h-4 w-4" />
                                {transcricaoPronta ? 'Revisar IA' : 'Copilot'}
                                {transcricaoPronta && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Barra de controles ── */}
                <div className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-3 z-10">
                    {/* Mic */}
                    <button
                        onClick={toggleMic}
                        title={micOn ? "Silenciar microfone" : "Ativar microfone"}
                        className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
                            micOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                        }`}
                    >
                        {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                    </button>

                    {/* Câmera */}
                    <button
                        onClick={toggleCam}
                        title={camOn ? "Desligar câmera" : "Ligar câmera"}
                        className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
                            camOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                        }`}
                    >
                        {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                    </button>

                    {/* Compartilhar Tela */}
                    <button
                        onClick={toggleScreen}
                        title={screenSharing ? "Parar compartilhamento" : "Compartilhar tela"}
                        className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
                            screenSharing
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white ring-2 ring-emerald-400/50'
                                : 'bg-slate-700 hover:bg-slate-600 text-white'
                        }`}
                    >
                        {screenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
                    </button>

                    {/* Minimizar */}
                    <button
                        onClick={() => setMinimized(true)}
                        title="Minimizar e continuar navegando"
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 text-white transition-all"
                    >
                        <Minimize2 className="h-5 w-5" />
                    </button>

                    {/* Encerrar */}
                    <button
                        onClick={encerrar}
                        title="Encerrar consulta"
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-white transition-all shadow-lg shadow-red-900/50"
                    >
                        <PhoneOff className="h-6 w-6" />
                    </button>
                </div>
            </div>

            {/* Copilot */}
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
