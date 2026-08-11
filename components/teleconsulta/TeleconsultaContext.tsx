'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TeleconsultaState {
  salaId: string | null;
  roomId: string | null;
  isMinimized: boolean;
}

interface TeleconsultaContextType {
  state: TeleconsultaState;
  startCall: (salaId: string, roomId: string) => void;
  endCall: () => void;
  setMinimized: (minimized: boolean) => void;
}

const TeleconsultaContext = createContext<TeleconsultaContextType | undefined>(undefined);

export function TeleconsultaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TeleconsultaState>({
    salaId: null,
    roomId: null,
    isMinimized: false,
  });

  const startCall = (salaId: string, roomId: string) => {
    setState({ salaId, roomId, isMinimized: false });
  };

  const endCall = () => {
    setState({ salaId: null, roomId: null, isMinimized: false });
  };

  const setMinimized = (isMinimized: boolean) => {
    setState((prev) => ({ ...prev, isMinimized }));
  };

  return (
    <TeleconsultaContext.Provider value={{ state, startCall, endCall, setMinimized }}>
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
