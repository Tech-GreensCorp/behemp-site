'use client';

import { ChatContainer } from '@/components/shared/chat-container';

/**
 * Página de chat do admin — utiliza o componente compartilhado.
 */
export default function ChatAdminPage() {
  return (
    <ChatContainer
      roleAtual="admin"
      titulo="Chat"
      subtitulo="Converse com pacientes e médicos da plataforma"
    />
  );
}
