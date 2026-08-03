import type { Metadata } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import Image from 'next/image';
import { PatologiasPicker } from '@/components/shared/patologias-picker';
import { SeuCaminho } from '@/components/shared/seu-caminho';
import { Counter } from '@/components/shared/counter';
import { Smiley } from '@/components/shared/smiley';
import { listarMedicosPublico } from '@/app/(public)/_actions/agendamento';
import {
  ArrowRight,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  Flower2,
  Globe,
  HandHeart,
  Heart,
  HeartHandshake,
  MapPin,
  MessageCircle,
  Monitor,
  Moon,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Tag,
  UserRound,
  Users,
  Users2,
  Zap,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Você não precisa enfrentar isso sozinho',
  description:
    'Há mais de duas décadas conectando pessoas ao cuidado com Medicina Endocanabinoide, responsabilidade, acolhimento e do seu lado em cada etapa.',
  openGraph: {
    title: 'Você não precisa enfrentar isso sozinho | Be4Hope',
    description:
      'Há mais de duas décadas conectando pessoas ao cuidado com Medicina Endocanabinoide, responsabilidade, acolhimento e do seu lado em cada etapa.',
    url: 'https://be4hope.org',
  },
};

/* ── Constantes ─────────────────────────────────── */

const WHATSAPP_URL =
  "https://wa.me/5511932047360?text=" +
  encodeURIComponent("Olá! Vim pelo site da Be4Hope e gostaria de iniciar meu acolhimento.");

/* ── Dados estáticos ────────────────────────────── */

const STATS = [
  { valor: '24', numeric: 24, suffix: '', label: 'anos de histórias reais' },
  { valor: 'ONG', numeric: null, suffix: '', label: 'sem fins lucrativos' },
  { valor: '26', numeric: 26, suffix: '', label: 'estados atendidos' },
  { valor: '8.000+', numeric: 8000, suffix: '+', label: 'Pacientes atendidos' },
];

const PASSOS = [
  {
    icon: CalendarDays,
    titulo: '1. Agende gratuitamente',
    desc: 'Escolha o melhor dia e horário para sua consulta, em poucos cliques e sem burocracia.',
  },
  {
    icon: Stethoscope,
    titulo: '2. Consulta com especialista',
    desc: 'Converse com um(a) médico(a) especializado(a) e receba uma avaliação completa do seu caso.',
  },
  {
    icon: FileText,
    titulo: '3. Prescrição quando indicada',
    desc: 'Se houver indicação clínica, você recebe a prescrição de forma rápida e segura.',
  },
  {
    icon: Heart,
    titulo: '4. Acompanhamento',
    desc: 'Nossa equipe segue ao seu lado para ajustar e acompanhar sua evolução, sempre que precisar.',
  },
];

const CONDICOES_INDICADAS = [
  { icon: Brain, label: 'Ansiedade' },
  { icon: Moon, label: 'Insônia' },
  { icon: UserRound, label: 'Dor crônica' },
  { icon: Sparkles, label: 'Dor neuropática' },
  { icon: Zap, label: 'Epilepsia' },
  { icon: ClipboardList, label: 'Autismo' },
  { icon: Flower2, label: 'Fibromialgia' },
  { icon: Flower2, label: 'Outras condições avaliadas pelo médico' },
];

const PORQUE_CARDS = [
  {
    icon: Users,
    titulo: 'Centenas de vidas',
    desc: 'Atendemos centenas de pessoas que experimentam melhorias significativas em sua qualidade de vida, graças a tratamentos assistidos por especialistas e medicamentos de alta qualidade.',
  },
  {
    icon: Globe,
    titulo: 'Parcerias estratégicas',
    desc: 'Temos parcerias com fabricantes internacionais renomados, garantindo um portfólio diversificado que atende às necessidades de diferentes perfis de pacientes.',
  },
  {
    icon: HeartHandshake,
    titulo: 'Acompanhamento contínuo',
    desc: 'Oferecemos suporte contínuo aos pacientes, com acompanhamento médico regular, orientações personalizadas e monitoramento da evolução do tratamento.',
  },
];

const PORQUE_STATS = [
  { icon: Users, v: '8.000+', l: 'pacientes atendidos' },
  { icon: CalendarDays, v: '24 anos', l: 'de história e acolhimento' },
  { icon: ShieldCheck, v: 'ONG', l: 'sem fins lucrativos' },
  { icon: MapPin, v: '26', l: 'estados atendidos' },
  { icon: Monitor, v: '100%', l: 'atendimento on-line' },
];

const PORQUE_LISTA = [
  'Médicos especialistas em Medicina Endocanabinoide',
  'Tratamentos baseados em evidências científicas',
  'Atendimento humanizado',
  'Prescrição clinicamente indicada',
  'Acompanhamento durante todo o tratamento',
  'Sigilo e segurança dos dados',
];

const FAQ = [
  {
    q: 'É legal usar Medicina Endocanabinoide no Brasil?',
    a: 'Sim. O acesso é regulamentado pela ANVISA (RDC 660), com receita médica e autorização oficial de importação.',
  },
  {
    q: 'Preciso de laudo ou diagnóstico pronto antes?',
    a: 'Não necessariamente. A triagem é o primeiro passo: você conta o que sente e o médico avalia, na consulta, o que faz sentido para você.',
  },
  {
    q: 'Quanto custa o processo?',
    a: 'Começar é gratuito, a triagem não tem custo nem compromisso. Como associação sem fins lucrativos, os valores de consulta e autorização são apresentados com transparência antes de qualquer decisão.',
  },
  {
    q: 'E se o médico não indicar?',
    a: 'Então o processo para por aí, você não paga por produto que não foi prescrito. Quem decide é sempre o médico.',
  },
  {
    q: 'Nunca usei antes. É seguro?',
    a: 'A avaliação é individual e feita por médico habilitado. A indicação e a posologia são definidas exclusivamente por ele, com acompanhamento em cada etapa.',
  },
  {
    q: 'Minha família ou empresa fica sabendo?',
    a: 'Não. Seus dados são tratados com sigilo e conforme a LGPD. O cuidado é seu, no seu tempo.',
  },
  {
    q: 'Quanto tempo até chegar em casa?',
    a: 'Após a consulta e a autorização da ANVISA, o produto é entregue na sua casa, com acompanhamento da nossa equipe.',
  },
  {
    q: 'Vocês me acompanham depois?',
    a: 'Sim. O acolhimento continua depois do início, você não fica sozinho.',
  },
];

const TESTEMUNHOS = [
  {
    inicial: 'M',
    nome: 'Maria S., 47',
    meta: 'Campinas • sobre o acolhimento',
    texto:
      'Eu tinha medo de que fosse complicado ou ilegal. O que mais me marcou foi não ter ninguém me empurrando nada, só me explicando, no meu tempo.',
  },
  {
    inicial: 'R',
    nome: 'Rita L., 39',
    meta: 'Curitiba • sobre o atendimento',
    texto:
      'A equipe me explicou cada passo com paciência, sem pressa e sem pressão de venda. Pela primeira vez me senti cuidada, não vendida.',
  },
  {
    inicial: 'J',
    nome: 'João P., 52',
    meta: 'São Paulo • sobre a jornada',
    texto:
      'Achei que ia ser burocrático e frio. Foi o contrário: humano do começo ao fim, com gente de verdade me acompanhando.',
  },
];

const CUIDADO_HUMANO = [
  {
    icon: Heart,
    t: 'Sem julgamento, sem pressa',
    d: 'Cada caso é único. Nossa equipe ouve, respeita e acompanha cada etapa do seu processo com empatia e responsabilidade.',
  },
  {
    icon: ShieldCheck,
    t: 'Segurança em cada etapa',
    d: 'Atuamos dentro da regulamentação Anvisa (RDC 660), garantindo que o acesso ao tratamento seja seguro, legal e transparente.',
  },
  {
    icon: Users,
    t: 'Rede multidisciplinar',
    d: 'Médicos, assistentes sociais e especialistas trabalham juntos para oferecer o melhor caminho para cada paciente.',
  },
];

/* ── Componente principal ───────────────────────── */

export default async function HomePage() {
  noStore();
  const medicosResult = await listarMedicosPublico();
  const medicosData =
    medicosResult.sucesso && medicosResult.dados ? medicosResult.dados : [];

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

              {/* Pilares — 4 ícones em círculo */}
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

            {/* ── Palco central: "be." + pessoa + decorativos ── */}
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

            {/* ── Coluna direita: institucional ── */}
            <div className="lg:pl-10 animate-fade-up delay-200 relative z-20 flex flex-col items-start lg:col-span-3 lg:items-end lg:pt-2">
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
                  Apoio, acolhimento e acesso a tratamentos com Medicina Endocanabinóide para
                  pacientes que necessitam de acompanhamento e suporte da Fundação.
                </p>

                <div className="mt-6 h-px w-20 bg-primary/30" />

                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Acolhimento • Tratamento • Esperança
                </p>
              </div>
            </div>
          </div>

          {/* ── Cards flutuantes — sobrepõem a base da pessoa ─────── */}
          <div className="animate-fade-up delay-300 relative z-30 mt-8 grid gap-4 sm:mt-10 sm:grid-cols-5 lg:-mt-24 lg:grid-cols-12 lg:gap-4">
            {/* Card 1 — descrição da Fundação */}
            <div className="rounded-2xl border border-border bg-white/95 p-5 shadow-lg backdrop-blur-sm sm:col-span-3 lg:col-span-4 lg:col-start-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FBEDE5] text-primary">
                  <HandHeart size={22} strokeWidth={1.75} />
                </div>
                <p className="text-foreground text-sm leading-relaxed">
                  A <strong className="font-semibold">Fundação Be4Hope</strong> dá acesso a produtos
                  com Medicina Endocanabinóide para pacientes que precisam do tratamento e não têm
                  condições de adquirir.
                </p>
              </div>
            </div>

            {/* Card 2 — benefícios */}
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

      {/* ── Como funciona ─────────────────────────────── */}
      <section id="como-funciona" className="py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="eyebrow">Como funciona</p>
            <h2 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">
              Um cuidado completo, do seu jeito.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              A Be4Hope cuida de você em todas as etapas, com segurança e responsabilidade.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PASSOS.map((p) => {
              const Icon = p.icon;
              return (
                <article
                  key={p.titulo}
                  className="rounded-3xl border border-border/70 bg-card p-7 text-center shadow-card transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft">
                    <Icon size={24} strokeWidth={1.9} />
                  </div>
                  <h3 className="mt-5 text-sm font-bold">{p.titulo}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Para quem é indicado ──────────────────────── */}
      <section className="pb-16 lg:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
              Para quem é indicado?
            </h2>
            <p className="mt-3 text-muted-foreground">
              A Medicina Endocanabinoide pode ajudar em diversas condições:
            </p>
          </div>

          <ul className="mt-12 grid grid-cols-2 gap-8 sm:grid-cols-4 lg:grid-cols-8">
            {CONDICOES_INDICADAS.map((c) => {
              const Icon = c.icon;
              return (
                <li key={c.label} className="flex flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
                    <Icon size={24} strokeWidth={1.7} />
                  </div>
                  <span className="mt-3 text-xs leading-snug font-medium text-foreground">
                    {c.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ── CTA Faixa laranja ────────────────────────── */}
      <section id="cta" className="px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-8 rounded-3xl bg-primary px-7 py-10 text-primary-foreground sm:px-12 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="max-w-xl font-display text-2xl leading-snug font-extrabold sm:text-3xl">
              Dê o primeiro passo para uma vida com mais saúde e qualidade.
            </h2>
            <p className="mt-3 text-sm opacity-90">
              Estamos aqui para ouvir, acolher e caminhar ao seu lado.
            </p>
          </div>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-3 rounded-full bg-card px-7 py-4 text-base font-semibold text-primary shadow-soft transition-transform hover:-translate-y-0.5 cursor-pointer"
          >
            <CalendarDays size={20} />
            Agende sua consulta gratuita
            <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* ── Seletor de patologias (integração preservada) ── */}
      <PatologiasPicker />

      {/* ── Quem somos ────────────────────────────────── */}
      <section id="quem-somos" className="py-16 lg:py-24 scroll-mt-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="eyebrow">Desde 2002</p>
          <h2 className="mt-4 font-display text-3xl leading-tight font-extrabold sm:text-4xl">
            Há mais de duas décadas{' '}
            <span className="text-primary italic">cuidando</span> de quem mais precisa.
          </h2>

          <div className="mt-6 space-y-5 text-base leading-relaxed text-muted-foreground">
            <p>
              A <strong className="text-foreground">Be4Hope</strong> é uma organização filantrópica
              sem fins lucrativos que, desde 2002, acolhe e apoia famílias e indivíduos com
              condições neurológicas, patologias e doenças crônicas. Nosso trabalho é cuidar de quem
              precisa, oferecendo apoio humano, acesso a tratamentos seguros e informações de
              confiança.
            </p>
            <p>
              Acreditamos que{' '}
              <strong className="text-foreground">saúde é um direito de todos</strong>, não importa
              onde você mora ou qual é a sua condição financeira. Por isso, atuamos para garantir
              que medicamentos essenciais cheguem de forma justa e legal até quem realmente precisa.
            </p>
            <p>
              Nosso sistema de distribuição é{' '}
              <strong className="text-foreground">legalizado, transparente e eficiente</strong>,
              feito com responsabilidade e muito respeito à vida. Também apoiamos a pesquisa
              científica, porque acreditamos no poder da informação e da inovação para mudar
              realidades.
            </p>
            <p>
              Somos uma rede de{' '}
              <strong className="text-foreground">cuidado, esperança e transformação</strong>. Somos
              a Be4Hope.
            </p>
          </div>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-3 rounded-full bg-primary px-7 py-4 text-base font-semibold text-primary-foreground shadow-soft transition-transform hover:-translate-y-0.5 cursor-pointer"
          >
            Iniciar acolhimento
            <ArrowRight size={18} />
          </a>

          <div className="mt-10 rounded-3xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={16} className="fill-[var(--sun)] text-[var(--sun)]" />
              ))}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Avaliação dos pacientes ·{' '}
              <strong className="text-foreground">4,9 de 5 (1.200+ avaliações)</strong>
            </p>
          </div>
        </div>
      </section>

      {/* ── Por que Be4Hope ───────────────────────────── */}
      <section className="pb-16 lg:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-primary-soft p-7 sm:p-12">
            <p className="eyebrow">Nossa missão</p>
            <h2 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">
              Por que <span className="text-primary italic">Be4Hope?</span>
            </h2>
            <p className="mt-4 max-w-3xl text-muted-foreground">
              A Be4Hope é muito mais do que uma ONG. Somos uma rede de acolhimento, cuidado e
              transformação, que conecta pacientes a tratamentos seguros, eficazes e acessíveis com
              Medicina Endocanabinoide.
            </p>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PORQUE_CARDS.map((c) => {
                const Icon = c.icon;
                return (
                  <article
                    key={c.titulo}
                    className="rounded-3xl bg-card p-6 shadow-card transition-transform duration-300 hover:-translate-y-1"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <Icon size={22} strokeWidth={1.7} />
                    </div>
                    <h3 className="mt-4 text-sm font-bold">{c.titulo}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
                  </article>
                );
              })}
            </div>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-6 rounded-3xl border border-border bg-card px-6 py-8 sm:grid-cols-3 lg:grid-cols-5">
            {PORQUE_STATS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.v} className="flex items-center gap-3">
                  <Icon size={26} className="shrink-0 text-primary" strokeWidth={1.6} />
                  <div>
                    <dt className="font-display text-xl font-extrabold">{s.v}</dt>
                    <dd className="text-xs text-muted-foreground">{s.l}</dd>
                  </div>
                </div>
              );
            })}
          </dl>

          <div className="mt-12 text-center">
            <h3 className="font-display text-xl font-extrabold sm:text-2xl">
              Por que milhares de pacientes escolhem a{' '}
              <span className="text-primary italic">Be4Hope?</span>
            </h3>
            <ul className="mt-8 grid gap-6 text-left sm:grid-cols-2 lg:grid-cols-3">
              {PORQUE_LISTA.map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Seu caminho, em 4 passos (integração preservada) ── */}
      <SeuCaminho />

      {/* ── FAQ ───────────────────────────────────────── */}
      <section id="faq" className="pb-16 lg:pb-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <span className="inline-block rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
            Dúvidas frequentes
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">
            Antes de <span className="text-primary italic">começar</span>
          </h2>

          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-border bg-card px-5 py-4 transition-colors open:border-primary/40"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold">
                  {f.q}
                  <ChevronDown
                    size={18}
                    className="shrink-0 text-primary transition-transform duration-300 group-open:rotate-180"
                  />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Primeiro passo — card verde ─────────────── */}
      <section className="px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
        <div className="mx-auto max-w-3xl rounded-3xl bg-secondary p-8 text-secondary-foreground sm:p-12">
          <span className="inline-block rounded-full border border-secondary-foreground/25 px-3 py-1 text-[11px] font-semibold tracking-widest uppercase">
            No seu tempo, sem compromisso
          </span>
          <h2 className="mt-5 font-display text-3xl font-extrabold sm:text-4xl">
            Dê o primeiro{' '}
            <span className="italic underline decoration-2 underline-offset-4">passo</span>
            <br />
            do seu cuidado.
          </h2>
          <p className="mt-4 text-sm opacity-85">
            A triagem leva poucos minutos e quem te atende é gente de verdade.
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-card px-6 py-3.5 text-sm font-semibold text-secondary transition-transform hover:-translate-y-0.5 cursor-pointer"
          >
            Iniciar acolhimento
            <MessageCircle size={17} />
          </a>

          <div className="mt-8 flex items-start gap-4 rounded-2xl bg-secondary-foreground/10 p-5">
            <Heart size={22} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Você não está sozinho nessa jornada</p>
              <p className="mt-1 text-xs leading-relaxed opacity-80">
                Da primeira triagem ao acompanhamento do tratamento, uma pessoa real da nossa
                equipe está ao seu lado em cada etapa.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Cuidado humano ────────────────────────────── */}
      <section className="pb-16 lg:pb-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <span className="inline-block rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
            Nossa essência
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">
            Cuidado humano <span className="text-primary italic">que transforma.</span>
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Por trás de cada paciente existe uma história de luta, esperança e amor. A Be4Hope
            nasceu justamente para que ninguém precise enfrentar esse caminho sozinho, com
            acolhimento genuíno, orientação especializada e acesso real ao tratamento.
          </p>

          <div className="mt-8 space-y-6">
            {CUIDADO_HUMANO.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.t} className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <Icon size={20} strokeWidth={1.7} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{item.t}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.d}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-9 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-soft transition-transform hover:-translate-y-0.5 cursor-pointer"
          >
            Quero iniciar acolhimento
            <MessageCircle size={17} />
          </a>
        </div>
      </section>

      {/* ── Testemunhos ───────────────────────────────── */}
      <section className="bg-primary-soft/50 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <span className="inline-block rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
            Histórias reais
          </span>
          <h2 className="mt-4 font-display text-3xl leading-tight font-extrabold sm:text-4xl">
            Pessoas reais,
            <br />
            <span className="text-primary italic">acompanhadas de verdade</span>
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {TESTEMUNHOS.map((t) => (
              <figure
                key={t.nome}
                className="flex h-full flex-col rounded-3xl bg-card p-6 shadow-card transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={15} className="fill-[var(--sun)] text-[var(--sun)]" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground italic">
                  “{t.texto}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                    {t.inicial}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{t.nome}</span>
                    <span className="block text-xs text-muted-foreground">{t.meta}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Médicos (integração preservada) ───────────── */}
      <section id="medicos" className="py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <span className="inline-block rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
            Confiança com rosto
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">
            Quem vai te <span className="text-primary italic">acompanhar</span>
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Triagem e prescrição feitas por{' '}
            <strong className="text-foreground">
              médicos parceiros habilitados, independentes, sem remuneração por venda de produto
            </strong>
            . Aqui o médico não ganha pra te empurrar nada.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {medicosData.map((m) => {
              const iniciais = m.nome
                .split(' ')
                .filter(Boolean)
                .map((w) => w[0].toUpperCase())
                .slice(0, 2)
                .join('');
              const crmFormatado = m.crm
                ? m.crm.startsWith('CRM') || m.crm.startsWith('CRO')
                  ? m.crm
                  : `CRM ${m.crm}`
                : null;
              return (
                <article
                  key={m.id}
                  className="flex items-start gap-4 rounded-3xl border border-border bg-card p-6 shadow-card"
                >
                  {m.avatarUrl ? (
                    <Image
                      src={m.avatarUrl}
                      alt={`Retrato do médico ${m.nome}`}
                      width={64}
                      height={64}
                      className="h-16 w-16 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="gradient-moss flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-base font-bold text-white">
                      {iniciais}
                    </div>
                  )}
                  <div>
                    <h3 className="font-display text-base font-bold">{m.nome}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {m.especialidade}
                    </p>
                    {crmFormatado && (
                      <p className="mt-2 text-xs font-semibold text-primary">{crmFormatado}</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Seção Pré-Footer — "Você não precisa enfrentar isso sozinho" ── */}
      <section className="relative overflow-hidden bg-primary-soft/60">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8 lg:pt-16 lg:pb-24">
          {/* Coluna esquerda — texto + CTAs */}
          <div>
            <p className="eyebrow">Sua saúde merece atenção.</p>
            <h2 className="mt-4 font-display text-4xl leading-[1.02] font-extrabold sm:text-5xl lg:text-6xl">
              <span className="text-primary">Você</span> não precisa enfrentar isso sozinho(a).
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-foreground/80">
              Há mais de duas décadas conectando pessoas ao cuidado com Medicina Endocanabinoide,
              responsabilidade, acolhimento e do seu lado em cada etapa.
            </p>

            <div className="mt-8 grid max-w-lg grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { icon: CalendarDays, titulo: '100%', desc: 'on-line' },
                { icon: Shield, titulo: 'Sigilo', desc: 'absoluto' },
                { icon: Stethoscope, titulo: 'Médicos', desc: 'especialistas' },
                { icon: HeartHandshake, titulo: 'Atendimento', desc: 'humanizado' },
              ].map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.titulo} className="flex items-start gap-2">
                    <Icon size={20} className="mt-0.5 shrink-0 text-primary" strokeWidth={1.75} />
                    <div>
                      <p className="text-sm font-semibold leading-tight text-foreground">
                        {p.titulo}
                      </p>
                      <p className="text-xs text-foreground/70">{p.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-9 flex max-w-md flex-col gap-3">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-3 rounded-full bg-primary px-7 py-4 text-base font-semibold text-primary-foreground shadow-soft transition-transform hover:-translate-y-0.5 cursor-pointer"
              >
                <CalendarDays size={20} />
                Iniciar acolhimento gratuito
                <ArrowRight size={18} />
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-foreground/15 bg-card px-7 py-4 text-base font-semibold text-foreground transition-colors hover:bg-accent cursor-pointer"
              >
                Conhecer a Be4Hope
              </a>
            </div>
          </div>

          {/* Coluna direita — foto circular + smiley bars */}
          <div className="relative mx-auto w-full max-w-xs sm:max-w-sm">
            <div className="relative aspect-square overflow-hidden rounded-full border-[6px] border-primary bg-card">
              <Image
                src="/images/home/hero-be-pessoa-3.jpg"
                alt="Paciente sorrindo, acolhida pela equipe Be4Hope"
                fill
                sizes="(max-width: 640px) 80vw, 320px"
                className="scale-105 object-cover object-top"
                quality={90}
              />
            </div>

            <div className="absolute -right-1 top-6 flex items-center gap-2 rounded-2xl bg-primary px-3 py-2 text-primary-foreground shadow-soft sm:right-2">
              <Heart size={16} className="fill-current" />
              <div className="leading-tight">
                <p className="text-base font-bold">8.000+</p>
                <p className="text-[10px] opacity-90">pacientes atendidos</p>
              </div>
            </div>

            <div className="mt-5 flex items-end justify-center gap-2 sm:gap-3">
              {[
                { h: 'h-14', bg: 'var(--leaf)' },
                { h: 'h-24', bg: 'var(--sky)' },
                { h: 'h-12', bg: 'var(--primary)' },
                { h: 'h-20', bg: 'var(--sun)' },
                { h: 'h-10', bg: 'var(--card)' },
              ].map((b, i) => (
                <div key={i} className="flex flex-col items-center">
                  <Smiley
                    bg={b.bg}
                    face={i === 4 ? 'var(--primary)' : 'var(--card)'}
                    className="h-8 w-8 sm:h-10 sm:w-10"
                  />
                  <div className={`mt-2 w-6 rounded-t-full bg-primary sm:w-9 ${b.h}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
