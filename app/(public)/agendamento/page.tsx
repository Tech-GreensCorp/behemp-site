import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Video,
  Clock,
  CheckCircle2,
  Gift,
  CalendarCheck,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { AgendamentoWizard } from '@/components/shared/agendamento-wizard';
import { MedicoCardHover } from '@/components/shared/medico-card-hover';
import { listarMedicosPublico } from '@/app/(public)/_actions/agendamento';

export const metadata: Metadata = {
  title: 'Agendar Consulta | Be4Hope',
  description:
    'A primeira consulta com especialistas em Medicina Endocanabinóide é gratuita. Atendimento 100% online via Google Meet. Agende agora.',
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
 * Exibe banner de primeira consulta gratuita, lista todos os médicos
 * cadastrados para visualização, e delega o agendamento ao wizard (que exige login).
 */
export default async function AgendamentoPage() {
  /* Busca médicos para exibição pública — sem valor da consulta */
  const { dados: medicos = [] } = await listarMedicosPublico();

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

        {/* ── Banner — Primeira consulta gratuita ──────────── */}
        <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <Gift className="h-7 w-7 text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
            Primeira consulta{' '}
            <span className="text-primary">100% gratuita</span>
          </h2>
          <p className="mt-3 text-base text-muted-foreground max-w-lg mx-auto">
            Na Be4Hope, a sua primeira consulta com nossos especialistas é{' '}
            <strong className="text-foreground">completamente gratuita</strong>.
            Acreditamos que o cuidado não pode ter barreira financeira.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Sem custo na 1ª consulta
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Sem cartão de crédito
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Cancele a qualquer momento
            </span>
          </div>
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

        {/* ── Nossos especialistas (exibição pública) ───────── */}
        {medicos.length > 0 && (
          <section className="mt-16">
            <div className="mb-8 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
                Nosso time
              </p>
              <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                Conheça nossos{' '}
                <span className="text-accent-italic">especialistas</span>
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Médicos especializados em Medicina Endocanabinóide, prontos para
                cuidar de você.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {medicos.map((medico) => (
                <MedicoCardHover
                  key={medico.id}
                  id={medico.id}
                  nome={medico.nome}
                  especialidade={medico.especialidade}
                  bio={medico.bio}
                  avatarUrl={medico.avatarUrl}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── CTA — Agendar (wizard com login) ─────────────── */}
        <div className="mt-16">
          <AgendamentoWizard />
        </div>

      </div>
    </div>
  );
}
