'use client';

import { useEffect, useRef } from 'react';
import { Maximize2, PhoneOff, Mic, MicOff } from 'lucide-react';

interface TeleconsultaPipProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micOn: boolean;
  onMaximize: () => void;
  onEncerrar: () => void;
  onToggleMic: () => void;
  pacienteNome: string;
  duracao: number;
}

export function TeleconsultaPip({
  localStream, remoteStream, micOn,
  onMaximize, onEncerrar, onToggleMic,
  pacienteNome, duracao,
}: TeleconsultaPipProps) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current && localStream) localRef.current.srcObject = localStream;
    if (remoteRef.current && remoteStream) remoteRef.current.srcObject = remoteStream;
  }, [localStream, remoteStream]);

  const fmtDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    // Card fixo no canto inferior direito — 280x160px
    <div className="fixed bottom-6 right-6 z-50 w-[280px] rounded-2xl overflow-hidden
                    shadow-2xl border border-white/20 bg-slate-900">
      {/* Vídeo remoto (paciente) em background */}
      <div className="relative h-[158px]">
        <video ref={remoteRef} autoPlay playsInline
          className="w-full h-full object-cover" />

        {/* PiP local (médico) no canto */}
        <div className="absolute bottom-2 right-2 w-16 h-12 rounded-lg overflow-hidden
                        border border-white/30 shadow-lg">
          <video ref={localRef} autoPlay playsInline muted
            className="w-full h-full object-cover" />
        </div>

        {/* Header: nome + timer */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between
                        px-3 py-2 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] text-white font-mono">{fmtDuration(duracao)}</span>
          </div>
          <span className="text-[10px] text-white/80 truncate max-w-[120px]">
            {pacienteNome}
          </span>
        </div>

        {/* Controles */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between
                        px-3 py-2 bg-gradient-to-t from-black/60 to-transparent">
          <button onClick={onToggleMic}
            className={`p-1.5 rounded-lg transition-colors ${
              micOn ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
            }`}>
            {micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
          </button>

          <button onClick={onMaximize}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/80
                       hover:bg-primary text-white text-[10px] font-semibold transition-colors">
            <Maximize2 className="h-3 w-3" />
            Voltar
          </button>

          <button onClick={onEncerrar}
            className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors">
            <PhoneOff className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
