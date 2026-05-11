import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  ArrowUpRight,
  Award,
  ChevronRight,
  ExternalLink,
  Leaf,
  FlaskConical,
  ShieldCheck,
  Sprout,
  HeartHandshake,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Parceiros',
  description:
    'Conheça os parceiros da Be4Hope na missão de democratizar a medicina endocanabinóide no Brasil.',
};

const DIFERENCIAIS = [
  {
    icon: FlaskConical,
    titulo: 'Laudos verificados',
    descricao: 'Todos os produtos possuem análises laboratoriais independentes com certificado de autenticidade.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Conformidade Anvisa',
    descricao: 'Rigoroso cumprimento da regulamentação brasileira e padrões internacionais GMP.',
  },
  {
    icon: Sprout,
    titulo: 'Rastreabilidade total',
    descricao: 'Do cultivo à entrega, cada lote é rastreado para garantir procedência e qualidade.',
  },
  {
    icon: HeartHandshake,
    titulo: 'Suporte dedicado',
    descricao: 'Equipe exclusiva para pacientes Be4Hope com atendimento prioritário e humanizado.',
  },
];

export default function ParceirosPage() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center animate-fade-up">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Ecossistema
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Nossos{' '}
            <span className="text-accent-italic">parceiros.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Trabalhamos junto com empresas comprometidas em levar
            tratamentos de qualidade para quem mais precisa.
          </p>
        </div>

        {/* ── Card Greens Premium ───────────────────────── */}
        <div className="mt-16 animate-fade-up delay-200">
          <div className="group relative overflow-hidden rounded-3xl bg-white shadow-xl transition-all duration-500 hover:shadow-2xl">
            {/* Barra superior com gradiente animada */}
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-green-500 via-emerald-400 to-green-600 transition-all duration-500 group-hover:h-2" />

            <div className="grid md:grid-cols-5">
              {/* Coluna esquerda — Informações */}
              <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-12 md:col-span-3">
                {/* Badge + Ícone */}
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-green-100 to-emerald-50 shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <Leaf size={26} className="text-green-600" />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-green-700">
                      <Award size={12} />
                      Parceiro estratégico
                    </span>
                  </div>
                </div>

                {/* Título */}
                <h2 className="mt-6 font-display text-3xl font-bold tracking-tight">
                  Greens
                  <span className="ml-2 text-green-600">Corp</span>
                </h2>

                {/* Descrição */}
                <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                  A <strong className="text-foreground">Greens</strong> é nossa parceira
                  estratégica no fornecimento de produtos canabinóides de alta qualidade.
                  Com rigoroso controle de qualidade e certificações internacionais,
                  garantimos que nossos pacientes tenham acesso aos melhores produtos
                  disponíveis no mercado.
                </p>

                {/* Grid de diferenciais */}
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {DIFERENCIAIS.map((item, i) => (
                    <div
                      key={item.titulo}
                      className="group/item flex items-start gap-3 rounded-xl border border-transparent p-3 transition-all duration-300 hover:border-green-100 hover:bg-green-50/50"
                      style={{ animationDelay: `${(i + 2) * 100}ms` }}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 transition-colors duration-300 group-hover/item:bg-green-100">
                        <item.icon size={16} className="text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.titulo}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {item.descricao}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-8">
                  <Link
                    href="https://greens-corp.com/#about-us"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      className="btn-pill gap-2 bg-green-600 px-8 text-white shadow-lg shadow-green-600/20 transition-all duration-300 hover:bg-green-700 hover:shadow-xl hover:shadow-green-600/30 hover:gap-3"
                      nativeButton={false}
                    >
                      Saiba mais sobre a Greens
                      <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Coluna direita — Visual card */}
              <div className="relative md:col-span-2 min-h-[300px] overflow-hidden">
                {/* Gradiente de fundo */}
                <div className="absolute inset-0 bg-gradient-to-br from-green-600 via-emerald-600 to-green-800 transition-all duration-700 group-hover:from-green-500 group-hover:via-emerald-500 group-hover:to-green-700" />

                {/* Padrão decorativo */}
                <div className="absolute inset-0 opacity-[0.07]" style={{
                  backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                  backgroundSize: '20px 20px',
                }} />

                {/* Círculos decorativos animados */}
                <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 transition-transform duration-700 group-hover:scale-125" />
                <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/10 transition-transform duration-700 group-hover:scale-150 group-hover:translate-x-4" />
                <div className="absolute right-16 bottom-20 h-20 w-20 rounded-full bg-white/5 transition-transform duration-500 group-hover:scale-110" />

                {/* Conteúdo central */}
                <div className="relative flex h-full flex-col items-center justify-center p-8 text-center">
                  {/* Logo/Ícone animado */}
                  <div className="relative">
                    <div className="absolute inset-0 animate-gentle-pulse rounded-3xl bg-white/20 blur-xl" />
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-sm transition-all duration-500 group-hover:scale-110 group-hover:bg-white/25 group-hover:rounded-[2rem]">
                      <Leaf size={44} className="text-white transition-transform duration-500 group-hover:scale-110" />
                    </div>
                  </div>

                  <h3 className="mt-6 font-display text-2xl font-bold text-white">
                    Greens
                  </h3>
                  <p className="mt-2 text-sm text-white/60">
                    Produtos canabinóides de excelência
                  </p>

                  {/* Selo */}
                  <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur-sm transition-colors duration-300 group-hover:bg-white/15">
                    <ShieldCheck size={14} />
                    Certificação internacional
                  </div>

                  {/* Link externo */}
                  <Link
                    href="https://greens-corp.com/#about-us"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-white/50 transition-all duration-300 hover:text-white hover:gap-2"
                  >
                    greens-corp.com
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CTA Parceria ─────────────────────────────── */}
        <div className="mt-20 animate-fade-up delay-400">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/90 via-primary to-primary/80 px-8 py-14 text-center text-white shadow-lg sm:px-16">
            {/* Padrão decorativo */}
            <div className="absolute inset-0 opacity-[0.06]" style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }} />
            <div className="absolute -left-12 -top-12 h-48 w-48 rounded-full bg-white/10" />
            <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-white/10" />

            <div className="relative">
              <h2 className="font-display text-3xl font-bold sm:text-4xl">
                Quer ser <span className="italic">parceiro?</span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/70">
                Junte-se ao ecossistema Be4Hope e contribua para democratizar o acesso
                à medicina endocanabinóide no Brasil.
              </p>
              <div className="mt-8">
                <Link href="/entre-em-contato">
                  <Button
                    className="btn-pill gap-2 bg-white px-8 text-primary shadow-lg hover:bg-white/90 hover:shadow-xl"
                    nativeButton={false}
                  >
                    Entre em contato
                    <ChevronRight size={16} />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
