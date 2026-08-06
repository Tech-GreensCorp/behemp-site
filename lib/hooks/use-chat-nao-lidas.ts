'use client';

import { useState, useEffect, useCallback } from 'react';
import { contarMensagensNaoLidas } from '@/app/_actions/chat';

/**
 * Hook que retorna o total de mensagens de chat não lidas do usuário.
 * Faz polling periódico leve (30s) para manter o badge atualizado
 * mesmo sem Pusher no contexto da sidebar.
 */
export function useChatNaoLidas() {
  const [naoLidas, setNaoLidas] = useState(0);

  const buscar = useCallback(async () => {
    try {
      const res = await contarMensagensNaoLidas();
      if (res.sucesso && res.dados !== undefined) {
        setNaoLidas(res.dados);
      }
    } catch {
      // Silencioso — sidebar não deve quebrar por erro de contagem
    }
  }, []);

  useEffect(() => {
    buscar();
    const intervalo = setInterval(buscar, 30_000); // Polling leve a cada 30s

    // Escutar evento customizado para atualização imediata
    const handleUpdate = () => buscar();
    window.addEventListener('chat-nao-lidas-update', handleUpdate);

    return () => {
      clearInterval(intervalo);
      window.removeEventListener('chat-nao-lidas-update', handleUpdate);
    };
  }, [buscar]);

  return naoLidas;
}
