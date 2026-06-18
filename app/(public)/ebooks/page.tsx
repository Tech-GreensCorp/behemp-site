import type { Metadata } from 'next';
import { BookOpen } from 'lucide-react';
import { EbooksContent, EbooksCta } from './_components/ebooks-content';

export const metadata: Metadata = {
  title: 'Ebooks — Be4Hope',
  description:
    'Materiais educativos, guias clínicos e ebooks gratuitos sobre Medicina Endocanabinóide desenvolvidos pela equipe Be4Hope.',
};

export default function EbooksPage() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">

        {/* ── Hero ───────────────────────────────────────────── */}
        <div className="mx-auto max-w-3xl text-center mb-16">
          {/* Badge */}
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-4 py-1.5 text-xs font-semibold text-secondary uppercase tracking-widest mb-6">
            <BookOpen size={12} />
            Biblioteca gratuita
          </span>

          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Conhecimento que{' '}
            <span className="text-accent-italic">liberta.</span>
          </h1>

          <p className="mt-6 text-base leading-relaxed text-muted-foreground max-w-xl mx-auto">
            Ebooks, guias clínicos e materiais educativos desenvolvidos pela nossa equipe de especialistas
            — tudo gratuito para pacientes e profissionais de saúde.
          </p>
        </div>

        {/* ── Stats strip ──────────────────────────────────── */}
        <div className="mb-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          {[
            { value: '6+', label: 'Ebooks em produção' },
            { value: '100%', label: 'Gratuitos' },
            { value: '3', label: 'Especialidades' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-border bg-card px-4 py-5 text-center shadow-sm"
            >
              <p className="font-display text-2xl font-bold text-secondary">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ── Interactive content ──────────────────────────── */}
        <EbooksContent />

        {/* ── CTA ──────────────────────────────────────────── */}
        <EbooksCta />

      </div>
    </div>
  );
}
