import type { Metadata } from 'next';
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
import { listarMedicosPublico } from '@/app/(public)/_actions/agendamento';
import {
  Brain,
  ChevronRight,
  Heart,
  HeartHandshake,
  HeartPulse,
  MessageCircle,
  Scale,
  Shield,
  Star,
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

const TESTEMUNHOS = [
  {
    inicial: 'M',
    nome: 'Maria S., 47',
    local: 'Campinas',
    sobre: 'sobre o acolhimento',
    texto:
      'Eu tinha medo de que fosse complicado ou ilegal. O que mais me marcou foi não ter ninguém me empurrando nada — só me explicando, no meu tempo. Me senti acolhida.',
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
    pergunta: 'É legal usar cannabis medicinal no Brasil?',
    resposta:
      'Sim. O acesso é regulamentado pela ANVISA (RDC 1015 e RDC 660), com receita médica e autorização oficial de importação.',
  },
  {
    pergunta: 'Preciso de laudo ou diagnóstico pronto antes?',
    resposta:
      'Não necessariamente. A triagem é o primeiro passo: você conta o que sente e o médico avalia, na consulta, o que faz sentido para você.',
  },
  {
    pergunta: 'Quanto custa o processo?',
    resposta:
      'Começar é gratuito — a triagem não tem custo nem compromisso. Como associação sem fins lucrativos, os valores de consulta e autorização são apresentados com transparência antes de qualquer decisão.',
  },
  {
    pergunta: 'E se o médico não indicar?',
    resposta:
      'Então o processo para por aí — você não paga por produto que não foi prescrito. Quem decide é sempre o médico.',
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
      'Sim. O acolhimento continua depois do início — você não fica sozinho.',
  },
];

/* ── Componente ─────────────────────────────────────── */

export default async function HomePage() {
  const medicosResult = await listarMedicosPublico();
  const medicosData = (medicosResult.sucesso && medicosResult.dados) ? medicosResult.dados : [];

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
                    className="btn-pill bg-secondary text-white border border-primary hover:bg-secondary/90 gap-2 px-8"
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
                    className="btn-pill border-primary text-secondary hover:bg-secondary/10 gap-2 px-8"
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

      {/* ── Seletor de patologias ─────────────────────────── */}
      <PatologiasPicker />

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

              {/* CTA — Falar com especialista */}
              <div className="mt-8">
                <Link href="https://wa.me/5511932047360" target="_blank" rel="noopener noreferrer">
                  <Button
                    size="lg"
                    className="btn-pill bg-secondary text-white border border-primary hover:bg-secondary/90 gap-2 px-8"
                    nativeButton={false}
                  >
                    <MessageCircle size={16} />
                    Falar com um especialista
                  </Button>
                </Link>
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
              {
                icon: Scale,
                titulo: 'É legal?',
                descricao:
                  'Sim. O acesso é regulamentado pela ANVISA (RDC 660 e RDC 1015), com receita médica e autorização oficial. Tudo dentro da lei, do começo ao fim.',
              },
              {
                icon: Heart,
                titulo: 'Quanto custa?',
                descricao:
                  'Começar não tem custo: a triagem é gratuita e sem compromisso. Como associação sem fins lucrativos, você sabe cada valor antes de decidir — e há apoio para casos de maior vulnerabilidade.',
              },
            ];
            const renderCard = (item: (typeof CARDS)[number]) => (
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
            );
            return (
              <>
                {/* Linha superior — 3 cards */}
                <div className="mt-16 grid gap-4 sm:gap-8 sm:grid-cols-3">
                  {CARDS.slice(0, 3).map(renderCard)}
                </div>
                {/* Linha inferior — 2 cards centrados (pirâmide invertida) */}
                <div className="mt-4 sm:mt-8 mx-auto grid w-full max-w-2xl gap-4 sm:gap-8 sm:grid-cols-2">
                  {CARDS.slice(3).map(renderCard)}
                </div>
              </>
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
                  className="btn-pill bg-secondary text-white border border-primary hover:bg-secondary/90 gap-2 px-8"
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

      {/* ── Testemunhos — Pessoas reais ───────────────────── */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="bg-secondary/10 text-secondary inline-block rounded-full px-3 py-1 text-xs font-semibold">
              Histórias reais
            </span>
            <h2 className="font-display mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              Pessoas reais, <span className="text-accent-italic">acompanhadas de verdade</span>
            </h2>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
      <section className="border-border bg-muted/30 border-y py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
                médicos parceiros habilitados — independentes, sem remuneração por venda de produto
              </strong>
              . Aqui o médico não ganha pra te empurrar nada.
            </p>
          </div>

          {medicosData.length > 0 && (
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:mx-auto lg:max-w-4xl">
              {medicosData.map((m) => {
                const iniciais = m.nome
                  .split(' ')
                  .filter(Boolean)
                  .map((w) => w[0].toUpperCase())
                  .slice(0, 2)
                  .join('');
                return (
                  <Card key={m.id} className="bg-card border-0 shadow-sm">
                    <CardContent className="flex flex-col items-center p-8 text-center">
                      {m.avatarUrl ? (
                        <Image
                          src={m.avatarUrl}
                          alt={m.nome}
                          width={80}
                          height={80}
                          className="h-20 w-20 rounded-full object-cover"
                        />
                      ) : (
                        <div className="gradient-moss flex h-20 w-20 items-center justify-center rounded-full text-xl font-bold text-white">
                          {iniciais}
                        </div>
                      )}
                      <h3 className="mt-5 text-base font-semibold">{m.nome}</h3>
                      <p className="text-muted-foreground mt-1 text-sm">{m.especialidade}</p>
                      {m.crm && (
                        <p className="text-primary mt-3 text-sm font-semibold tracking-wide">
                          CRM {m.crm}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
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
                    className="btn-pill bg-secondary text-white border border-primary hover:bg-secondary/90 gap-2 px-8"
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

      {/* ── FAQ — Antes de começar ────────────────────────── */}
      <section className="py-20 lg:py-28">
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
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#C86070] to-[#F5C5CA] px-6 py-16 text-center sm:px-12">
            <span className="inline-block rounded-full bg-[#5C1825]/15 px-3 py-1 text-xs font-semibold text-[#5C1825]">
              No seu tempo, sem compromisso
            </span>
            <h2 className="font-display mx-auto mt-5 max-w-2xl text-3xl leading-tight font-bold tracking-tight text-[#3D0F17] sm:text-4xl">
              Dê o primeiro passo do seu cuidado
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#3D0F17]/75">
              A triagem leva poucos minutos e quem te atende é gente de verdade. Sem pressão, sem
              julgamento.
            </p>
            <div className="mt-8 flex justify-center">
              <Link href="/triagem">
                <Button
                  size="lg"
                  className="btn-pill bg-secondary text-white border border-secondary/30 hover:bg-secondary/90 gap-2 px-8"
                  nativeButton={false}
                >
                  Iniciar minha triagem gratuita
                  <ChevronRight size={16} />
                </Button>
              </Link>
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-xs leading-relaxed text-[#3D0F17]/55">
              Conteúdo informativo. A indicação de uso e a posologia são definidas exclusivamente
              pelo médico após avaliação. Não prometemos cura nem resultado.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
