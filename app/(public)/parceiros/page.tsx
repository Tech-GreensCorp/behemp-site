import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Leaf01Icon,
  ArrowRight01Icon,
  LinkSquare01Icon,
} from '@hugeicons/core-free-icons';

export const metadata: Metadata = {
  title: 'Parceiros',
  description:
    'Conheça os parceiros da Be4Hope na missão de democratizar a medicina endocanabinóide no Brasil.',
};

export default function ParceirosPage() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Nossos{' '}
            <span className="text-accent-italic">parceiros.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Trabalhamos junto com empresas comprometidas em levar
            tratamentos de qualidade para quem mais precisa.
          </p>
        </div>

        {/* Greens */}
        <Card className="mt-16 overflow-hidden border-0 shadow-lg">
          <CardContent className="p-0">
            <div className="grid md:grid-cols-2">
              {/* Info */}
              <div className="flex flex-col justify-center p-8 sm:p-12">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10">
                  <HugeiconsIcon icon={Leaf01Icon} size={24} className="text-secondary" />
                </div>
                <h2 className="font-display text-2xl font-bold">Greens</h2>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  A <strong>Greens</strong> é nossa parceira estratégica no
                  fornecimento de produtos canabinóides de alta qualidade.
                  Com rigoroso controle de qualidade e certificações
                  internacionais, garantimos que nossos pacientes tenham
                  acesso aos melhores produtos disponíveis no mercado.
                </p>
                <ul className="mt-6 space-y-2">
                  {[
                    'Produtos com laudos de análise verificados',
                    'Rastreabilidade completa da produção',
                    'Conformidade com regulamentação Anvisa',
                    'Suporte dedicado aos pacientes Be4Hope',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Button variant="outline" className="btn-pill gap-2" nativeButton={false}>
                    Saiba mais sobre a Greens
                    <HugeiconsIcon icon={LinkSquare01Icon} size={16} />
                  </Button>
                </div>
              </div>

              {/* Visual — gradiente placeholder */}
              <div className="gradient-moss flex items-center justify-center p-12">
                <div className="text-center">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-white/20">
                    <HugeiconsIcon icon={Leaf01Icon} size={48} className="text-white" />
                  </div>
                  <p className="mt-6 text-lg font-semibold text-white">
                    Greens
                  </p>
                  <p className="mt-1 text-sm text-white/70">
                    Produtos canabinóides de excelência
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Parceria */}
        <div className="mt-16 text-center">
          <h2 className="font-display text-2xl font-bold">
            Quer ser <span className="text-accent-italic">parceiro?</span>
          </h2>
          <div className="mt-6">
            <Link href="/entre-em-contato">
              <Button
                className="btn-pill gap-2 bg-primary px-8 text-primary-foreground hover:bg-primary/90"
                nativeButton={false}
              >
                Entre em contato
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
