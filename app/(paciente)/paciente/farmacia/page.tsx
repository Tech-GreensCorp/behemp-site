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
  Sparkles,
  Gift,
  Package,
  Heart,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProdutoCard } from './_components/produto-card';
import { listarCategorias, listarProdutosEmDestaque, type CategoriaProdutoSlug } from './_lib/produtos';

export const metadata: Metadata = {
  title: 'Nossa Farmácia | Be4Hope',
  description: 'Produtos de medicina endocanabinoide com procedência, prescrição validada e entrega discreta.',
};

const ICONES_CATEGORIA: Record<CategoriaProdutoSlug, typeof Droplet> = {
  'oleos-sublinguais': Droplet,
  'capsulas-softgels': Pill,
  'cosmeticos-dermocosmeticos': Sparkles,
  'kits-combos': Gift,
  'outros-produtos': Package,
};

const BENEFICIOS = [
  {
    icone: ShieldCheck,
    titulo: 'Produtos 100% originais',
    descricao: 'Itens certificados e com procedência rastreável, direto dos laboratórios parceiros.',
  },
  {
    icone: FileCheck,
    titulo: 'Prescrição validada',
    descricao: 'Cada compra é conferida com a prescrição vigente do seu médico responsável.',
  },
  {
    icone: Truck,
    titulo: 'Entrega discreta',
    descricao: 'Embalagem neutra e sigilo total, do preparo até a chegada na sua casa.',
  },
  {
    icone: Headset,
    titulo: 'Suporte humanizado',
    descricao: 'Nossa equipe está pronta para tirar dúvidas antes, durante e depois da compra.',
    href: '/paciente/chat',
  },
];

export default function FarmaciaPage() {
  const categorias = listarCategorias();
  const destaques = listarProdutosEmDestaque(4);

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-2xl border border-border/20 bg-white shadow-sm sm:rounded-3xl animate-fade-up">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-0">
          <div className="flex flex-col justify-center gap-5 p-6 sm:p-10 lg:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              Nossa Farmácia
            </p>
            <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Tratamento de <span className="text-accent-italic">confiança</span>, do jeito que
              você precisa.
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              Óleos, cápsulas, cosméticos e kits de medicina endocanabinoide — com prescrição
              validada, procedência garantida e entrega discreta em todo o Brasil.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
              {[
                { icone: ShieldCheck, label: 'Produtos originais' },
                { icone: FileCheck, label: 'Prescrição segura' },
                { icone: Truck, label: 'Entrega discreta' },
                { icone: Heart, label: 'Cuidado humanizado' },
              ].map(({ icone: Icone, label }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-xs font-medium leading-tight text-foreground">{label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                render={<Link href="/paciente/farmacia/marketplace" />}
                nativeButton={false}
                size="lg"
                className="h-11 rounded-full px-6 text-sm font-bold"
              >
                Ver produtos
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                render={<Link href="#como-funciona" />}
                nativeButton={false}
                variant="outline"
                size="lg"
                className="h-11 rounded-full px-6 text-sm font-bold"
              >
                Como funciona
              </Button>
            </div>
          </div>

          <div className="relative min-h-[280px] overflow-hidden bg-primary-soft lg:min-h-[420px]">
            <div className="gradient-warm absolute -right-10 top-10 h-56 w-56 rounded-full opacity-40 blur-2xl" />
            <div className="gradient-salmon absolute -bottom-10 -left-10 h-56 w-56 rounded-full opacity-30 blur-2xl" />
            <Image
              src="/images/home/hero-be-pessoa-2.png"
              alt="Paciente Be4Hope"
              fill
              className="object-contain object-bottom p-4 sm:p-6"
              priority
            />

            <div className="absolute right-4 top-4 rounded-full bg-foreground px-4 py-2 text-center shadow-md sm:right-8 sm:top-8">
              <p className="text-sm font-bold leading-none text-background">+8.000</p>
              <p className="text-[10px] leading-none text-background/70">pacientes atendidos</p>
            </div>

            <Card className="absolute bottom-4 left-4 right-4 flex-row items-center gap-3 rounded-2xl border border-border/20 bg-white/95 p-3 shadow-md backdrop-blur sm:left-8 sm:right-auto sm:max-w-xs">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Heart className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Uma iniciativa da Be4Hope</p>
                <p className="text-[11px] text-muted-foreground">Acolhimento e acesso à saúde de qualidade.</p>
              </div>
            </Card>
          </div>
        </div>

        {/* ── Faixa de categorias ── */}
        <div className="grid grid-cols-2 gap-px border-t border-border/20 bg-border/20 sm:grid-cols-5">
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
                    Fale conosco <ArrowRight className="h-3 w-3" />
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

      {/* ── Produtos em destaque ── */}
      <section className="space-y-5 animate-fade-up delay-150">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
              Produtos em <span className="text-accent-italic">destaque</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Os mais procurados por pacientes Be4Hope.</p>
          </div>
          <Link
            href="/paciente/farmacia/marketplace"
            className="hidden shrink-0 items-center gap-1 text-sm font-bold text-primary hover:underline sm:inline-flex"
          >
            Ver todos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {destaques.map((produto) => (
            <ProdutoCard key={produto.id} produto={produto} />
          ))}
        </div>

        <Link
          href="/paciente/farmacia/marketplace"
          className="flex items-center justify-center gap-1 text-sm font-bold text-primary hover:underline sm:hidden"
        >
          Ver todos os produtos
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </div>
  );
}
