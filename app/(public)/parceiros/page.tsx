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
  Globe,
  Smartphone,
  Brain,
  HeartPulse,
  Stethoscope,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Parceiros | Be4Hope',
  description:
    'Conheça os parceiros estratégicos da Be4Hope: Greens Pharmaceutical e Cannect. Juntos na missão de democratizar a Medicina Endocanabinóide no Brasil.',
};

const DIFERENCIAIS = [
  {
    icon: FlaskConical,
    titulo: 'Certificação Swiss GMP',
    descricao: 'Protocolos internacionais de fabricação com certificação Swiss GMP, padrão de excelência global na indústria farmacêutica.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Integração Regulatória',
    descricao: 'Rigorosa conformidade e integração regulatória permanente, garantindo operação dentro dos mais altos padrões legais.',
  },
  {
    icon: Sprout,
    titulo: 'Cadeia produtiva rastreada',
    descricao: 'Da cadeia produtiva ao acompanhamento pós-disponibilização, cada etapa é conduzida sob critérios rigorosos de conformidade.',
  },
  {
    icon: HeartHandshake,
    titulo: 'Governância científica',
    descricao: 'Maturidade científica e governância de longo prazo, baseada em evidência científica e planejamento multinacional.',
  },
];

const DIFERENCIAIS_CANNECT = [
  {
    icon: Globe,
    titulo: 'Ecossistema digital integrado',
    descricao: 'Plataforma que conecta pacientes, médicos prescritores e fornecedores farmacêuticos, simplificando toda a jornada de acesso ao tratamento.',
  },
  {
    icon: HeartPulse,
    titulo: 'Cannect Cuida',
    descricao: 'Suporte contínuo ao paciente com orientações de especialistas, monitoramento do tratamento e acompanhamento clínico integrado.',
  },
  {
    icon: Stethoscope,
    titulo: 'Telemedicina especializada',
    descricao: 'Agendamento de consultas com médicos habilitados a prescrever Medicina Endocanabinoide, com atendimento à distância e segurança jurídica.',
  },
  {
    icon: Brain,
    titulo: 'Tecnologia e inteligência',
    descricao: 'Ferramentas baseadas em IA e dados científicos para apoiar médicos e pacientes na tomada de decisão sobre os melhores tratamentos.',
  },
];

export default function ParceirosPage() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center animate-fade-up">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Ecossistema · Rede de Apoio Be4Hope
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Nossos{' '}
            <span className="text-accent-italic">parceiros.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            A Be4Hope é uma <strong className="text-foreground">rede de apoio</strong>{' '}
            formada por empresas e instituições que promovem um modelo inovador de saúde —
            mais humano, acessível e centrado no paciente, utilizando a Medicina Endocanabinóide
            como terapia, sempre com base científica e responsabilidade.
          </p>
        </div>

        {/* ── Card Greens Premium ───────────────────────── */}
        <div className="mt-16 animate-fade-up delay-200">
          <div className="group relative overflow-hidden rounded-2xl bg-white shadow-xl transition-all duration-500 hover:shadow-2xl">
            {/* Barra superior com gradiente animada */}
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-green-500 via-emerald-400 to-green-600 transition-all duration-500 group-hover:h-2" />

            <div className="grid md:grid-cols-3">
              {/* Coluna esquerda — Informações */}
              <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-12 md:col-span-2">
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
                  <span className="ml-2 text-green-600">Pharmaceutical</span>
                </h2>
                <p className="mt-1 text-sm font-medium italic text-green-600">
                  Não somos intermediários. Somos estrutura.
                </p>

                {/* Descrição */}
                <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                  Indústria internacional dedicada ao{' '}
                  <strong className="text-foreground">desenvolvimento e entrega de terapias de alta complexidade</strong>{' '}
                  com excelência técnica, governança estruturada e visão de longo prazo.
                  Atuam na interseção entre ciência, regulação e sustentabilidade,
                  assegurando que a inovação terapêutica chegue ao país com
                  <strong className="text-foreground"> responsabilidade institucional</strong>,
                  consistência técnica e estabilidade operacional.
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
              <div className="relative md:col-span-1 min-h-[300px] overflow-hidden">
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
                    <div className="absolute inset-0 animate-gentle-pulse rounded-2xl bg-white/20 blur-xl" />
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm transition-all duration-500 group-hover:scale-110 group-hover:bg-white/25 group-hover:rounded-[1.5rem]">
                      <Leaf size={44} className="text-white transition-transform duration-500 group-hover:scale-110" />
                    </div>
                  </div>

                  <h3 className="mt-6 font-display text-2xl font-bold text-white">
                    Greens Pharmaceutical
                  </h3>
                  <p className="mt-2 text-sm text-white/60">
                    Ciência, inovação e alcance global em terapias
                  </p>

                  {/* Selo */}
                  <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur-sm transition-colors duration-300 group-hover:bg-white/15">
                    <ShieldCheck size={14} />
                    Swiss GMP · Regulatório Global
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

        {/* ── Card Cannect ──────────────────────────────── */}
        <div className="mt-12 animate-fade-up delay-300">
          <div className="group relative overflow-hidden rounded-2xl bg-white shadow-xl transition-all duration-500 hover:shadow-2xl">
            {/* Barra superior verde musgo */}
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#6B7B3C] via-[#7a8f45] to-[#5a6833] transition-all duration-500 group-hover:h-2" />

            <div className="grid md:grid-cols-3">
              {/* Coluna esquerda — Informações */}
              <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-12 md:col-span-2">
                {/* Badge + Ícone */}
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: 'linear-gradient(135deg, rgba(107,123,60,0.15) 0%, rgba(107,123,60,0.05) 100%)' }}>
                    <Globe size={26} style={{ color: '#6B7B3C' }} />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider" style={{ background: 'rgba(107,123,60,0.1)', color: '#6B7B3C' }}>
                      <Award size={12} />
                      Parceiro estratégico
                    </span>
                  </div>
                </div>

                {/* Título */}
                <h2 className="mt-6 font-display text-3xl font-bold tracking-tight">
                  <span style={{ color: '#6B7B3C' }}>Cannect</span>
                </h2>
                <p className="mt-1 text-sm font-medium italic" style={{ color: '#6B7B3C' }}>
                  Democratizando o acesso à Medicina Endocanabinoide.
                </p>

                {/* Descrição */}
                <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                  Ecossistema digital brasileiro que{' '}
                  <strong className="text-foreground">conecta pacientes, médicos prescritores e fornecedores farmacêuticos</strong>,
                  simplificando a jornada do paciente desde a consulta até o acesso ao produto final.
                  Como uma <strong className="text-foreground">healthtech</strong> especializada em Medicina Endocanabinoide,
                  a Cannect organiza a demanda e garante que os pacientes recebam orientação profissional
                  e acesso a produtos seguros dentro do marco regulatório brasileiro.
                </p>

                {/* Grid de diferenciais */}
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {DIFERENCIAIS_CANNECT.map((item, i) => (
                    <div
                      key={item.titulo}
                      className="group/item flex items-start gap-3 rounded-xl border border-transparent p-3 transition-all duration-300 hover:border-[rgba(107,123,60,0.2)] hover:bg-[rgba(107,123,60,0.05)]"
                      style={{ animationDelay: `${(i + 2) * 100}ms` }}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-300" style={{ background: 'rgba(107,123,60,0.1)' }}>
                        <item.icon size={16} style={{ color: '#6B7B3C' }} />
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
                    href="https://www.cannect.life"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      className="btn-pill gap-2 px-8 text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:gap-3"
                      style={{ background: '#6B7B3C', boxShadow: '0 4px 14px rgba(107,123,60,0.25)' }}
                      nativeButton={false}
                    >
                      Saiba mais sobre a Cannect
                      <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Coluna direita — Visual card */}
              <div className="relative md:col-span-1 min-h-[300px] overflow-hidden">
                {/* Gradiente de fundo verde musgo */}
                <div className="absolute inset-0 transition-all duration-700" style={{ background: 'linear-gradient(135deg, #6B7B3C 0%, #5a6833 50%, #3d4d22 100%)' }} />

                {/* Padrão decorativo */}
                <div className="absolute inset-0 opacity-[0.07]" style={{
                  backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                  backgroundSize: '20px 20px',
                }} />

                {/* Círculos decorativos */}
                <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 transition-transform duration-700 group-hover:scale-125" />
                <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/10 transition-transform duration-700 group-hover:scale-150 group-hover:translate-x-4" />
                <div className="absolute right-16 bottom-20 h-20 w-20 rounded-full bg-white/5 transition-transform duration-500 group-hover:scale-110" />

                {/* Conteúdo central */}
                <div className="relative flex h-full flex-col items-center justify-center p-8 text-center">
                  <div className="relative">
                    <div className="absolute inset-0 animate-gentle-pulse rounded-2xl bg-white/20 blur-xl" />
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm transition-all duration-500 group-hover:scale-110 group-hover:bg-white/25 group-hover:rounded-[1.5rem]">
                      <Globe size={44} className="text-white transition-transform duration-500 group-hover:scale-110" />
                    </div>
                  </div>

                  <h3 className="mt-6 font-display text-2xl font-bold text-white">
                    Cannect
                  </h3>
                  <p className="mt-2 text-sm text-white/60">
                    Ecossistema digital de saúde
                  </p>

                  {/* Selo */}
                  <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur-sm transition-colors duration-300 group-hover:bg-white/15">
                    <Smartphone size={14} />
                    Healthtech · Medicina Endocanabinoide
                  </div>

                  {/* Link externo */}
                  <Link
                    href="https://www.cannect.life"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-white/50 transition-all duration-300 hover:text-white hover:gap-2"
                  >
                    cannect.life
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CTA Parceria ─────────────────────────────── */}
        <div className="mt-20 animate-fade-up delay-400">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 via-primary to-primary/80 px-8 py-14 text-center text-white shadow-lg sm:px-16">
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
                <Link href="/contato">
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
