import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar03Icon,
  UserCheck01Icon,
  Clock01Icon,
  ArrowRight01Icon,
  Video01Icon,
} from '@hugeicons/core-free-icons';

export const metadata: Metadata = {
  title: 'Agendar Consulta',
  description:
    'Agende sua consulta com médicos especialistas em medicina endocanabinóide. Atendimento online via Google Meet.',
};

const INFO_CARDS = [
  {
    icon: Video01Icon,
    titulo: '100% Online',
    descricao: 'Consulta por videoconferência via Google Meet, sem sair de casa',
  },
  {
    icon: Clock01Icon,
    titulo: 'Duração: ~60 min',
    descricao: 'Tempo dedicado para avaliação completa e orientação personalizada',
  },
  {
    icon: UserCheck01Icon,
    titulo: 'Confirmação Imediata',
    descricao: 'Receba a confirmação e link do Meet por e-mail na hora',
  },
];

export default function AgendamentoPage() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
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

        {/* Informações */}
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {INFO_CARDS.map((card) => (
            <Card key={card.titulo} className="border-0 bg-card shadow-sm">
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                  <HugeiconsIcon icon={card.icon} size={24} className="text-foreground" />
                </div>
                <h3 className="font-display text-sm font-semibold">{card.titulo}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{card.descricao}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Formulário de agendamento */}
        <Card className="mt-12 border-0 shadow-xl">
          <CardContent className="p-8 sm:p-12">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold">
                Sistema de <span className="text-accent-italic">agendamento</span>
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
                O sistema completo de agendamento com escolha de médico, data/hora
                e integração com Google Calendar será ativado assim que a
                autenticação estiver configurada.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link href="/triagem">
                  <Button
                    size="lg"
                    className="btn-pill gap-2 bg-primary px-8 text-primary-foreground hover:bg-primary/90"
                    nativeButton={false}
                  >
                    Fazer triagem primeiro
                    <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                  </Button>
                </Link>
                <Link href="/entre-em-contato">
                  <Button variant="outline" size="lg" className="btn-pill gap-2 px-8" nativeButton={false}>
                    Entrar em contato
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
