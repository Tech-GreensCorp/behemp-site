import type { Metadata } from 'next';
import { AgendamentoWizard } from '@/components/shared/agendamento-wizard';

export const metadata: Metadata = {
  title: 'Agendar Consulta | Be4Hope',
  description:
    'Agende sua consulta com médicos especialistas em medicina endocanabinóide. Atendimento online via Google Meet.',
};

/**
 * Página pública de agendamento — renderiza o wizard multi-step client.
 * O usuário precisa estar autenticado para concluir o agendamento.
 */
export default function AgendamentoPage() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Agende sua{' '}
            <span className="text-accent-italic">consulta.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Escolha o melhor horário para sua consulta online com nossos
            especialistas em medicina endocanabinóide.
          </p>
        </div>

        {/* Wizard Multi-Step */}
        <div className="mt-12">
          <AgendamentoWizard />
        </div>
      </div>
    </div>
  );
}
