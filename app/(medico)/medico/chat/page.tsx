'use client';

import { ChatContainer } from '@/components/shared/chat-container';

/**
 * Página de chat do médico — utiliza o componente compartilhado.
 * O médico pode conversar com pacientes e equipe de suporte.
 */
export default function ChatMedicoPage() {
  return (
    <ChatContainer
      roleAtual="medico"
      titulo="Chat"
      subtitulo="Converse com seus pacientes em tempo real"
    />
  );
}
