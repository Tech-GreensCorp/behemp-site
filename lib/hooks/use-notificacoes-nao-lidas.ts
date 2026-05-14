'use client';

import { useState, useEffect, useCallback } from 'react';
import { contarNotificacoesNaoLidas } from '@/app/_actions/notificacoes';

/**
 * Hook que retorna o total de notificações não lidas do usuário.
 * Faz polling periódico leve (30s) para manter o badge atualizado.
 * Escuta evento customizado para atualização imediata ao marcar como lida.
 */
export function useNotificacoesNaoLidas() {
  const [naoLidas, setNaoLidas] = useState(0);

  const buscar = useCallback(async () => {
    try {
      const res = await contarNotificacoesNaoLidas();
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
    window.addEventListener('notificacoes-update', handleUpdate);

    return () => {
      clearInterval(intervalo);
      window.removeEventListener('notificacoes-update', handleUpdate);
    };
  }, [buscar]);

  return naoLidas;
}
