import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { HistoriasContent } from './_components/historias-content';

export const metadata: Metadata = {
  title: 'Histórias Reais — Medicina Endocanabinóide',
  description:
    'Conheça histórias inspiradoras e jornadas reais de pacientes acolhidos pela Be4Hope no tratamento com a Medicina Endocanabinóide.',
};

export default function MundoEndocanabinoidePage() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center mb-16">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Histórias que{' '}
            <span className="text-accent-italic">importam.</span>
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            Casos reais, pesquisas atuais e bastidores da Be4Hope — escritos pela nossa equipe e por quem vive cada acolhimento.
          </p>
        </div>

        {/* Componente Interativo de Histórias */}
        <HistoriasContent />

        {/* CTA */}
        <div className="mt-24 text-center border-t border-border/60 pt-16">
          <h2 className="font-display text-2xl font-bold">
            Quer saber se o tratamento é{' '}
            <span className="text-accent-italic">indicado</span> para o seu caso?
          </h2>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/#condicoes">
              <Button
                size="lg"
                className="bg-secondary hover:bg-secondary/90 text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-300 px-8 h-12 flex items-center justify-center gap-2 border-0 text-sm cursor-pointer"
                nativeButton={false}
              >
                Fazer acolhimento gratuito
                <ChevronRight size={16} />
              </Button>
            </Link>
            <Link href="/contato">
              <Button
                variant="outline"
                size="lg"
                className="border border-secondary/30 bg-transparent text-secondary font-semibold rounded-full shadow-sm hover:shadow-md transition-all duration-300 px-8 h-12 flex items-center justify-center gap-2 text-sm cursor-pointer"
                nativeButton={false}
              >
                Fale conosco
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
