'use client';

import * as React from 'react';
import {
  BadgeCheck,
  ClipboardList,
  type LucideIcon,
  Minus,
  Package,
  Plus,
  Stethoscope,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { WhatsApp } from '@/components/shared/icons';

const WHATSAPP_URL = 'https://wa.me/5511932047360';

type Etapa = {
  passo: string;
  icon: LucideIcon;
  tituloTopo: string;
  tituloBase: string;
  descricao: string;
};

const ETAPAS: Etapa[] = [
  {
    passo: '1',
    icon: Stethoscope,
    tituloTopo: 'Consulta',
    tituloBase: 'Médica',
    descricao:
      'O primeiro passo é a consulta com um médico parceiro habilitado, que avalia seu caso e indica o melhor caminho, sem pressa e sem julgamento.',
  },
  {
    passo: '2',
    icon: ClipboardList,
    tituloTopo: 'Receita',
    tituloBase: 'Médica',
    descricao:
      'Com a indicação, o médico emite a receita e a prescrição necessárias para dar sequência ao seu tratamento.',
  },
  {
    passo: '3',
    icon: BadgeCheck,
    tituloTopo: 'Autorização da',
    tituloBase: 'Anvisa',
    descricao:
      'Solicitamos a autorização de importação junto à ANVISA (RDC 660). A Be4Hope te acompanha em todo o processo.',
  },
  {
    passo: '4',
    icon: Package,
    tituloTopo: 'Importação e',
    tituloBase: 'Entrega',
    descricao:
      'Com tudo aprovado, o produto é importado e entregue na sua casa, com acompanhamento da nossa equipe.',
  },
];

export function SeuCaminho() {
  const [expanded, setExpanded] = React.useState<number | null>(null);

  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Cabeçalho */}
        <div className="grid items-end gap-6 lg:grid-cols-2 lg:gap-16">
          <h2 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            Seu caminho, <span className="text-accent-italic">em 4 passos simples</span>
          </h2>
          <div className="lg:text-right">
            <span className="bg-secondary/10 text-secondary inline-block rounded-full px-3 py-1 text-xs font-semibold">
              Processos
            </span>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Entenda cada uma das nossas etapas.
            </p>
          </div>
        </div>

        {/* Cards */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {ETAPAS.map((etapa, index) => {
            const Icon = etapa.icon;
            const aberto = expanded === index;
            return (
              <div
                key={etapa.passo}
                className="flex flex-col rounded-2xl bg-muted/40 p-5 ring-1 ring-foreground/5"
              >
                <span className="bg-primary/10 text-primary mb-4 w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold">
                  Etapa {etapa.passo}
                </span>
                <div className="bg-primary/10 mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
                  <Icon size={24} className="text-primary" />
                </div>
                <p className="text-muted-foreground text-sm">{etapa.tituloTopo}</p>
                <h3 className="font-display text-2xl font-bold tracking-tight">
                  {etapa.tituloBase}
                </h3>

                <div
                  className={cn(
                    'grid transition-all duration-300 ease-in-out',
                    aberto ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                      {etapa.descricao}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setExpanded(aberto ? null : index)}
                  className="text-primary mt-4 inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary/80"
                  aria-expanded={aberto}
                >
                  {aberto ? <Minus size={16} /> : <Plus size={16} />}
                  {aberto ? 'Menos informações' : 'Mais informações'}
                </button>
              </div>
            );
          })}

          {/* Card CTA — Iniciar jornada */}
          <div className="bg-[#16a34a] text-primary-foreground flex flex-col items-center justify-center gap-5 rounded-2xl p-6 text-center sm:col-span-2 lg:col-span-1">
            <p className="font-display text-lg leading-snug font-bold text-white">
              Uma jornada de sucesso 100% humanizada com quem entende!
            </p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-secondary bg-white rounded-full cursor-pointer transition-colors hover:bg-white/90"
            >
              Iniciar jornada
              <WhatsApp size={16} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
