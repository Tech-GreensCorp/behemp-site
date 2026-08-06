'use client';

import { TriagemForm } from '@/components/shared/triagem-form';

/**
 * Página pública de triagem.
 * Usa o componente reutilizável TriagemForm sem medicoClerkId (triagem pública).
 */
export default function TriagemPage() {
  return <TriagemForm />;
}
