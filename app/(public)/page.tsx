import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Award,
  BadgeCheck,
  Brain,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileCheck,
  HeartHandshake,
  HeartPulse,
  Leaf,
  Network,
  Package,
  Shield,
  Stethoscope,
  Users,
} from 'lucide-react';
export const metadata: Metadata = {
  title: 'Be4Hope — Cuidar de quem cuida é nosso ato de amor',
  description:
    'Há mais de duas décadas conectando pessoas ao cuidado com Medicina Endocanabinóide. Acolhimento humanizado, sem julgamento, sem custo.',
};

/* ── Dados ──────────────────────────────────────────── */

const STATS = [
  { valor: '24', label: 'anos de história' },
  { valor: 'ONG', label: 'sem fins lucrativos' },
  { valor: '26', label: 'estados atendidos' },
  { valor: '8.000+', label: 'Pacientes atendidos' },
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

const COMO_FUNCIONA = [
  {
    icon: FileCheck,
    passo: '1',
    titulo: 'Você preenche o formulário',
    descricao: 'Leva cerca de 5 minutos. Pode pausar e retomar quando quiser.',
  },
  {
    icon: Users,
    passo: '2',
    titulo: 'Equipe analisa em até 48h',
    descricao: 'Profissionais multidisciplinares avaliam o melhor caminho.',
  },
  {
    icon: CalendarDays,
    passo: '3',
    titulo: 'Plano personalizado por WhatsApp',
    descricao: 'Você recebe orientação clara dos próximos passos.',
  },
];

const HISTORIAS = [
  {
    titulo: 'Medicina Endocanabinóide e qualidade de vida: o que a evidência mostra',
    subtitulo:
      'Como o uso terapêutico responsável tem transformado o dia a dia de quem convive com condições crônicas.',
    categoria: 'Bem-estar',
    imagem: '/images/home/historia-familia-sofa.jpg',
    alt: 'Família reunida em momento de leveza e bem-estar',
  },
  {
    titulo: 'O que a ciência diz sobre cuidado integrativo em 2026',
    subtitulo: 'Novos estudos apresentam tratamentos inovadores.',
    categoria: 'Ciência',
    imagem: '/images/home/historia-familia-sofa2.jpg',
    alt: 'Família feliz reunida em casa — acolhimento e bem-estar',
  },
  {
    titulo: 'Be4Hope completa 24 anos e os próximos ciclos',
    subtitulo: 'Duas décadas de acolhimento, resiliência e cuidado.',
    categoria: 'Institucional',
    imagem: '/images/home/historia-familia-ar-livre.jpg',
    alt: 'Família celebrando ao ar livre — esperança e alegria',
  },
];

/* ── Componente ─────────────────────────────────────── */

export default function HomePage() {
  return (
    <>
      {/* ── Hero — Editorial Caloroso ────────────────────── */}
      <section className="relative min-h-[85vh] overflow-hidden pt-16">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Texto */}
            <div className="animate-fade-up">
              <p className="text-muted-foreground mb-6 text-xs font-semibold tracking-[0.25em] uppercase">
                Acolhimento · Medicina Endocanabinóide
              </p>

              <h1 className="font-display text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Cuidar de quem
                <br />
                cuida é nosso
                <br />
                <span className="text-accent-italic">ato de amor.</span>
              </h1>

              <p className="text-muted-foreground mt-6 max-w-lg text-base leading-relaxed sm:text-lg">
                Há mais de duas décadas conectando pessoas ao cuidado com Medicina Endocanabinóide.
                Sem pressa, sem julgamento, sem custo.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/triagem">
                  <Button
                    size="lg"
                    className="btn-pill bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-8"
                    nativeButton={false}
                  >
                    Iniciar triagem
                    <ChevronRight size={16} />
                  </Button>
                </Link>
                <Link href="/#quem-somos">
                  <Button
                    variant="outline"
                    size="lg"
                    className="btn-pill border-foreground/20 gap-2 px-8"
                    nativeButton={false}
                  >
                    Conhecer a Be4Hope
                  </Button>
                </Link>
              </div>
            </div>

            {/* Imagem Hero — Mãe e Filho */}
            <div className="animate-fade-up delay-200">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-lg lg:aspect-[3/2]">
                <Image
                  src="/images/home/hero-mae-filho.jpg"
                  alt="Mãe abraçando seu filho com carinho — acolhimento Be4Hope"
                  fill
                  className="object-cover"
                  style={{ objectPosition: 'center 25%' }}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                  quality={85}
                />
                {/* Overlay sutil para manter harmonia com a paleta */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
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
                  {stat.valor}
                </p>
                <p className="text-muted-foreground mt-1 text-xs font-medium tracking-[0.15em] uppercase">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          QUEM SOMOS — Seção institucional completa
      ══════════════════════════════════════════════════════════ */}

      {/* ── 1. Quem Somos — Introdução ──────────────────────── */}
      <section id="quem-somos" className="py-20 lg:py-28">
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
                  <strong className="text-foreground">saúde é um direito de todos</strong> — não
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

              {/* Flores decorativas — mix-blend-mode dissolve o fundo branco do PNG */}
              <div className="mt-8 flex justify-center">
                <Image
                  src="/images/home/flores.png"
                  alt="Ilustração de flores — símbolo de florescimento e cuidado da Be4Hope"
                  width={520}
                  height={220}
                  className="h-auto w-full max-w-[430px] select-none"
                  style={{
                    mixBlendMode: 'multiply',
                    display: 'block',
                  }}
                  draggable={false}
                />
              </div>
            </div>

            {/* Vídeo — Quem Somos */}
            <div className="flex flex-col gap-6">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                <video
                  src="/images/home/shutterstock_1076126774.mov"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>

              {/* Cards de especialidade */}
              <div className="grid gap-4 sm:grid-cols-2">
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
      <section className="border-border bg-muted/30 border-y py-20 lg:py-28">
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

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
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
              {
                icon: Award,
                titulo: 'Educação e conscientização',
                descricao:
                  'Investimos em educação sobre o uso adequado dos medicamentos, promovendo a saúde preventiva e a importância do acompanhamento médico regular.',
              },
            ].map((item) => (
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

          <p className="text-foreground mt-12 text-center text-base font-medium">
            Somos a Be4Hope: <span className="text-primary">cuidado, acesso, transformação.</span>
          </p>
        </div>
      </section>

      {/* ── 3. Collab Be4Hope ─────────────────────────────── */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-primary mb-4 text-xs font-semibold tracking-[0.25em] uppercase">
              Ecossistema
            </p>
            <h2 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              Rede de Apoio Be4Hope:{' '}
              <span className="text-accent-italic">conectando pessoas e soluções</span>
            </h2>
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-base leading-relaxed">
              A Be4Hope é uma <strong className="text-foreground">rede de apoio</strong> formada por
              empresas e instituições que promovem um modelo inovador de saúde — mais humano,
              acessível e centrado no paciente, utilizando a Medicina Endocanabinóide como terapia,
              sempre com base científica e responsabilidade.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:mx-auto lg:max-w-4xl">
            {/* Be 4Hope */}
            <Card className="group bg-card relative overflow-hidden border-0 shadow-sm transition-all hover:shadow-lg">
              <div className="from-primary to-primary/70 absolute inset-x-0 top-0 h-1 bg-gradient-to-r" />
              <CardContent className="p-8">
                <div className="bg-primary/10 mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
                  <HeartPulse size={22} className="text-primary" />
                </div>
                <h3 className="font-display text-lg font-bold">Be 4Hope</h3>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  Atua como{' '}
                  <strong className="text-foreground">
                    ponte entre pacientes, familiares e o ecossistema
                  </strong>{' '}
                  da Medicina Endocanabinóide. Trabalha em rede com parceiros para criar soluções
                  personalizadas.
                </p>
                <ul className="mt-4 space-y-2">
                  <li className="text-muted-foreground flex items-start gap-2 text-sm">
                    <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                    Ponte entre pacientes e tratamentos
                  </li>
                  <li className="text-muted-foreground flex items-start gap-2 text-sm">
                    <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                    Soluções personalizadas em rede
                  </li>
                  <li className="text-muted-foreground flex items-start gap-2 text-sm">
                    <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                    Missão: colaboração salva vidas
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Nossos Parceiros */}
            <Card className="group bg-card relative overflow-hidden border-0 shadow-sm transition-all hover:shadow-lg">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-amber-400" />
              <CardContent className="p-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
                  <Network size={22} className="text-amber-600" />
                </div>
                <h3 className="font-display text-lg font-bold">Parceiros Estratégicos</h3>
                <p className="mt-1 text-xs font-medium text-amber-600 italic">
                  Juntos por uma saúde mais acessível.
                </p>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  Trabalhamos com parceiros de excelência comprometidos com inovação, regulação e
                  acesso à Medicina Endocanabinóide.
                </p>
                <ul className="mt-4 space-y-2">
                  <li className="text-muted-foreground flex items-start gap-2 text-sm">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-amber-500" />
                    Greens Pharmaceutical — Swiss GMP
                  </li>
                  <li className="text-muted-foreground flex items-start gap-2 text-sm">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-amber-500" />
                    Cannect — Ecossistema digital de saúde
                  </li>
                  <li className="text-muted-foreground flex items-start gap-2 text-sm">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-amber-500" />
                    Rede multidisciplinar de especialistas
                  </li>
                </ul>
                <Link
                  href="/parceiros"
                  className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-amber-600 transition-colors hover:text-amber-700"
                >
                  Conhecer parceiros
                  <ChevronRight size={14} />
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── 4. Medicina Endocanabinóide — CTA educativo ───── */}
      <section className="section-dark py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="text-primary mb-4 text-xs font-semibold tracking-[0.25em] uppercase">
                Ciência e cuidado
              </p>
              <h2 className="font-display text-3xl leading-tight font-bold tracking-tight text-white sm:text-4xl">
                Medicina <span className="text-accent-italic">Endocanabinóide</span>
              </h2>
              <div className="mt-6 space-y-4 text-base leading-relaxed text-white/70">
                <p>
                  A Medicina Endocanabinóide tem se mostrado eficaz no tratamento de diversas
                  doenças raras e crônicas, desde dores crônicas até distúrbios neurológicos.
                </p>
                <p>
                  Seu uso no Brasil é regulamentado pela{' '}
                  <strong className="text-white">RDC 660 da Anvisa</strong>, garantindo segurança e
                  controle. A Be4Hope atua com responsabilidade dentro desse cenário, sempre
                  buscando as melhores soluções para os pacientes.
                </p>
                <p>
                  Seus principais componentes ativos — o <strong className="text-white">CBD</strong>{' '}
                  (canabidiol) e o <strong className="text-white">THC</strong>{' '}
                  (tetra-hidrocanabinol) — demonstraram propriedades analgésicas,
                  anti-inflamatórias, ansiolíticas e neuroprotetoras.
                </p>
              </div>
              <Link href="/mundo-endocanabinoide" className="mt-8 inline-flex">
                <Button
                  size="lg"
                  className="btn-pill bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-8"
                  nativeButton={false}
                >
                  Quero saber mais
                  <ChevronRight size={16} />
                </Button>
              </Link>
            </div>

            {/* Vídeo — Medicina Endocanabinóide */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-lg">
              <video
                src="/images/home/shutterstock_1090570595.mov"
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Do Zero Até Sua Casa — Jornada do paciente ─── */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-primary mb-4 text-xs font-semibold tracking-[0.25em] uppercase">
              Jornada do paciente
            </p>
            <h2 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              Do zero até <span className="text-accent-italic">a sua casa</span>
            </h2>
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-base leading-relaxed">
              Entenda o passo a passo para acessar seu tratamento com Medicina Endocanabinóide de
              forma segura e legalizada.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Stethoscope,
                passo: '1',
                titulo: 'Consulta Médica',
                descricao:
                  'O primeiro passo é ter um diagnóstico médico. Se ainda não tem, te ajudamos a encontrar um profissional. Se já possui, é só nos enviar para continuar o processo.',
              },
              {
                icon: BadgeCheck,
                passo: '2',
                titulo: 'Autorização',
                descricao:
                  'Para importar a medicação, será necessário solicitar uma autorização da Anvisa. A Be4Hope te ajuda nesse processo.',
              },
              {
                icon: FileCheck,
                passo: '3',
                titulo: 'Receita',
                descricao:
                  'Feito diagnóstico e com a prescrição em mãos você pode efetuar o pedido do seu produto.',
              },
              {
                icon: Package,
                passo: '4',
                titulo: 'Pedido Aprovado',
                descricao:
                  'O paciente pode importar e receber seu medicamento diretamente em sua residência.',
              },
            ].map((item) => (
              <div key={item.passo} className="group relative text-center">
                {/* Número do passo */}
                <div className="relative mx-auto mb-6">
                  <div className="bg-primary/10 group-hover:bg-primary/20 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl transition-all group-hover:shadow-md">
                    {(() => {
                      const DynIcon = item.icon;
                      return <DynIcon size={28} />;
                    })()}
                  </div>
                  <span className="bg-primary absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white">
                    {item.passo}
                  </span>
                </div>
                <h3 className="text-base font-semibold">{item.titulo}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {item.descricao}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link href="/triagem">
              <Button
                size="lg"
                className="btn-pill bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-8"
                nativeButton={false}
              >
                Iniciar minha jornada
                <ChevronRight size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Seção Humana — Imagem + Diferenciais ─────────── */}
      <section className="overflow-hidden py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            {/* Coluna esquerda — Imagem com detalhe de profundidade */}
            <div className="relative">
              {/* Quadrado decorativo de fundo */}
              <div
                className="bg-primary/6 absolute -top-4 -left-4 h-full w-full rounded-3xl lg:-top-6 lg:-left-6"
                aria-hidden="true"
              />
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-2xl">
                <Image
                  src="/images/home/shutterstock_2203716633.jpg"
                  alt="Paciente idoso sendo acolhido com cuidado e atenção por profissional de saúde"
                  fill
                  className="object-cover"
                  style={{ objectPosition: 'center 35%' }}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  quality={85}
                />
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
                nasceu justamente para que ninguém precise enfrentar esse caminho sozinho — com
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
                <Link href="/triagem">
                  <Button
                    size="lg"
                    className="btn-pill bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-8"
                    nativeButton={false}
                  >
                    Quero ser acolhido
                    <ChevronRight size={16} />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA — Seção Escura ────────────────────────────── */}
      <section className="section-dark py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="font-display text-3xl leading-tight font-bold tracking-tight text-white sm:text-4xl">
                Estamos prontos <span className="text-accent-italic">para te ajudar.</span>
              </h2>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-white/70">
                Esse formulário é o primeiro passo para entender sua história e te conectar com o
                cuidado certo. Sem pressa, sem julgamento, sem custo.
              </p>

              <ul className="mt-8 space-y-4">
                {COMO_FUNCIONA.map((item) => (
                  <li key={item.passo} className="flex items-start gap-4">
                    <span className="bg-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
                      {item.passo}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.titulo}</p>
                      <p className="mt-0.5 text-sm text-white/60">{item.descricao}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Card de triagem simplificado */}
            <Card className="bg-card border-0 shadow-xl">
              <CardContent className="p-8">
                <h3 className="font-display text-lg font-semibold">Iniciar triagem</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  Preencha algumas informações básicas para que nossa equipe possa avaliar o seu
                  caso.
                </p>

                <div className="mt-6 space-y-4">
                  <div>
                    <label className="text-muted-foreground mb-1.5 block text-xs font-medium tracking-wider uppercase">
                      Nome completo
                    </label>
                    <input
                      type="text"
                      placeholder="Seu nome"
                      className="border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-primary w-full rounded-lg border px-4 py-2.5 text-sm focus:ring-1"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground mb-1.5 block text-xs font-medium tracking-wider uppercase">
                      WhatsApp
                    </label>
                    <input
                      type="tel"
                      placeholder="(11) 98123-4567"
                      className="border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-primary w-full rounded-lg border px-4 py-2.5 text-sm focus:ring-1"
                    />
                  </div>
                </div>

                <Link href="/triagem" className="mt-6 block">
                  <Button
                    className="btn-pill bg-primary text-primary-foreground hover:bg-primary/90 w-full gap-2"
                    nativeButton={false}
                  >
                    Preencher formulário
                    <ChevronRight size={16} />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Histórias que importam ────────────────────────── */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Histórias que <span className="text-accent-italic">importam.</span>
            </h2>
            <Link
              href="/mundo-endocanabinoide"
              className="text-primary hidden text-sm font-medium hover:underline sm:inline-flex sm:items-center sm:gap-1"
            >
              Ver todas as histórias
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {HISTORIAS.map((historia) => (
              <article key={historia.titulo} className="group">
                {/* Imagem real */}
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                  <Image
                    src={historia.imagem}
                    alt={historia.alt}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    quality={80}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />
                </div>
                <div className="mt-4">
                  <span className="bg-muted text-muted-foreground inline-block rounded-full px-3 py-0.5 text-xs font-medium">
                    {historia.categoria}
                  </span>
                  <h3 className="font-display mt-2 text-base leading-snug font-semibold">
                    {historia.titulo}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm">{historia.subtitulo}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/mundo-endocanabinoide"
              className="text-primary text-sm font-medium hover:underline"
            >
              Ver todas as histórias →
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA Final — Vamos conversar? ─────────────────── */}
      <section className="border-border border-t py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Vamos <span className="text-accent-italic">conversar?</span>
            </h2>
            <div className="flex items-center gap-4">
              <Link href="https://wa.me/5511932047360" target="_blank" rel="noopener noreferrer">
                <Button
                  size="lg"
                  className="btn-pill bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-8"
                  nativeButton={false}
                >
                  WhatsApp
                  <ChevronRight size={16} />
                </Button>
              </Link>
              <Link href="/entre-em-contato">
                <Button variant="outline" size="lg" className="btn-pill px-8" nativeButton={false}>
                  Outras formas
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
