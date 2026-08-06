'use client';

import { ChatContainer } from '@/components/shared/chat-container';

/**
 * Página de chat do paciente — utiliza o componente compartilhado.
 */
export default function ChatPacientePage() {
  return (
    <ChatContainer
      roleAtual="paciente"
      titulo="Chat"
      subtitulo="Converse com seus médicos e equipe de suporte"
    />
  );
}
