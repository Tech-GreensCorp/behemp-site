import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Baby,
  Brain,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  Shield,
  Smile,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
export const metadata: Metadata = {
  title: 'Histórias — Medicina Endocanabinóide',
  description:
    'Conheça as áreas de atuação da medicina endocanabinóide: dor crônica, saúde mental, neurologia, oncologia e mais.',
};

const AREAS = [
  {
    icon: Stethoscope,
    titulo: 'Dor Crônica',
    descricao:
      'O sistema endocanabinóide atua diretamente nos receptores de dor. Tratamentos com CBD e THC demonstram eficácia significativa no manejo de fibromialgia, artrite reumatóide, dor neuropática e dores musculoesqueléticas crônicas.',
  },
  {
    icon: HeartPulse,
    titulo: 'Saúde Mental',
    descricao:
      'Estudos clínicos mostram que canabinóides podem auxiliar no tratamento de ansiedade generalizada, depressão, TEPT e insônia, promovendo equilíbrio emocional com menos efeitos colaterais.',
  },
  {
    icon: Brain,
    titulo: 'Neurologia',
    descricao:
      'A medicina endocanabinóide é reconhecida no tratamento de epilepsia refratária, esclerose múltipla, doença de Parkinson e espasticidade. O CBD possui propriedades neuroprotetoras comprovadas.',
  },
  {
    icon: Shield,
    titulo: 'Oncologia',
    descricao:
      'No suporte oncológico, os canabinóides auxiliam no controle de náuseas e vômitos induzidos por quimioterapia, estimulam o apetite e melhoram a qualidade de vida durante o tratamento.',
  },
  {
    icon: Baby,
    titulo: 'Pediatria',
    descricao:
      'Com protocolos rigorosos, a medicina endocanabinóide pode ser indicada para crianças com epilepsia refratária, autismo e condições neurológicas que não responderam a tratamentos convencionais.',
  },
  {
    icon: Sparkles,
    titulo: 'Dermatologia',
    descricao:
      'Canabinóides tópicos e orais demonstram propriedades anti-inflamatórias no tratamento de psoríase, dermatite atópica, acne e outras condições dermatológicas crônicas.',
  },
  {
    icon: Dumbbell,
    titulo: 'Saúde Esportiva',
    descricao:
      'Atletas encontram no CBD um aliado para recuperação muscular, controle de inflamações, melhora do sono e redução da ansiedade pré-competição.',
  },
  {
    icon: Smile,
    titulo: 'Odontologia',
    descricao:
      'Na odontologia, canabinóides são utilizados no manejo da dor orofacial crônica, DTM, bruxismo e como auxiliar no controle da ansiedade em procedimentos.',
  },
];

export default function MundoEndocanabinoidePage() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Histórias que{' '}
            <span className="text-accent-italic">importam.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Casos reais, pesquisas atuais e bastidores da Be4Hope —
            escritos pela nossa equipe a por quem vive cada
            acolhimento.
          </p>
        </div>

        {/* Grid de especialidades */}
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {AREAS.map((area) => (
            <Card
              key={area.titulo}
              className="group border-0 bg-card shadow-sm transition-all hover:shadow-md"
            >
              <CardContent className="p-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted transition-colors group-hover:bg-primary/10">
                  {(() => { const DynIcon = area.icon; return <DynIcon size={24} />; })()}
                </div>
                <h3 className="font-display text-lg font-semibold">{area.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {area.descricao}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <h2 className="font-display text-2xl font-bold">
            Quer saber se o tratamento é{' '}
            <span className="text-accent-italic">indicado</span> para o seu caso?
          </h2>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/triagem">
              <Button
                size="lg"
                className="btn-pill gap-2 bg-primary px-8 text-primary-foreground hover:bg-primary/90"
                nativeButton={false}
              >
                Fazer triagem gratuita
                <ChevronRight size={16} />
              </Button>
            </Link>
            <Link href="/entre-em-contato">
              <Button
                variant="outline"
                size="lg"
                className="btn-pill gap-2 px-8"
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
