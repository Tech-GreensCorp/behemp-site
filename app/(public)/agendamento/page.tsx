import type { Metadata } from 'next';
import Link from 'next/link';
import { Video, Clock, UserCheck } from 'lucide-react';
import { AgendamentoWizard } from '@/components/shared/agendamento-wizard';

export const metadata: Metadata = {
  title: 'Agendar Consulta | Be4Hope',
  description:
    'Agende sua consulta com especialistas em Medicina Endocanabinóide. Atendimento 100% online via Google Meet. Avaliação completa e acompanhamento contínuo.',
};

const beneficios = [
  {
    icon: Video,
    titulo: '100% Online',
    descricao: 'Consulta por videoconferência via Google Meet',
  },
  {
    icon: Clock,
    titulo: 'Duração: ~60 min',
    descricao: 'Avaliação completa e orientação personalizada',
  },
  {
    icon: UserCheck,
    titulo: 'Confirmação Imediata',
    descricao: 'Receba o link do Meet por e-mail na hora',
  },
];

/**
 * Página pública de agendamento.
 * Lista todos os médicos cadastrados para visualização,
 * e delega o agendamento ao wizard (que exige login).
 */
export default async function AgendamentoPage() {

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">

        {/* ── Header ───────────────────────────────────────── */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Agendamento
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Agende sua{' '}
            <span className="text-accent-italic">consulta.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Conecte-se com médicos especializados em Medicina Endocanabinóide.
            Avaliação completa, prescrição segura e acompanhamento contínuo.
          </p>
        </div>

        {/* ── Benefícios ───────────────────────────────────── */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {beneficios.map((b) => (
            <div
              key={b.titulo}
              className="rounded-2xl border border-border/40 bg-card p-6 text-center"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <b.icon className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{b.titulo}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{b.descricao}</p>
            </div>
          ))}
        </div>


        {/* ── CTA — Agendar (wizard com login) ─────────────── */}
        <div className="mt-16">
          <AgendamentoWizard />
        </div>

      </div>
    </div>
  );
}
