'use client';

import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';

interface TeleconsultaState {
  salaId: string | null;
  roomId: string | null;
  isMinimized: boolean;
  /**
   * Stream local do médico — armazenado no contexto para que o PiP
   * acesse o valor real mesmo após navegação (refs não disparam re-render).
   */
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

interface TeleconsultaContextType {
  state: TeleconsultaState;
  startCall: (salaId: string, roomId: string) => void;
  endCall: () => void;
  setMinimized: (minimized: boolean) => void;
  /** Chamado pelo GlobalTeleconsultaHost quando os streams mudam */
  setStreams: (local: MediaStream | null, remote: MediaStream | null) => void;
}

const TeleconsultaContext = createContext<TeleconsultaContextType | undefined>(undefined);

export function TeleconsultaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TeleconsultaState>({
    salaId: null,
    roomId: null,
    isMinimized: false,
    localStream: null,
    remoteStream: null,
  });

  const startCall = useCallback((salaId: string, roomId: string) => {
    setState((prev) => ({ ...prev, salaId, roomId, isMinimized: false }));
  }, []);

  const endCall = useCallback(() => {
    setState({ salaId: null, roomId: null, isMinimized: false, localStream: null, remoteStream: null });
  }, []);

  const setMinimized = useCallback((isMinimized: boolean) => {
    setState((prev) => ({ ...prev, isMinimized }));
  }, []);

  const setStreams = useCallback((local: MediaStream | null, remote: MediaStream | null) => {
    setState((prev) => ({ ...prev, localStream: local, remoteStream: remote }));
  }, []);

  return (
    <TeleconsultaContext.Provider value={{ state, startCall, endCall, setMinimized, setStreams }}>
      {children}
    </TeleconsultaContext.Provider>
  );
}

export function useTeleconsulta() {
  const context = useContext(TeleconsultaContext);
  if (context === undefined) {
    throw new Error('useTeleconsulta deve ser usado dentro de um TeleconsultaProvider');
  }
  return context;
}
