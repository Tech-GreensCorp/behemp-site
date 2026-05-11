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
  HeartPulse,
  Leaf,
  Package,
  Search,
  Shield,
  Stethoscope,
  Users,
} from 'lucide-react';
export const metadata: Metadata = {
  title: 'Be4Hope — Cuidar de quem cuida é nosso ato de amor',
  description:
    'Há mais de duas décadas conectando pessoas ao cuidado com cannabis medicinal. Acolhimento humanizado, sem julgamento, sem custo.',
};

/* ── Dados ──────────────────────────────────────────── */

const STATS = [
  { valor: '21', label: 'anos de história' },
  { valor: 'ONG', label: 'sem fins lucrativos' },
  { valor: '26', label: 'estados atendidos' },
  { valor: 'Anvisa', label: 'regulamentado RDC 660' },
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
    titulo: 'Cannabis medicinal e qualidade de vida: o que a evidência mostra',
    subtitulo: 'Como o uso terapêutico responsável tem transformado o dia a dia de quem convive com condições crônicas.',
    categoria: 'Bem-estar',
    imagem: '/images/home/historia-familia-sofa.jpg',
    alt: 'Família reunida em momento de leveza e bem-estar',
  },
  {
    titulo: 'O que a ciência diz sobre cuidado integrativo em 2026',
    subtitulo: 'Novos estudos apresentam tratamentos inovadores.',
    categoria: 'Ciência',
    imagem: '/images/home/historia-meditacao.jpg',
    alt: 'Mulher meditando em meio à natureza — bem-estar e equilíbrio',
  },
  {
    titulo: 'Be4Hope completa 21 anos e os próximos ciclos',
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
              <p className="mb-6 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Acolhimento · Cannabis Medicinal
              </p>

              <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Cuidar de quem
                <br />
                cuida é nosso
                <br />
                <span className="text-accent-italic">ato de amor.</span>
              </h1>

              <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                Há mais de duas décadas conectando pessoas ao cuidado com
                cannabis medicinal. Sem pressa, sem julgamento, sem custo.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/triagem">
                  <Button
                    size="lg"
                    className="btn-pill gap-2 bg-primary px-8 text-primary-foreground hover:bg-primary/90"
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
                    className="btn-pill gap-2 border-foreground/20 px-8"
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
      <section className="border-y border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="px-6 py-8 text-center">
                <p className="font-display text-3xl font-bold text-primary sm:text-4xl">
                  {stat.valor}
                </p>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
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
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
                Desde 2004
              </p>
              <h2 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Há duas décadas{' '}
                <span className="text-accent-italic">cuidando</span> de quem
                mais precisa.
              </h2>
              <div className="mt-8 space-y-5 text-base leading-relaxed text-muted-foreground">
                <p className="drop-cap">
                  A <strong className="text-foreground">Be4Hope</strong> é uma{' '}
                  <strong className="text-foreground">organização filantrópica sem fins lucrativos</strong>{' '}
                  que, desde 2004, acolhe e apoia famílias e indivíduos com condições neurológicas,
                  patologias e doenças crônicas. Nosso trabalho é cuidar de quem precisa,
                  oferecendo apoio humano, acesso a{' '}
                  <strong className="text-foreground">tratamentos seguros</strong> e informações de confiança.
                </p>
                <p>
                  Acreditamos que{' '}
                  <strong className="text-foreground">saúde é um direito de todos</strong>{' '}
                  — não importa onde você mora ou qual é a sua condição financeira.
                  Por isso, atuamos para garantir que{' '}
                  <strong className="text-foreground">medicamentos essenciais</strong>{' '}
                  cheguem de forma justa e legal até quem realmente precisa.
                </p>
                <p>
                  Nosso sistema de distribuição é{' '}
                  <strong className="text-foreground">legalizado, transparente e eficiente</strong>,
                  feito com responsabilidade e muito respeito à vida. Também apoiamos a{' '}
                  <strong className="text-foreground">pesquisa científica</strong>, porque
                  acreditamos no poder da informação e da inovação para mudar realidades.
                </p>
                <p className="text-base font-medium text-foreground">
                  Somos uma rede de cuidado, esperança e transformação. Somos a Be4Hope.
                </p>
              </div>
            </div>

            {/* Ilustração família — Quem Somos */}
            <div className="flex flex-col gap-6">
              <div className="relative aspect-[4/3]">
                <Image
                  src="/images/home/quem-somos-familia.jpg"
                  alt="Ilustração de família multigeracional — representando todas as idades atendidas pela Be4Hope"
                  fill
                  className="object-contain"
                  style={{ mixBlendMode: 'multiply' }}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  quality={85}
                />
              </div>

              {/* Cards de especialidade */}
              <div className="grid gap-4 sm:grid-cols-2">
              {ESPECIALIDADES.map((esp) => (
                <Card
                  key={esp.titulo}
                  className="group border-0 bg-card shadow-sm transition-all hover:shadow-md"
                >
                  <CardContent className="p-6">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted transition-colors group-hover:bg-primary/10">
                      {(() => { const DynIcon = esp.icon; return <DynIcon size={20} />; })()}
                    </div>
                    <h3 className="text-sm font-semibold">{esp.titulo}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
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
      <section className="border-y border-border bg-muted/30 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              Nossa missão
            </p>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              Por que{' '}
              <span className="text-accent-italic">Be4Hope?</span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
              A Be4Hope é muito mais do que uma ONG. Somos uma rede de acolhimento,
              cuidado e transformação, que conecta pacientes a tratamentos seguros,
              eficazes e acessíveis com cannabis medicinal.
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
                icon: Search,
                titulo: 'Transparência nos preços',
                descricao:
                  'Promovemos a transparência nos preços dos medicamentos, negociando ativamente com fornecedores para garantir custos acessíveis e justos.',
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
                className="group border-0 bg-background shadow-sm transition-all hover:shadow-md"
              >
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                    {(() => { const DynIcon = item.icon; return <DynIcon size={22} />; })()}
                  </div>
                  <h3 className="text-sm font-semibold">{item.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.descricao}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="mt-12 text-center text-base font-medium text-foreground">
            Somos a Be4Hope:{' '}
            <span className="text-primary">cuidado, acesso, transformação.</span>
          </p>
        </div>
      </section>

      {/* ── 3. Collab Be4Hope ─────────────────────────────── */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              Ecossistema
            </p>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              Collab Be4Hope:{' '}
              <span className="text-accent-italic">conectando pessoas e soluções</span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
              A Be4Hope é uma <strong className="text-foreground">collaboration (collab)</strong>{' '}
              formada por empresas e instituições que promovem um modelo inovador de saúde — mais
              humano, acessível e centrado no paciente, utilizando a cannabis medicinal como terapia,
              sempre com base científica e responsabilidade.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:max-w-4xl lg:mx-auto">
            {/* Greens */}
            <Card className="group relative overflow-hidden border-0 bg-card shadow-sm transition-all hover:shadow-lg">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-green-500 to-green-400" />
              <CardContent className="p-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100">
                  <Leaf size={22} className="text-green-600" />
                </div>
                <h3 className="font-display text-lg font-bold">Greens</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">Produção e distribuição</strong> de medicamentos
                  à base de cannabis com qualidade e segurança.{' '}
                  <strong className="text-foreground">Educação médica</strong> para promover o uso
                  consciente da terapia canabinóide.
                </p>
                <ul className="mt-4 space-y-2">
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-500" />
                    Investimento em pesquisa e inovação
                  </li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-500" />
                    Padrões internacionais de cultivo e extração
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Be 4Hope */}
            <Card className="group relative overflow-hidden border-0 bg-card shadow-sm transition-all hover:shadow-lg">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-primary/70" />
              <CardContent className="p-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <HeartPulse size={22} className="text-primary" />
                </div>
                <h3 className="font-display text-lg font-bold">Be 4Hope</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Atua como <strong className="text-foreground">ponte entre pacientes, familiares e o
                  ecossistema</strong> da cannabis medicinal. Trabalha em rede com parceiros para criar
                  soluções personalizadas.
                </p>
                <ul className="mt-4 space-y-2">
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" />
                    Ponte entre pacientes e tratamentos
                  </li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" />
                    Soluções personalizadas em rede
                  </li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" />
                    Missão: colaboração salva vidas
                  </li>
                </ul>
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
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
                Ciência e cuidado
              </p>
              <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
                Medicina{' '}
                <span className="text-accent-italic">Endocanabinóide</span>
              </h2>
              <div className="mt-6 space-y-4 text-base leading-relaxed text-white/70">
                <p>
                  A cannabis medicinal tem se mostrado eficaz no tratamento de diversas doenças
                  raras e crônicas, desde dores crônicas até distúrbios neurológicos.
                </p>
                <p>
                  Seu uso no Brasil é regulamentado pela{' '}
                  <strong className="text-white">RDC 660 da Anvisa</strong>, garantindo
                  segurança e controle. A Be4Hope atua com responsabilidade dentro desse cenário,
                  sempre buscando as melhores soluções para os pacientes.
                </p>
                <p>
                  Seus principais componentes ativos — o{' '}
                  <strong className="text-white">CBD</strong> (canabidiol) e o{' '}
                  <strong className="text-white">THC</strong> (tetra-hidrocanabinol) — demonstraram
                  propriedades analgésicas, anti-inflamatórias, ansiolíticas e neuroprotetoras.
                </p>
              </div>
              <Link href="/mundo-endocanabinoide" className="mt-8 inline-flex">
                <Button
                  size="lg"
                  className="btn-pill gap-2 bg-primary px-8 text-primary-foreground hover:bg-primary/90"
                  nativeButton={false}
                >
                  Quero saber mais
                  <ChevronRight size={16} />
                </Button>
              </Link>
            </div>

            {/* Imagem — Óleo CBD */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-lg">
              <Image
                src="/images/home/medicina-oleo-cbd.jpg"
                alt="Pessoa utilizando óleo de CBD com conta-gotas — medicina canabinóide"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                quality={85}
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
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              Jornada do paciente
            </p>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              Do zero até{' '}
              <span className="text-accent-italic">a sua casa</span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Entenda o passo a passo para acessar seu tratamento com cannabis medicinal de forma
              segura e legalizada.
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
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 transition-all group-hover:bg-primary/20 group-hover:shadow-md">
                    {(() => { const DynIcon = item.icon; return <DynIcon size={28} />; })()}
                  </div>
                  <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {item.passo}
                  </span>
                </div>
                <h3 className="text-base font-semibold">{item.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.descricao}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link href="/triagem">
              <Button
                size="lg"
                className="btn-pill gap-2 bg-primary px-8 text-primary-foreground hover:bg-primary/90"
                nativeButton={false}
              >
                Iniciar minha jornada
                <ChevronRight size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA — Seção Escura ────────────────────────────── */}
      <section className="section-dark py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
                Estamos prontos{' '}
                <span className="text-accent-italic">para te ajudar.</span>
              </h2>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-white/70">
                Esse formulário é o primeiro passo para entender sua história e
                te conectar com o cuidado certo. Sem pressa, sem julgamento, sem custo.
              </p>

              <ul className="mt-8 space-y-4">
                {COMO_FUNCIONA.map((item) => (
                  <li key={item.passo} className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
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
            <Card className="border-0 bg-card shadow-xl">
              <CardContent className="p-8">
                <h3 className="font-display text-lg font-semibold">Iniciar triagem</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Preencha algumas informações básicas para que nossa equipe
                  possa avaliar o seu caso.
                </p>

                <div className="mt-6 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Nome completo
                    </label>
                    <input
                      type="text"
                      placeholder="Seu nome"
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      WhatsApp
                    </label>
                    <input
                      type="tel"
                      placeholder="(11) 98123-4567"
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <Link href="/triagem" className="mt-6 block">
                  <Button
                    className="btn-pill w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
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
              Histórias que{' '}
              <span className="text-accent-italic">importam.</span>
            </h2>
            <Link
              href="/mundo-endocanabinoide"
              className="hidden text-sm font-medium text-primary hover:underline sm:inline-flex sm:items-center sm:gap-1"
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
                  <span className="inline-block rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">
                    {historia.categoria}
                  </span>
                  <h3 className="mt-2 font-display text-base font-semibold leading-snug">
                    {historia.titulo}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {historia.subtitulo}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/mundo-endocanabinoide"
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver todas as histórias →
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA Final — Vamos conversar? ─────────────────── */}
      <section className="border-t border-border py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Vamos{' '}
              <span className="text-accent-italic">conversar?</span>
            </h2>
            <div className="flex items-center gap-4">
              <Link
                href="https://wa.me/5511932047360"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  className="btn-pill gap-2 bg-primary px-8 text-primary-foreground hover:bg-primary/90"
                  nativeButton={false}
                >
                  WhatsApp
                  <ChevronRight size={16} />
                </Button>
              </Link>
              <Link href="/entre-em-contato">
                <Button
                  variant="outline"
                  size="lg"
                  className="btn-pill px-8"
                  nativeButton={false}
                >
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
