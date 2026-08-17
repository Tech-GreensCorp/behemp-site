import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ShieldCheck,
  FileCheck,
  Truck,
  Headset,
  ArrowRight,
  Droplet,
  Pill,
  Gift,
  Tag,
  Package,
  Heart,
  HeartHandshake,
  UserRound,
  BookOpenCheck,
  UserCheck,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { listarCategorias, type CategoriaProdutoSlug } from './_lib/produtos';

export const metadata: Metadata = {
  title: 'Nossa Farmácia | Be4Hope',
  description: 'Produtos de medicina endocanabinoide com procedência, prescrição validada e entrega discreta.',
};

const ICONES_CATEGORIA: Record<CategoriaProdutoSlug, typeof Droplet> = {
  'oleos-sublinguais': Droplet,
  'capsulas-softgels': Pill,
  'outros-produtos': Package,
};

const BADGES_CONFIANCA = [
  { icone: ShieldCheck, label: 'Produtos 100% originais' },
  { icone: FileCheck, label: 'Prescrição segura' },
  { icone: Truck, label: 'Entrega discreta' },
  { icone: Heart, label: 'Atendimento humanizado' },
];

const BENEFICIOS = [
  {
    icone: UserRound,
    titulo: 'Consulta online com especialistas',
    descricao: 'Agende sua consulta com médicos preparados.',
    linkLabel: 'Agendar agora',
    href: '/agendamento',
  },
  {
    icone: FileCheck,
    titulo: 'Prescrição digital segura',
    descricao: 'Prescrições válidas e 100% digitais.',
    linkLabel: 'Saiba mais',
    href: '/paciente/prescricoes',
  },
  {
    icone: Truck,
    titulo: 'Entrega rápida e discreta',
    descricao: 'Receba seus produtos com sigilo e segurança.',
  },
  {
    icone: Headset,
    titulo: 'Suporte humanizado',
    descricao: 'Nossa equipe está pronta para te ajudar.',
    linkLabel: 'Fale conosco',
    href: '/paciente/chat',
  },
];

const PROGRAMAS = [
  {
    icone: Gift,
    titulo: 'Programas de Acesso',
    descricao: 'Conheça os programas que facilitam seu tratamento.',
    linkLabel: 'Conhecer programas',
    href: '/programa-acesso-solidario',
  },
  {
    icone: Tag,
    titulo: 'Produtos com condições especiais',
    descricao: 'Acesse descontos em nossos programas de acesso.',
    linkLabel: 'Ver condições',
    href: '/programa-acesso-solidario',
  },
  {
    icone: HeartHandshake,
    titulo: 'Mais que uma loja, um propósito.',
    descricao: 'Parte da sua compra apoia a Fundação Be4Hope e seus projetos sociais.',
    linkLabel: 'Conheça a Be4Hope',
    href: '/parceiros',
  },
];

const PILARES = [
  { icone: HeartHandshake, label: 'Acolhimento que faz bem' },
  { icone: BookOpenCheck, label: 'Informação que empodera' },
  { icone: UserCheck, label: 'Acesso que transforma' },
];

export default function FarmaciaPage() {
  const categorias = listarCategorias();

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-2xl border border-border/20 bg-white shadow-sm sm:rounded-3xl animate-fade-up">
        <div className="relative grid gap-8 lg:grid-cols-2 lg:gap-0">
          <div className="flex flex-col justify-center gap-5 p-6 sm:p-10 lg:p-12">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-foreground">
              Saúde. <span className="text-primary">Acesso.</span> Cuidado.
            </p>
            <h1 className="font-display text-3xl font-bold uppercase leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Cuidado de <span className="text-primary">qualidade</span>.
              <br />
              Pra quem importa.
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              Na <span className="font-bold">Pharma One</span>, você encontra tratamentos com medicina endocanabinoide, suporte
              especializado e todo o cuidado que você merece.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4 sm:gap-3">
              {BADGES_CONFIANCA.map(({ icone: Icone, label }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-[11px] font-medium leading-tight text-foreground sm:text-xs">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
              <Button
                render={<Link href="/paciente/farmacia/marketplace" />}
                nativeButton={false}
                size="lg"
                className="h-11 w-full rounded-full px-6 text-sm font-bold sm:w-auto"
              >
                Ver produtos
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                render={<Link href="#como-funciona" />}
                nativeButton={false}
                variant="outline"
                size="lg"
                className="h-11 w-full rounded-full px-6 text-sm font-bold sm:w-auto"
              >
                Como funciona
              </Button>
            </div>
          </div>

          <div className="relative min-h-[240px] overflow-hidden bg-white sm:min-h-[320px] lg:min-h-[420px]">
            <Image
              src="/images/home/hero-be-pessoa-4.png"
              alt="Paciente Be4Hope"
              fill
              className="object-contain object-bottom p-4 sm:p-6"
              priority
            />

            <div className="absolute right-3 top-3 rounded-md bg-primary px-3 py-1.5 text-center shadow-md sm:right-8 sm:top-8 sm:px-4 sm:py-2">
              <p className="text-xs font-bold leading-none text-primary-foreground sm:text-sm">+8.000</p>
              <p className="text-[9px] leading-none text-primary-foreground/80 sm:text-[10px]">
                pacientes atendidos
              </p>
            </div>

            <Card className="absolute bottom-4 left-4 right-4 flex-row items-center gap-3 rounded-2xl border border-border/20 bg-white/95 p-3 shadow-md backdrop-blur sm:left-8 sm:right-auto sm:max-w-xs">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Heart className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Uma parceria que faz a diferença</p>
                <p className="text-[11px] text-muted-foreground">
                  Acolhimento, informação e acesso à saúde de qualidade.
                </p>
              </div>
            </Card>
          </div>

          {/* ── Selo de parceria: visível apenas no desktop, centralizado entre o texto e a foto ── */}
          <div className="hidden lg:absolute lg:left-1/2 lg:top-[22%] lg:z-10 lg:flex lg:-translate-x-1/2 lg:-translate-y-1/2 lg:items-center lg:justify-center">
            <div className="flex items-center gap-11">
              <Image
                src="/images/farmacia/logo-pharma-one.png"
                alt="Pharma One"
                width={440}
                height={440}
                className="h-28 w-auto object-contain"
              />
              <span className="text-7xl font-thin text-muted-foreground/30">×</span>
              <Image
                src="/logo.png"
                alt="Be4Hope"
                width={280}
                height={94}
                className="h-20 w-auto object-contain"
              />
            </div>
          </div>
        </div>

        {/* ── Faixa de categorias ── */}
        <div className="grid grid-cols-1 gap-px border-t border-border/20 bg-border/20 sm:grid-cols-3">
          {categorias.map((categoria) => {
            const Icone = ICONES_CATEGORIA[categoria.slug];
            return (
              <Link
                key={categoria.slug}
                href={`/paciente/farmacia/marketplace?categoria=${categoria.slug}`}
                className="group flex items-center gap-3 bg-white p-4 transition-colors hover:bg-primary/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icone className="h-5 w-5" />
                </div>
                <span className="flex-1 text-xs font-bold leading-tight text-foreground">
                  {categoria.nome}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Benefícios / Como funciona ── */}
      <section id="como-funciona" className="scroll-mt-24 space-y-5 animate-fade-up delay-75">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">Como funciona</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tudo pensado para o seu tratamento, do pedido à entrega.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFICIOS.map((beneficio) => {
            const Icone = beneficio.icone;
            const conteudo = (
              <Card className="h-full gap-3 rounded-2xl border border-border/20 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Icone className="h-5 w-5" />
                </div>
                <p className="font-display text-sm font-bold text-foreground">{beneficio.titulo}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{beneficio.descricao}</p>
                {beneficio.href && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                    {beneficio.linkLabel} <ArrowRight className="h-3 w-3" />
                  </span>
                )}
              </Card>
            );

            return beneficio.href ? (
              <Link key={beneficio.titulo} href={beneficio.href}>
                {conteudo}
              </Link>
            ) : (
              <div key={beneficio.titulo}>{conteudo}</div>
            );
          })}
        </div>
      </section>

      {/* ── Programas de acesso ── */}
      <section className="grid gap-px overflow-hidden rounded-2xl border border-border/20 bg-border/20 animate-fade-up delay-150 sm:grid-cols-3 sm:rounded-3xl">
        {PROGRAMAS.map((programa) => {
          const Icone = programa.icone;
          return (
            <Link
              key={programa.titulo}
              href={programa.href}
              className="group flex items-start gap-3 bg-primary-soft p-5 transition-colors hover:bg-primary/10 sm:p-6"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
                <Icone className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <p className="font-display text-sm font-bold leading-snug text-foreground">
                  {programa.titulo}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">{programa.descricao}</p>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                  {programa.linkLabel} <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          );
        })}
      </section>

      {/* ── Parceria Nossa Farmácia x Be4Hope ── */}
      <section className="grid gap-8 rounded-2xl border border-border/20 bg-white p-6 shadow-sm animate-fade-up delay-150 sm:rounded-3xl sm:p-10 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div className="space-y-4">
          <h2 className="font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            Parceria que transforma vidas.
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            A Pharma One e a Be4Hope trabalham juntas por um propósito maior: levar acolhimento,
            informação e acesso à saúde de qualidade para mais pessoas.
          </p>
          <Link
            href="/parceiros"
            className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
          >
            Conheça mais sobre a Be4Hope
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-border/20 bg-white p-3 shadow-sm sm:h-24 sm:w-24">
              <Image
                src="/images/farmacia/logo-pharma-one.png"
                alt="Pharma One"
                width={240}
                height={240}
                className="h-auto w-full object-contain"
              />
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Heart className="h-4 w-4" />
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border/20 bg-white shadow-sm sm:h-24 sm:w-24">
              <Image
                src="/logo.png"
                alt="Be4Hope"
                width={56}
                height={56}
                className="h-10 w-auto object-contain sm:h-12"
              />
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
            {PILARES.map(({ icone: Icone, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 rounded-2xl bg-muted/40 p-4 text-center"
              >
                <Icone className="h-5 w-5 text-primary" />
                <span className="text-xs font-semibold leading-tight text-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
