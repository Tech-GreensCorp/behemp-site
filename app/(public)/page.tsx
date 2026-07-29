import type { Metadata } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PatologiasPicker } from '@/components/shared/patologias-picker';
import { SeuCaminho } from '@/components/shared/seu-caminho';
import { ScrollToSection } from '@/components/shared/scroll-to-section';
import { Counter } from '@/components/shared/counter';
import { MedicosCarousel } from '@/components/shared/medicos-carousel';
import { listarMedicosPublico } from '@/app/(public)/_actions/agendamento';
import {
  Brain,
  ChevronRight,
  Globe,
  HandHeart,
  Heart,
  HeartHandshake,
  HeartPulse,
  Shield,
  Star,
  Stethoscope,
  Tag,
  Users,
  Users2,
} from 'lucide-react';
export const metadata: Metadata = {
  // O template do layout adiciona "| Be4Hope" automaticamente.
  // title resultante: "Você não precisa enfrentar isso sozinho | Be4Hope"
  title: 'Você não precisa enfrentar isso sozinho',
  description:
    'Há mais de duas décadas conectando pessoas ao cuidado com Medicina Endocanabinóide, responsabilidade, acolhimento e do seu lado em cada etapa.',
  openGraph: {
    title: 'Você não precisa enfrentar isso sozinho | Be4Hope',
    description:
      'Há mais de duas décadas conectando pessoas ao cuidado com Medicina Endocanabinóide, responsabilidade, acolhimento e do seu lado em cada etapa.',
    url: 'https://be4hope.org',
  },
};

/* ── Dados ──────────────────────────────────────────── */

const STATS = [
  { valor: '24', numeric: 24, suffix: '', label: 'anos de histórias reais' },
  { valor: 'ONG', numeric: null, suffix: '', label: 'sem fins lucrativos' },
  { valor: '26', numeric: 26, suffix: '', label: 'estados atendidos' },
  { valor: '8.000+', numeric: 8000, suffix: '+', label: 'Pacientes atendidos' },
];

const ESPECIALIDADES = [
  {
    icon: Brain,
    titulo: 'Neurologia',
    descricao: 'Epilepsia, dor neuropática e esclerose múltipla',
  },
  {
    icon: HeartPulse,
    titulo: 'Saúde Mental',
    descricao: 'Ansiedade, depressão e transtorno de estresse',
  },
  {
    icon: Stethoscope,
    titulo: 'Dor Crônica',
    descricao: 'Fibromialgia, artrite e dores musculoesqueléticas',
  },
  {
    icon: Shield,
    titulo: 'Oncologia',
    descricao: 'Suporte ao tratamento oncológico e efeitos colaterais',
  },
];

const TESTEMUNHOS = [
  {
    inicial: 'M',
    nome: 'Maria S., 47',
    local: 'Campinas',
    sobre: 'sobre o acolhimento',
    texto:
      'Eu tinha medo de que fosse complicado ou ilegal. O que mais me marcou foi não ter ninguém me empurrando nada, só me explicando, no meu tempo. Me senti acolhida.',
  },
  {
    inicial: 'R',
    nome: 'Rita L., 39',
    local: 'Curitiba',
    sobre: 'sobre o atendimento',
    texto:
      'A equipe me explicou cada passo com paciência, sem pressa e sem pressão de venda. Pela primeira vez me senti cuidada, não vendida.',
  },
  {
    inicial: 'J',
    nome: 'João P., 52',
    local: 'São Paulo',
    sobre: 'sobre a jornada',
    texto:
      'Achei que ia ser burocrático e frio. Foi o contrário: humano do começo ao fim, com gente de verdade me acompanhando.',
  },
];


const FAQ = [
  {
    pergunta: 'É legal usar Medicina Endocanabinoide no Brasil?',
    resposta:
      'Sim. O acesso é regulamentado pela ANVISA (RDC 660), com receita médica e autorização oficial de importação.',
  },
  {
    pergunta: 'Preciso de laudo ou diagnóstico pronto antes?',
    resposta:
      'Não necessariamente. A triagem é o primeiro passo: você conta o que sente e o médico avalia, na consulta, o que faz sentido para você.',
  },
  {
    pergunta: 'Quanto custa o processo?',
    resposta:
      'Começar é gratuito, a triagem não tem custo nem compromisso. Como associação sem fins lucrativos, os valores de consulta e autorização são apresentados com transparência antes de qualquer decisão.',
  },
  {
    pergunta: 'E se o médico não indicar?',
    resposta:
      'Então o processo para por aí, você não paga por produto que não foi prescrito. Quem decide é sempre o médico.',
  },
  {
    pergunta: 'Nunca usei antes. É seguro?',
    resposta:
      'A avaliação é individual e feita por médico habilitado. A indicação e a posologia são definidas exclusivamente por ele, com acompanhamento em cada etapa.',
  },
  {
    pergunta: 'Minha família ou empresa fica sabendo?',
    resposta:
      'Não. Seus dados são tratados com sigilo e conforme a LGPD. O cuidado é seu, no seu tempo.',
  },
  {
    pergunta: 'Quanto tempo até chegar em casa?',
    resposta:
      'Após a consulta e a autorização da ANVISA, o produto é entregue na sua casa, com acompanhamento da nossa equipe.',
  },
  {
    pergunta: 'Vocês me acompanham depois?',
    resposta:
      'Sim. O acolhimento continua depois do início, você não fica sozinho.',
  },
];

/* ── Componente ─────────────────────────────────────── */

export default async function HomePage() {
  noStore();
  const medicosResult = await listarMedicosPublico();
  const medicosData = (medicosResult.sucesso && medicosResult.dados) ? medicosResult.dados : [];

  return (
    <>
      {/* ── Hero — Fundação Be4Hope (editorial + institucional) ────── */}
      <section className="relative overflow-hidden pt-4 lg:pt-8">
        <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8 lg:pb-16">
          {/* ── Palco principal: texto lateral + composição central ── */}
          <div className="relative grid gap-8 lg:grid-cols-12 lg:gap-4">
            {/* ── Coluna esquerda: título + subtítulo + pilares ── */}
            <div className="mt-6 vanimate-fade-up relative z-20 lg:order-none lg:col-span-4 lg:mt-14 lg:pt-2">
              <h1 className="font-display text-[2rem] leading-[1.05] font-bold tracking-tight text-foreground sm:text-4xl lg:text-[3.2rem] lg:leading-[1.02]">
                Cuidar é o
                <br />
                <span className="text-primary">maior presente</span>
                <br />
                que você pode
                <br />
                dar para{' '}
                <span className="relative inline-block whitespace-nowrap">
                  quem ama

                  <svg
                    aria-hidden="true"
                    viewBox="0 0 250 28"
                    className="pointer-events-none absolute -bottom-3 left-0 w-full text-primary"
                    fill="none"
                  >
                    <path
                      d="M6 16 C45 26,90 6,130 16 S210 24,244 14"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>

              <p className="text-foreground mt-7 max-w-md text-[15px] leading-relaxed">
                Seja o presente que alguém precisa
                <br />
                para <strong className="font-semibold">viver com mais saúde.</strong>
              </p>

              {/* Pilares — 4 ícones em círculo (paleta e ícones fiéis ao modelo) */}
              <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 sm:gap-x-3 max-w-md lg:mt-10">
                {[
                  { icon: Heart, titulo: 'Presença', desc: 'que acolhe.' },
                  { icon: Users, titulo: 'Apoio', desc: 'que fortalece.' },
                  { icon: HandHeart, titulo: 'Cuidado', desc: 'que transforma.' },
                  { icon: Users2, titulo: 'Rede de apoio', desc: 'que caminha junto com você.' },
                ].map((p) => {
                  const DynIcon = p.icon;
                  return (
                    <div key={p.titulo} className="flex flex-col items-start">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#FBEDE5] text-primary shadow-[inset_0_0_0_1px_rgba(234,84,41,0.08)]">
                        <DynIcon size={22} strokeWidth={1.75} />
                      </div>
                      <p className="text-foreground text-sm font-semibold leading-tight">{p.titulo}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs leading-tight">{p.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Palco central: "b." + pessoa + decorativos ── */}
            <div className="animate-fade-up delay-100 relative lg:col-span-5">
              <div className="relative mx-auto h-[420px] w-full max-w-md sm:h-[500px] lg:h-[600px] lg:max-w-none">

                {/* Fundo "be." gigante */}
                <span
                  aria-hidden="true"
                  className="font-display absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-[56%] select-none whitespace-nowrap text-[14rem] leading-[0.75] font-bold text-primary/95 sm:text-[20rem] lg:text-[32rem]"
                  style={{ letterSpacing: '-0.08em' }}
                >
                  be.
                </span>

                {/* Elementos abstratos atrás */}
                <div className="absolute right-4 top-32 z-[1] h-14 w-14 rounded-full bg-primary/20 sm:top-40 sm:h-20 sm:w-20" />
                <div className="absolute bottom-20 left-6 z-[1] h-10 w-10 rounded-full bg-[#F59E0B]/30 sm:left-12 sm:h-14 sm:w-14" />


                {/* Bonequinho amarelo */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 64 64"
                  className="absolute right-0 top-[32%] z-[5] h-20 w-20 rotate-[-12deg] drop-shadow-lg sm:h-28 sm:w-28 lg:right-2 lg:h-32 lg:w-32"
                >
                  <circle cx="32" cy="32" r="30" fill="#F59E0B" />
                  <circle cx="24" cy="27" r="3" fill="#1A1612" />
                  <circle cx="40" cy="27" r="3" fill="#1A1612" />
                  <path
                    d="M20 38 Q32 52 44 38"
                    stroke="#1A1612"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>


                {/* Bonequinho azul */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 64 64"
                  className="absolute right-6 top-[55%] z-[5] h-16 w-16 rotate-[14deg] drop-shadow-lg sm:right-10 sm:h-24 sm:w-24 lg:right-8 lg:h-28 lg:w-28"
                >
                  <circle cx="32" cy="32" r="30" fill="#2563EB" />
                  <circle cx="24" cy="27" r="3" fill="#F5F2ED" />
                  <circle cx="40" cy="27" r="3" fill="#F5F2ED" />
                  <path
                    d="M20 38 Q32 52 44 38"
                    stroke="#F5F2ED"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>


                {/* Foto principal */}
                <div className="absolute inset-0 z-10">
                  <Image
                    src="/images/home/hero-be-pessoa.png"
                    alt="Mulher vestindo moletom Be4Hope — presença que acolhe"
                    fill
                    className="object-contain object-bottom"
                    sizes="(max-width: 1024px) 90vw, 45vw"
                    priority
                    quality={90}
                  />
                </div>


                {/* Corações */}
                <Heart
                  aria-hidden="true"
                  size={40}
                  className="absolute left-2 top-6 z-20 -rotate-12 fill-primary text-primary drop-shadow-sm sm:top-8 sm:h-[52px] sm:w-[52px]"
                  strokeWidth={0}
                />

                <Heart
                  aria-hidden="true"
                  size={22}
                  className="absolute right-16 top-8 z-20 rotate-12 fill-primary text-primary sm:right-20 sm:top-10 sm:h-7 sm:w-7"
                  strokeWidth={0}
                />

                <Heart
                  aria-hidden="true"
                  size={18}
                  className="absolute right-2 top-20 z-20 rotate-6 fill-[#F08A6E] text-[#F08A6E] sm:top-24 sm:h-[22px] sm:w-[22px]"
                  strokeWidth={0}
                />

              </div>
            </div>

            {/* ── Coluna direita: link + institucional ── */}
            <div className="lg:pl-10 animate-fade-up delay-200 relative z-20 flex flex-col items-start lg:col-span-3 lg:items-end lg:pt-2">
              {/* Link be4hope.org */}
              {/* <div className="flex justify-start lg:justify-end">
                <a
                  href="https://be4hope.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-transparent px-4 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                >
                  <Globe size={14} strokeWidth={2} />
                  be4hope.org
                </a>
              </div> */}

              <div className="mt-4 max-w-sm border-l-2 border-primary/30 pl-6 lg:mt-10">
                <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  Institucional
                </span>

                <h2 className="font-display mt-3 text-[2rem] leading-[0.95] font-bold tracking-tight text-foreground sm:text-[2.4rem]">
                  Fundação
                  <br />
                  <span className="text-primary">Be4hope</span>
                </h2>

                <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
                  Apoio, acolhimento e acesso a tratamentos com Medicina
                  Endocanabinóide para pacientes que necessitam de acompanhamento
                  e suporte da Fundação.
                </p>

                <div className="mt-6 h-px w-20 bg-primary/30" />

                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Acolhimento • Tratamento • Esperança
                </p>
              </div>
            </div>
          </div>

          {/* ── Cards flutuantes — sobrepõem a base da pessoa ─────── */}
          <div className="animate-fade-up delay-300 relative z-30 mt-8 grid gap-4 sm:mt-10 sm:grid-cols-5 lg:-mt-24 lg:grid-cols-12 lg:gap-4 ">
            {/* Card 1 — descrição da Fundação */}
            <div className="rounded-2xl border border-border bg-white/95 p-5 shadow-lg backdrop-blur-sm sm:col-span-3 lg:col-span-4 lg:col-start-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FBEDE5] text-primary">
                  <HandHeart size={22} strokeWidth={1.75} />
                </div>
                <p className="text-foreground text-sm leading-relaxed">
                  A <strong className="font-semibold">Fundação Be4Hope</strong> dá acesso a produtos com
                  Medicina Endocanabinóide para pacientes que precisam do tratamento e não têm condições
                  de adquirir.
                </p>
              </div>
            </div>

            {/* Card 2 — benefícios (dois itens divididos) */}
            <div className="rounded-2xl border border-border bg-white/95 p-5 shadow-lg backdrop-blur-sm sm:col-span-2 lg:col-span-3">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FBEDE5] text-primary">
                    <Tag size={18} strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase">
                      Produtos com até
                    </p>
                    <p className="text-foreground text-sm font-bold leading-tight tracking-tight uppercase">
                      80% de desconto
                    </p>
                  </div>
                </div>
                <div className="border-t border-border/60" />
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FBEDE5] text-primary">
                    <HandHeart size={18} strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase">
                      Por triagem até
                    </p>
                    <p className="text-foreground text-sm font-bold leading-tight tracking-tight uppercase">
                      Disponíveis gratuitamente
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── CTAs — mantém acesso ao fluxo ─────────────────── */}
          {/* <div className="animate-fade-up delay-400 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <ScrollToSection
              targetId="condicoes"
              className="w-full sm:w-auto bg-[#16a34a] hover:bg-[#148f43] text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-200 px-8 h-12 flex items-center justify-center gap-2 border-0 text-sm cursor-pointer animate-active-pulse"
            >
              Iniciar acolhimento
              <ChevronRight size={16} />
            </ScrollToSection>
            <Link
              href="/#quem-somos"
              className="w-full sm:w-auto border border-secondary/30 bg-transparent hover:bg-secondary/5 text-secondary font-semibold rounded-full shadow-sm hover:shadow-md transition-all duration-300 px-8 h-12 flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              Conhecer a Be4Hope
            </Link>
          </div> */}
        </div>
      </section>

      {/* ── Stats Bar ────────────────────────────────────── */}
      <section className="border-border bg-background border-y">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="divide-border grid grid-cols-2 divide-x sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="px-6 py-8 text-center">
                <p className="font-display text-primary text-3xl font-bold sm:text-4xl">
                  {stat.numeric !== null ? (
                    <Counter target={stat.numeric} suffix={stat.suffix} />
                  ) : (
                    stat.valor
                  )}
                </p>
                <p className="text-muted-foreground mt-1 text-xs font-medium tracking-[0.15em] uppercase">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Seletor de patologias ─────────────────────────── */}
      <PatologiasPicker />

      {/* ══════════════════════════════════════════════════════════
          QUEM SOMOS — Seção institucional completa
      ══════════════════════════════════════════════════════════ */}

      {/* ── 1. Quem Somos — Introdução ──────────────────────── */}
      <section id="quem-somos" className="py-16 lg:py-24 scroll-mt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-20">
            {/* Texto principal */}
            <div>
              <p className="text-primary mb-4 text-xs font-semibold tracking-[0.25em] uppercase">
                Desde 2002
              </p>
              <h2 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
                Há mais de duas décadas <span className="text-accent-italic">cuidando</span> de quem
                mais precisa.
              </h2>
              <div className="text-muted-foreground mt-8 space-y-5 text-base leading-relaxed">
                <p className="drop-cap">
                  A <strong className="text-foreground">Be4Hope</strong> é uma{' '}
                  <strong className="text-foreground">
                    organização filantrópica sem fins lucrativos
                  </strong>{' '}
                  que, desde 2002, acolhe e apoia famílias e indivíduos com condições neurológicas,
                  patologias e doenças crônicas. Nosso trabalho é cuidar de quem precisa, oferecendo
                  apoio humano, acesso a{' '}
                  <strong className="text-foreground">tratamentos seguros</strong> e informações de
                  confiança.
                </p>
                <p>
                  Acreditamos que{' '}
                  <strong className="text-foreground">saúde é um direito de todos</strong>, não
                  importa onde você mora ou qual é a sua condição financeira. Por isso, atuamos para
                  garantir que <strong className="text-foreground">medicamentos essenciais</strong>{' '}
                  cheguem de forma justa e legal até quem realmente precisa.
                </p>
                <p>
                  Nosso sistema de distribuição é{' '}
                  <strong className="text-foreground">legalizado, transparente e eficiente</strong>,
                  feito com responsabilidade e muito respeito à vida. Também apoiamos a{' '}
                  <strong className="text-foreground">pesquisa científica</strong>, porque
                  acreditamos no poder da informação e da inovação para mudar realidades.
                </p>
                <p className="text-foreground text-base font-medium">
                  Somos uma rede de cuidado, esperança e transformação. Somos a Be4Hope.
                </p>
              </div>

              {/* CTA — Falar com especialista */}
              <div className="mt-8 flex justify-center">
                <ScrollToSection
                  targetId="condicoes"
                  className="bg-[#16a34a] hover:bg-[#148f43] text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-300 px-8 h-12 flex items-center justify-center gap-2 border-0 text-sm cursor-pointer animate-active-pulse"
                >
                  Iniciar acolhimento com especialista
                  <ChevronRight size={16} />
                </ScrollToSection>
              </div>

            </div>

            {/* Vídeo — Quem Somos */}
            <div className="flex flex-col gap-6">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                >
                  <source src="/images/home/shutterstock_1076126774.mp4" type="video/mp4" />
                </video>
              </div>

              {/* Cards de especialidade */}
              <div className="grid gap-4 sm:grid-cols-2 max-w-sm mx-auto sm:max-w-none">
                {ESPECIALIDADES.map((esp) => (
                  <Card
                    key={esp.titulo}
                    className="group bg-card border-0 shadow-sm transition-all hover:shadow-md"
                  >
                    <CardContent className="p-6">
                      <div className="bg-muted group-hover:bg-primary/10 mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-colors">
                        {(() => {
                          const DynIcon = esp.icon;
                          return <DynIcon size={20} />;
                        })()}
                      </div>
                      <h3 className="text-sm font-semibold">{esp.titulo}</h3>
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                        {esp.descricao}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Por que Be4Hope? ────────────────────────────── */}
      {/* ── 2. Por que Be4Hope? — faixa verde musgo suave ─── */}
      <section className="border-y border-[#2D4F3C]/10 bg-[#2D4F3C]/[0.06] py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-primary mb-4 text-xs font-semibold tracking-[0.25em] uppercase">
              Nossa missão
            </p>
            <h2 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              Por que <span className="text-accent-italic">Be4Hope?</span>
            </h2>
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-base leading-relaxed">
              A Be4Hope é muito mais do que uma ONG. Somos uma rede de acolhimento, cuidado e
              transformação, que conecta pacientes a tratamentos seguros, eficazes e acessíveis com
              Medicina Endocanabinóide.
            </p>
          </div>

          {(() => {
            const CARDS = [
              {
                icon: Users,
                titulo: 'Centenas de vidas',
                descricao:
                  'Atendemos centenas de pessoas que experimentam melhorias significativas em sua qualidade de vida, graças a tratamentos assistidos por especialistas e medicamentos de alta qualidade.',
              },
              {
                icon: Users,
                titulo: 'Parcerias estratégicas',
                descricao:
                  'Temos parcerias com fabricantes internacionais renomados, garantindo um portfólio diversificado que atende às necessidades de diferentes perfis de pacientes.',
              },
              {
                icon: HeartHandshake,
                titulo: 'Acompanhamento contínuo',
                descricao:
                  'Oferecemos suporte contínuo aos pacientes, com acompanhamento médico regular, orientações personalizadas e monitoramento da evolução do tratamento.',
              },
            ];
            return (
              <div className="mt-16 grid gap-4 sm:gap-8 sm:grid-cols-3 max-w-sm mx-auto sm:max-w-none">
                {CARDS.map((item) => (
                  <Card
                    key={item.titulo}
                    className="group bg-background border-0 shadow-sm transition-all hover:shadow-md"
                  >
                    <CardContent className="p-6">
                      <div className="bg-primary/10 group-hover:bg-primary/20 mb-4 flex h-12 w-12 items-center justify-center rounded-2xl transition-colors">
                        {(() => {
                          const DynIcon = item.icon;
                          return <DynIcon size={22} />;
                        })()}
                      </div>
                      <h3 className="text-sm font-semibold">{item.titulo}</h3>
                      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                        {item.descricao}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })()}

          <p className="text-foreground mt-12 text-center text-base font-medium">
            Somos a Be4Hope: <span className="text-primary">cuidado, acesso, transformação.</span>
          </p>
        </div>
      </section>

      {/* ── Seu caminho, em 4 passos simples ──────────────── */}
      <SeuCaminho />

      {/* ── Medicina Endocanabinóide — CTA educativo ───── */}
      {/* ── Medicina Endocanabinóide — faixa terracota quente ─ */}
      <section className="border-y border-[#C34C32]/10 bg-[#C34C32]/[0.05] py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="text-primary mb-4 text-xs font-semibold tracking-[0.25em] uppercase">
                Ciência e cuidado
              </p>
              <h2 className="font-display text-3xl leading-tight font-bold tracking-tight text-foreground sm:text-4xl">
                Medicina <span className="text-accent-italic">Endocanabinóide</span>
              </h2>
              <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
                <p>
                  A Medicina Endocanabinóide tem se mostrado eficaz no tratamento de diversas
                  doenças raras e crônicas, desde dores crônicas até distúrbios neurológicos.
                </p>
                <p>
                  Seu uso no Brasil é regulamentado pela{' '}
                  <strong className="text-foreground">RDC 660 da Anvisa</strong>, garantindo segurança e
                  controle. A Be4Hope atua com responsabilidade dentro desse cenário, sempre
                  buscando as melhores soluções para os pacientes.
                </p>
                <p>
                  Seus principais componentes ativos, o <strong className="text-foreground">CBD</strong>{' '}
                  (canabidiol) e o <strong className="text-foreground">THC</strong>{' '}
                  (tetra-hidrocanabinol), demonstraram propriedades analgésicas,
                  anti-inflamatórias, ansiolíticas e neuroprotetoras.
                </p>
              </div>
              <Link
                href="/historias"
                className="mt-8 inline-flex bg-[#16a34a] hover:bg-[#148f43] text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-300 px-8 h-12 items-center justify-center gap-2 border-0 text-sm cursor-pointer"
              >
                Quero saber mais
                <ChevronRight size={16} />
              </Link>
            </div>

            {/* Vídeo — Medicina Endocanabinóide */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-lg">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              >
                <source src="/images/home/shutterstock_1090570595.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Testemunhos — Pessoas reais ───────────────────── */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="bg-secondary/10 text-secondary inline-block rounded-full px-3 py-1 text-xs font-semibold">
              Histórias reais
            </span>
            <h2 className="font-display mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              Pessoas reais, <span className="text-accent-italic">acompanhadas de verdade</span>
            </h2>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-sm mx-auto sm:max-w-none">
            {TESTEMUNHOS.map((t) => (
              <Card key={t.nome} className="bg-card border-0 shadow-sm">
                <CardContent className="flex h-full flex-col p-6">
                  <div className="flex gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={16} className="fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mt-4 flex-1 text-sm leading-relaxed italic">
                    “{t.texto}”
                  </p>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="gradient-moss flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
                      {t.inicial}
                    </div>
                    <div>
                      <p className="text-foreground text-sm font-semibold">{t.nome}</p>
                      <p className="text-muted-foreground text-xs">
                        {t.local} · {t.sobre}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Médicos — Quem vai te acompanhar ──────────────── */}
      {/* ── Médicos — faixa musgo mais densa ────────────────── */}
      <section className="border-t border-[#2D4F3C]/12 py-16 lg:py-24">
        <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="bg-secondary/10 text-secondary inline-block rounded-full px-3 py-1 text-xs font-semibold">
              Confiança com rosto
            </span>
            <h2 className="font-display mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              Quem vai te <span className="text-accent-italic">acompanhar</span>
            </h2>
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-base leading-relaxed">
              Triagem e prescrição feitas por{' '}
              <strong className="text-foreground">
                médicos parceiros habilitados, independentes, sem remuneração por venda de produto
              </strong>
              . Aqui o médico não ganha pra te empurrar nada.
            </p>
          </div>

          <div className="mt-12">
            <MedicosCarousel medicos={medicosData} />
          </div>
        </div>
      </section>

      {/* ── Seção Humana — Imagem + Diferenciais ─────────── */}
      <section className="overflow-hidden py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            {/* Coluna esquerda — Imagem com detalhe de profundidade */}
            <div className="relative">
              {/* Quadrado decorativo de fundo */}
              <div
                className="bg-primary/6 absolute -top-4 -left-4 h-full w-full rounded-2xl lg:-top-6 lg:-left-6"
                aria-hidden="true"
              />
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-2xl">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                >
                  <source src="/images/home/shutterstock_1085515565.mp4" type="video/mp4" />
                </video>
                {/* Overlay sutil de gradiente */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

                {/* Badge flutuante de credibilidade */}
                <div className="absolute right-6 bottom-6 left-6 rounded-2xl bg-white/90 px-5 py-4 shadow-lg backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                      <HeartPulse size={20} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-foreground text-sm font-semibold">Cuidado humanizado</p>
                      <p className="text-muted-foreground text-xs">
                        Mais de 24 anos de acolhimento real
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna direita — Texto emocional + diferenciais */}
            <div>
              <p className="text-primary mb-4 text-xs font-semibold tracking-[0.25em] uppercase">
                Nossa essência
              </p>
              <h2 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
                Cuidado humano <span className="text-accent-italic">que transforma.</span>
              </h2>
              <p className="text-muted-foreground mt-6 text-base leading-relaxed">
                Por trás de cada paciente existe uma história de luta, esperança e amor. A Be4Hope
                nasceu justamente para que ninguém precise enfrentar esse caminho sozinho, com
                acolhimento genuíno, orientação especializada e acesso real ao tratamento.
              </p>

              <div className="mt-10 space-y-6">
                {[
                  {
                    icon: HeartPulse,
                    titulo: 'Sem julgamento, sem pressa',
                    descricao:
                      'Cada caso é único. Nossa equipe ouve, respeita e acompanha cada etapa do seu processo com empatia e responsabilidade.',
                  },
                  {
                    icon: Shield,
                    titulo: 'Segurança em cada etapa',
                    descricao:
                      'Atuamos dentro da regulamentação Anvisa (RDC 660), garantindo que o acesso ao tratamento seja seguro, legal e transparente.',
                  },
                  {
                    icon: Users,
                    titulo: 'Rede multidisciplinar',
                    descricao:
                      'Médicos, assistentes sociais e especialistas trabalham juntos para oferecer o melhor caminho para cada paciente.',
                  },
                ].map((item) => {
                  const DynIcon = item.icon;
                  return (
                    <div key={item.titulo} className="flex items-start gap-4">
                      <div className="bg-primary/10 hover:bg-primary/20 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors">
                        <DynIcon size={20} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-foreground text-sm font-semibold">{item.titulo}</p>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                          {item.descricao}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-10">
                <ScrollToSection
                  targetId="condicoes"
                  className="bg-[#16a34a] hover:bg-[#148f43] text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-300 px-8 h-12 flex items-center justify-center gap-2 border-0 text-sm cursor-pointer animate-active-pulse"
                >
                  Quero iniciar acolhimento
                  <ChevronRight size={16} />
                </ScrollToSection>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ — Antes de começar ────────────────────────── */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="bg-secondary/10 text-secondary inline-block rounded-full px-3 py-1 text-xs font-semibold">
              Dúvidas frequentes
            </span>
            <h2 className="font-display mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              Antes de <span className="text-accent-italic">começar</span>
            </h2>
          </div>

          <Accordion type="single" collapsible className="mt-12 space-y-3">
            {FAQ.map((item, index) => (
              <AccordionItem
                key={index}
                value={`faq-${index}`}
                className="rounded-xl border-0 bg-card px-6 shadow-sm"
              >
                <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                  {item.pergunta}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  {item.resposta}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── CTA Final — Dê o primeiro passo ───────────────── */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl bg-[#0d682e] px-8 py-14 sm:px-14 lg:py-20">

            {/* Círculos decorativos de profundidade */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/[0.04]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/[0.03]"
            />

            <div className="relative grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
              {/* Coluna esquerda — Texto + CTA */}
              <div>
                <span className="inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold text-white/80 tracking-widest uppercase mb-6">
                  No seu tempo, sem compromisso
                </span>

                <h2 className="font-display text-3xl leading-tight font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Dê o primeiro{' '}
                  <span className="text-[#D4A388] italic">passo</span>{' '}
                  do seu cuidado.
                </h2>

                <p className="mt-6 text-base leading-relaxed text-white/70 max-w-md">
                  A triagem leva poucos minutos e quem te atende é gente de verdade.
                </p>

                <div className="mt-8 flex flex-wrap gap-4">
                  <ScrollToSection
                    targetId="condicoes"
                    className="bg-white hover:bg-white/90 text-[#2D4F3C] font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-300 px-8 h-12 flex items-center justify-center gap-2 border-0 text-sm cursor-pointer animate-active-pulse"
                  >
                    Iniciar acolhimento
                    <ChevronRight size={16} />
                  </ScrollToSection>
                </div>

                <p className="mt-8 text-xs leading-relaxed text-white/35 max-w-sm">
                  Conteúdo informativo. A indicação de uso e a posologia são definidas exclusivamente
                  pelo médico após avaliação. Não prometemos cura nem resultado.
                </p>
              </div>

              {/* Coluna direita — Sinais de confiança */}
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-1">
                {[
                  {
                    valor: 'Você não está sozinho nessa jornada',
                    desc: 'Da primeira triagem ao acompanhamento do tratamento, uma pessoa real da nossa equipe está ao seu lado em cada etapa.',
                  },
                ].map((item) => (
                  <div
                    key={item.valor}
                    className="flex flex-col sm:flex-row items-center sm:items-start gap-6 rounded-2xl border border-white/10 bg-white/[0.06] p-8 sm:p-10 backdrop-blur-sm shadow-xl"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#D4A388]/20">
                      <HeartPulse size={24} className="text-[#D4A388]" />
                    </div>
                    <div className="text-center sm:text-left">
                      <p className="text-lg sm:text-xl font-semibold text-white">{item.valor}</p>
                      <p className="mt-3 text-sm sm:text-base leading-relaxed text-white/70">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
