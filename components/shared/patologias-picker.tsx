'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Heart,
  HeartHandshake,
  Leaf,
  MapPin,
  MessageCircle,
  Monitor,
  Shield,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

const PATOLOGIAS = [
  'Autismo',
  'Epilepsia',
  'Parkinson',
  'Alzheimer',
  'Fibromialgia',
  'Tabagismo',
  'Anorexia',
  'Ansiedade',
  'Crohn',
  'Depressão',
  'Diabetes',
  'Dores',
  'Enxaqueca',
  'Insônia',
  'Intestino irritável',
  'Obesidade',
  'TDAH',
  'Outro(a)',
] as const;

const FEATURE_CARDS = [
  { icon: Users, t: 'Médicos', d: 'especialistas' },
  { icon: Monitor, t: '100%', d: 'on-line' },
  { icon: CheckCircle2, t: 'Prescrição', d: 'quando indicada' },
  { icon: HeartHandshake, t: 'Atendimento', d: 'humanizado' },
  { icon: Shield, t: 'Sigilo', d: 'e segurança' },
] as const;

const HERO_STATS = [
  { icon: Users, v: '8.000+', l: 'pacientes atendidos' },
  { icon: CalendarDays, v: '24 anos', l: 'de história' },
  { icon: MapPin, v: '26', l: 'estados atendidos' },
  { icon: ShieldCheck, v: 'ONG', l: 'sem fins lucrativos' },
] as const;

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_BEHEMP ?? '5511932047360';

export function PatologiasPicker() {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [nome, setNome] = React.useState('');
  const [open, setOpen] = React.useState(false);

  const toggle = React.useCallback((patologia: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(patologia)) next.delete(patologia);
      else next.add(patologia);
      return next;
    });
  }, []);

  const handleChip = React.useCallback(
    (patologia: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        next.add(patologia);
        return next;
      });
      setOpen(true);
    },
    [],
  );

  const podeEnviar = nome.trim().length > 0 && selected.size > 0;

  const falarComMedico = React.useCallback(() => {
    if (!podeEnviar) return;
    const lista = PATOLOGIAS.filter((p) => selected.has(p)).join(', ');
    const msg = `Olá, meu nome é ${nome.trim()}. Busco tratamento para: ${lista}.`;
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
  }, [nome, podeEnviar, selected]);

  const selecionadas = PATOLOGIAS.filter((p) => selected.has(p));

  const scrollParaPills = () => {
    document
      .getElementById('condicoes-pills')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section id="condicoes" className="bg-primary-soft/60 py-16 lg:py-24 scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Hero-block: texto à esquerda + foto/stats à direita ── */}
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          {/* Coluna esquerda */}
          <div>
            <p className="eyebrow">Encontre o cuidado ideal para você</p>
            <h2 className="mt-4 font-display text-4xl leading-[1.05] font-extrabold sm:text-5xl lg:text-6xl">
              Para qual condição
              <br />
              você busca um
              <br />
              <span className="text-primary">tratamento</span>?
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-foreground/80">
              Selecione as suas patologias abaixo e inicie seu tratamento com Medicina
              Endocanabinoide ainda hoje!
            </p>

            <button
              type="button"
              onClick={scrollParaPills}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary cursor-pointer"
            >
              <ClipboardList size={16} className="text-primary" />
              Patologias
            </button>

            {/* Feature icons row */}
            <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-5">
              {FEATURE_CARDS.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.t} className="flex flex-col items-start gap-2">
                    <Icon size={26} className="text-primary" strokeWidth={1.6} />
                    <div className="leading-tight">
                      <p className="text-sm font-semibold text-foreground">{f.t}</p>
                      <p className="text-xs text-foreground/70">{f.d}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coluna direita — imagem + stats flutuantes */}
          <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
            {/* Palco: pano decorativo + foto ─────────────────── */}
            <div className="relative aspect-[3/4] w-full">
              {/* Fundo "be." gigante */}
              <span
                aria-hidden="true"
                className="font-display absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-[56%] select-none whitespace-nowrap text-[10rem] leading-[0.75] font-bold text-primary/95 sm:text-[14rem] lg:text-[30rem]"
                style={{ letterSpacing: '-0.08em' }}
              >
                be.
              </span>

              {/* Círculos abstratos atrás */}
              <div className="absolute right-4 top-20 z-[1] h-10 w-10 rounded-full bg-primary/20 sm:top-24 sm:h-14 sm:w-14" />
              <div className="absolute bottom-16 left-4 z-[1] h-8 w-8 rounded-full bg-[#F59E0B]/30 sm:left-8 sm:h-12 sm:w-12" />

              {/* Bonequinho amarelo */}
              <svg
                aria-hidden="true"
                viewBox="0 0 64 64"
                className="absolute right-0 top-[30%] z-[5] h-14 w-14 rotate-[-12deg] drop-shadow-lg sm:h-20 sm:w-20 lg:h-24 lg:w-24"
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
                className="absolute right-4 top-[55%] z-[5] h-12 w-12 rotate-[14deg] drop-shadow-lg sm:right-6 sm:h-16 sm:w-16 lg:right-4 lg:h-20 lg:w-20"
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

              {/* Foto principal (transparente por cima do pano) */}
              <div className="absolute inset-0 z-10">
                <Image
                  src="/images/home/hero-be-pessoa-2.png"
                  alt="Paciente sorrindo, apoiada pelo cuidado da Be4Hope"
                  fill
                  sizes="(max-width: 1024px) 90vw, 32vw"
                  className="object-contain object-bottom scale-110"
                  priority={false}
                />
              </div>

              {/* Corações espalhados */}
              <Heart
                aria-hidden="true"
                size={32}
                className="absolute left-2 top-4 z-20 -rotate-12 fill-primary text-primary drop-shadow-sm sm:h-10 sm:w-10"
                strokeWidth={0}
              />
              <Heart
                aria-hidden="true"
                size={18}
                className="absolute right-14 top-6 z-20 rotate-12 fill-primary text-primary sm:right-16 sm:h-6 sm:w-6"
                strokeWidth={0}
              />
              <Heart
                aria-hidden="true"
                size={14}
                className="absolute right-2 top-16 z-20 rotate-6 fill-[#F08A6E] text-[#F08A6E] sm:top-20 sm:h-5 sm:w-5"
                strokeWidth={0}
              />
            </div>

            {/* Medicamento */}
            <div className="absolute -left-24 bottom-0 z-20 hidden lg:block">
              <Image
                src="/images/home/medicamento.png"
                alt="Medicamento"
                width={240}
                height={240}
                className="drop-shadow-2xl"
              />
            </div>

            {/* Stats flutuantes à direita da imagem */}
            <div className="mt-4 space-y-2 lg:absolute lg:-right-4 lg:top-3/4 lg:z-30 lg:mt-0 lg:w-56 lg:-translate-y-1/2 lg:space-y-2">
              {HERO_STATS.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.v}
                    className="flex items-center gap-2.5 rounded-2xl bg-card px-3 py-2 shadow-card ring-1 ring-border/60 backdrop-blur-sm"
                  >
                    <Icon size={18} className="shrink-0 text-primary" strokeWidth={1.6} />
                    <div>
                      <p className="font-display text-sm font-extrabold text-foreground">{s.v}</p>
                      <p className="text-[10px] leading-tight text-foreground/70">{s.l}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rating */}
            {/* <div className="mt-3 flex items-center gap-2 lg:absolute lg:-right-4 lg:bottom-4 lg:mt-0 lg:w-56 lg:rounded-2xl lg:bg-card lg:px-3 lg:py-2 lg:shadow-card lg:ring-1 lg:ring-border/60">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={12} className="fill-[var(--sun)] text-[var(--sun)]" />
                ))}
              </div>
              <div className="leading-tight">
                <p className="text-[11px] font-semibold text-foreground">Avaliação dos pacientesAAAAAAAAAAA</p>
                <p className="text-[10px] text-foreground/70">4,9 de 5 (1.200+ avaliações)</p>
              </div>
            </div> */}
          </div>
        </div>

        {/* ── Grid de pílulas de patologias ─────────────────── */}
        <div id="condicoes-pills" className="mt-16 scroll-mt-24">
          <h3 className="font-display text-xl font-extrabold sm:text-2xl">
            Escolha as suas <span className="text-primary italic">patologias</span>
          </h3>
          <p className="mt-2 text-sm text-foreground/80">
            Toque em uma ou mais opções para iniciar seu atendimento.
          </p>
        </div>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PATOLOGIAS.map((patologia) => {
            const ativo = selected.has(patologia);
            return (
              <li key={patologia}>
                <button
                  type="button"
                  onClick={() => handleChip(patologia)}
                  className={cn(
                    'group flex w-full items-center justify-between rounded-2xl border bg-card px-5 py-4 text-left text-sm font-semibold text-foreground shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:border-primary hover:text-primary hover:shadow-md cursor-pointer',
                    ativo ? 'border-primary text-primary ring-1 ring-primary/30' : 'border-border',
                  )}
                >
                  <span>{patologia}</span>
                  <ArrowRight
                    size={16}
                    className="shrink-0 text-primary transition-transform duration-300 group-hover:translate-x-0.5"
                  />
                </button>
              </li>
            );
          })}
        </ul>

      </div>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-5 sm:max-w-2xl sm:p-7" showCloseButton={false}>
          <DialogTitle className="sr-only">Iniciar jornada com a Be4Hope</DialogTitle>

          {/* Banner topo */}
          <div className="overflow-hidden rounded-xl border border-border bg-muted/40">
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-secondary/70" />
            </div>
            <div className="px-6 py-6 text-center">
              <div className="bg-secondary/10 mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full">
                <Leaf size={20} className="text-secondary" />
              </div>
              <p className="text-foreground text-sm leading-relaxed">
                <strong className="font-semibold">Falta pouco</strong> para você iniciar sua jornada
                com a Be4Hope!
              </p>
            </div>
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="patologia-nome">
              Nome <span className="text-primary">*</span>
            </Label>
            <Input
              id="patologia-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Como você se chama?"
              className="h-10"
            />
          </div>

          {/* Pílulas dos selecionados */}
          {selecionadas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selecionadas.map((p) => (
                <span
                  key={p}
                  className="bg-secondary/10 text-secondary inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                >
                  {p}
                </span>
              ))}
            </div>
          )}

          {/* Lista de patologias */}
          <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
            {PATOLOGIAS.map((patologia) => (
              <Label
                key={patologia}
                className="flex cursor-pointer items-center gap-3 font-normal"
              >
                <Checkbox
                  checked={selected.has(patologia)}
                  onCheckedChange={() => toggle(patologia)}
                />
                {patologia}
              </Label>
            ))}
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <DialogClose
              render={
                <Button type="button" variant="outline" size="lg" className="btn-pill px-8" />
              }
            >
              Voltar a página inicial
            </DialogClose>
            <Button
              type="button"
              size="lg"
              disabled={!podeEnviar}
              onClick={falarComMedico}
              className="btn-pill text-white bg-green-600 hover:bg-green-700 transition-colors gap-2 px-8 border-0"
            >
              <MessageCircle size={16} />
              Falar com médico
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
