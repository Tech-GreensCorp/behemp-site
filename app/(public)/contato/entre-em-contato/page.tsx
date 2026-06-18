import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FormularioContato } from './_components/formulario-contato';
import {
  Clock,
  Mail,
  MapPin,
  Smartphone,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Contato',
  description:
    'Entre em contato com a equipe Be4Hope. WhatsApp, e-mail ou formulário.',
};

const FAQ = [
  {
    pergunta: 'O tratamento com canabinóides é legal no Brasil?',
    resposta:
      'Sim. A Anvisa regulamenta o uso de produtos à base de cannabis para fins medicinais no Brasil. É necessário receita médica e, em alguns casos, autorização da Anvisa para importação. A Be4Hope gerencia toda essa documentação para você.',
  },
  {
    pergunta: 'Preciso de receita médica para iniciar o tratamento?',
    resposta:
      'Sim. A receita é emitida pelo médico especialista durante a consulta. Nossos médicos são habilitados para prescrever produtos à base de canabinóides conforme as normas da Anvisa.',
  },
  {
    pergunta: 'Como funciona a consulta online?',
    resposta:
      'A consulta é realizada por videoconferência via Google Meet. Após o agendamento, você recebe por e-mail o link da consulta e um lembrete automático. A duração média é de 60 minutos.',
  },
  {
    pergunta: 'Quais condições podem ser tratadas?',
    resposta:
      'A medicina endocanabinóide é indicada para diversas condições, incluindo dor crônica, epilepsia, ansiedade, depressão, insônia, esclerose múltipla, entre outras. Nossos médicos avaliarão seu caso individualmente.',
  },
  {
    pergunta: 'Meus dados são protegidos?',
    resposta:
      'Sim. A Be4Hope segue rigorosamente a LGPD (Lei Geral de Proteção de Dados). Seus dados clínicos são criptografados e acessíveis apenas pelo seu médico responsável.',
  },
];

const CANAIS = [
  {
    icon: Smartphone,
    titulo: 'WhatsApp',
    info: '+55 (11) 93204-7360',
    detalhe: 'Resposta em até 4h úteis',
    href: 'https://wa.me/5511932047360',
  },
  {
    icon: Mail,
    titulo: 'E-mail',
    info: 'hello@be4hope.org',
    detalhe: 'Resposta em até 24h',
    href: 'mailto:hello@be4hope.org',
  },
  {
    icon: MapPin,
    titulo: 'Localização',
    info: 'São Paulo, SP — Brasil',
    detalhe: 'Atendimento 100% online',
    href: undefined,
  },
];

export default function ContatoPage() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Vamos
              <br />
              <span className="text-accent-italic">conversar?</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
              Estamos aqui para ajudar. Escolha o canal mais confortável para você
              ou envie uma mensagem diretamente.
            </p>
          </div>
          <div className="sm:mb-2 shrink-0">
            <Link href="/#condicoes">
              <Button
                size="lg"
                className="bg-[#16a34a] hover:bg-[#148f43] text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-300 px-8 h-12 inline-flex items-center justify-center gap-2 border-0 text-sm cursor-pointer"
                nativeButton={false}
              >
                Iniciar acolhimento
                <ChevronRight size={16} />
              </Button>
            </Link>
          </div>
        </div>

        {/* Grid de canais */}
        <div className="grid gap-4 sm:grid-cols-3">
          {CANAIS.map((canal) => {
            const cardContent = (
              <Card className="group h-full border-0 bg-card shadow-sm transition-all hover:shadow-md">
                <CardContent className="flex items-start gap-4 p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted transition-colors group-hover:bg-primary/10">
                    {(() => { const DynIcon = canal.icon; return <DynIcon size={20} />; })()}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{canal.titulo}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{canal.info}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/70">
                      <Clock size={12} />
                      {canal.detalhe}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );

            return canal.href ? (
              <Link key={canal.titulo} href={canal.href} target="_blank" rel="noopener noreferrer">
                {cardContent}
              </Link>
            ) : (
              <div key={canal.titulo}>{cardContent}</div>
            );
          })}
        </div>

        {/* Formulário + FAQ */}
        <div className="mt-20 grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Formulário (componente client) */}
          <div>
            <h2 className="font-display text-2xl font-bold">
              Prefere nos <span className="text-accent-italic">escrever?</span>
            </h2>
            <p className="mt-2 mb-6 text-sm text-muted-foreground">
              Preencha o formulário e nossa equipe responderá o mais breve possível.
            </p>
            <FormularioContato />
          </div>

          {/* FAQ */}
          <div>
            <h2 className="font-display text-2xl font-bold">
              Perguntas <span className="text-accent-italic">frequentes.</span>
            </h2>
            <p className="mt-2 mb-6 text-sm text-muted-foreground">
              Respostas rápidas para as dúvidas mais comuns.
            </p>

            <Accordion type="single" collapsible className="space-y-3">
              {FAQ.map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`faq-${index}`}
                  className="rounded-xl border-0 bg-card px-6 shadow-sm"
                >
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                    {item.pergunta}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {item.resposta}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </div>
  );
}
