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
            Ebooks, guias clínicos e materiais educativos desenvolvidos pela nossa equipe de especialistas, tudo gratuito para pacientes e profissionais de saúde.
          </p>
        </div>

        {/* ── Interactive content ──────────────────────────── */}
        <EbooksContent />

        {/* ── CTA ──────────────────────────────────────────── */}
        <EbooksCta />

      </div>
    </div>
  );
}
