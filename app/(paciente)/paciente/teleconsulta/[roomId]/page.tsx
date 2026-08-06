'use client';

import { useCallback, useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Video, VideoOff, PhoneOff, UserRound } from "lucide-react";
import { toast } from "sonner";
import { getPusherClient } from "@/lib/integrations/pusher/client";

export default function TeleconsultaPaciente({ params }: { params: Promise<{ roomId: string }> }) {
    const { roomId } = use(params);
    const router = useRouter();

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);

    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);
    const [connected, setConnected] = useState(false);
    const [phase, setPhase] = useState<"lobby" | "connecting" | "room">("lobby");
    const [cameraOk, setCameraOk] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                streamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                setCameraOk(true);
            } catch {
                toast.error("Câmera/microfone indisponível.");
            }
        })();
        return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
    }, []);

    const toggleMic = useCallback(() => {
        const audio = streamRef.current?.getAudioTracks()[0];
        if (audio) { audio.enabled = !audio.enabled; setMicOn(audio.enabled); }
    }, []);

    const toggleCam = useCallback(() => {
        const video = streamRef.current?.getVideoTracks()[0];
        if (video) { video.enabled = !video.enabled; setCamOn(video.enabled); }
    }, []);

    const sinalizarWebRTC = async (tipo: string, payload: unknown) => {
        await fetch('/api/teleconsulta/sinalizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, tipo, payload }),
        });
    };

    const entrarNaSala = useCallback(async () => {
        if (!streamRef.current || !cameraOk) return;
        setPhase("connecting");

        try {
            const pusher = getPusherClient();
            const channel = pusher.subscribe(`presence-sala-${roomId}`);

            const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
            pcRef.current = pc;

            streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current!));

            pc.ontrack = (event) => {
                if (remoteVideoRef.current && event.streams[0]) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                    setConnected(true);
                }
            };

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    sinalizarWebRTC("ice-candidate", { candidate: event.candidate });
                }
            };

            channel.bind('pusher:subscription_succeeded', () => {
                setPhase("room");
                sinalizarWebRTC("peer-joined", { role: "paciente" });
            });

            channel.bind('webrtc:offer', async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    sinalizarWebRTC("answer", { answer });
                } catch (err) {}
            });

            channel.bind('webrtc:ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {}
            });

        } catch (err) {
            toast.error("Erro ao conectar.");
            setPhase("lobby");
        }
    }, [roomId, cameraOk]);

    const encerrar = useCallback(() => {
        pcRef.current?.close();
        streamRef.current?.getTracks().forEach(t => t.stop());
        router.push("/");
    }, [router]);

    if (phase === "lobby" || phase === "connecting") {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
                <div className="max-w-2xl w-full text-center">
                    <h1 className="text-3xl font-bold text-white mb-2">Teleconsulta</h1>
                    <p className="text-slate-400 mb-8">Verifique seus dispositivos antes de entrar.</p>

                    <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden mb-6 border border-slate-800">
                        <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        {!camOn && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                                <VideoOff className="w-12 h-12 text-slate-500" />
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center gap-4">
                        <button onClick={toggleMic} className={`w-14 h-14 rounded-full flex items-center justify-center ${micOn ? 'bg-slate-800' : 'bg-red-500'}`}>
                            {micOn ? <Mic className="text-white" /> : <MicOff className="text-white" />}
                        </button>
                        <button onClick={toggleCam} className={`w-14 h-14 rounded-full flex items-center justify-center ${camOn ? 'bg-slate-800' : 'bg-red-500'}`}>
                            {camOn ? <Video className="text-white" /> : <VideoOff className="text-white" />}
                        </button>
                        <button onClick={entrarNaSala} disabled={!cameraOk || phase === "connecting"} className="flex-1 max-w-[200px] rounded-full bg-[var(--primary)] text-white font-semibold">
                            {phase === "connecting" ? "Conectando..." : "Entrar na Sala"}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-slate-950 flex flex-col">
            <div className="flex-1 relative bg-slate-900">
                <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                
                {!connected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <UserRound className="w-16 h-16 text-slate-600 mb-4" />
                        <p className="text-slate-400">Aguardando médico...</p>
                    </div>
                )}

                <div className="absolute bottom-6 right-6 w-32 md:w-48 aspect-video bg-black rounded-lg overflow-hidden border-2 border-slate-700">
                    <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${!camOn && "opacity-0"}`} />
                </div>
            </div>

            <div className="h-24 bg-slate-950 border-t border-slate-800 flex items-center justify-center gap-6">
                <button onClick={toggleMic} className={`w-14 h-14 rounded-full flex items-center justify-center ${micOn ? 'bg-slate-800 hover:bg-slate-700' : 'bg-red-500'}`}>
                    {micOn ? <Mic className="text-white" /> : <MicOff className="text-white" />}
                </button>
                <button onClick={toggleCam} className={`w-14 h-14 rounded-full flex items-center justify-center ${camOn ? 'bg-slate-800 hover:bg-slate-700' : 'bg-red-500'}`}>
                    {camOn ? <Video className="text-white" /> : <VideoOff className="text-white" />}
                </button>
                <button onClick={encerrar} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                    <PhoneOff className="text-white w-6 h-6" />
                </button>
            </div>
        </div>
    );
}
