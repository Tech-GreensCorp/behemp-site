'use client';

import * as React from 'react';
import { Leaf, MessageCircle } from 'lucide-react';

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

const PATOLOGIA_CORES: Record<
  string,
  {
    bg: string;
    border: string;
    text: string;
    dotBg: string;
    bgAtivo: string;
    borderAtivo: string;
    dotBorderAtivo: string;
  }
> = {
  'Autismo': {
    bg: 'bg-blue-50/30 hover:bg-blue-50/60',
    border: 'border-blue-200/50 hover:border-blue-300',
    text: 'text-blue-700',
    dotBg: 'bg-blue-100/30 border-blue-200/50',
    bgAtivo: 'bg-blue-50 border-blue-400 ring-blue-300/20',
    borderAtivo: 'border-blue-400',
    dotBorderAtivo: 'border-blue-500 bg-blue-600',
  },
  'Epilepsia': {
    bg: 'bg-violet-50/30 hover:bg-violet-50/60',
    border: 'border-violet-200/50 hover:border-violet-300',
    text: 'text-violet-700',
    dotBg: 'bg-violet-100/30 border-violet-200/50',
    bgAtivo: 'bg-violet-50 border-violet-400 ring-violet-300/20',
    borderAtivo: 'border-violet-400',
    dotBorderAtivo: 'border-violet-500 bg-violet-600',
  },
  'Parkinson': {
    bg: 'bg-emerald-50/30 hover:bg-emerald-50/60',
    border: 'border-emerald-200/50 hover:border-emerald-300',
    text: 'text-emerald-700',
    dotBg: 'bg-emerald-100/30 border-emerald-200/50',
    bgAtivo: 'bg-emerald-50 border-emerald-400 ring-emerald-300/20',
    borderAtivo: 'border-emerald-400',
    dotBorderAtivo: 'border-emerald-500 bg-emerald-600',
  },
  'Alzheimer': {
    bg: 'bg-amber-50/30 hover:bg-amber-50/60',
    border: 'border-amber-200/50 hover:border-amber-300',
    text: 'text-amber-700',
    dotBg: 'bg-amber-100/30 border-amber-200/50',
    bgAtivo: 'bg-amber-50 border-amber-400 ring-amber-300/20',
    borderAtivo: 'border-amber-400',
    dotBorderAtivo: 'border-amber-500 bg-amber-600',
  },
  'Fibromialgia': {
    bg: 'bg-rose-50/30 hover:bg-rose-50/60',
    border: 'border-rose-200/50 hover:border-rose-300',
    text: 'text-rose-700',
    dotBg: 'bg-rose-100/30 border-rose-200/50',
    bgAtivo: 'bg-rose-50 border-rose-400 ring-rose-300/20',
    borderAtivo: 'border-rose-400',
    dotBorderAtivo: 'border-rose-500 bg-rose-600',
  },
  'Tabagismo': {
    bg: 'bg-stone-50/30 hover:bg-stone-50/60',
    border: 'border-stone-200/50 hover:border-stone-300',
    text: 'text-stone-700',
    dotBg: 'bg-stone-100/30 border-stone-200/50',
    bgAtivo: 'bg-stone-50 border-stone-400 ring-stone-300/20',
    borderAtivo: 'border-stone-400',
    dotBorderAtivo: 'border-stone-500 bg-stone-600',
  },
  'Anorexia': {
    bg: 'bg-teal-50/30 hover:bg-teal-50/60',
    border: 'border-teal-200/50 hover:border-teal-300',
    text: 'text-teal-700',
    dotBg: 'bg-teal-100/30 border-teal-200/50',
    bgAtivo: 'bg-teal-50 border-teal-400 ring-teal-300/20',
    borderAtivo: 'border-teal-400',
    dotBorderAtivo: 'border-teal-500 bg-teal-600',
  },
  'Ansiedade': {
    bg: 'bg-sky-50/30 hover:bg-sky-50/60',
    border: 'border-sky-200/50 hover:border-sky-300',
    text: 'text-sky-700',
    dotBg: 'bg-sky-100/30 border-sky-200/50',
    bgAtivo: 'bg-sky-50 border-sky-400 ring-sky-300/20',
    borderAtivo: 'border-sky-400',
    dotBorderAtivo: 'border-sky-500 bg-sky-600',
  },
  'Crohn': {
    bg: 'bg-orange-50/30 hover:bg-orange-50/60',
    border: 'border-orange-200/50 hover:border-orange-300',
    text: 'text-orange-700',
    dotBg: 'bg-orange-100/30 border-orange-200/50',
    bgAtivo: 'bg-orange-50 border-orange-400 ring-orange-300/20',
    borderAtivo: 'border-orange-400',
    dotBorderAtivo: 'border-orange-500 bg-orange-600',
  },
  'Depressão': {
    bg: 'bg-cyan-50/30 hover:bg-cyan-50/60',
    border: 'border-cyan-200/50 hover:border-cyan-300',
    text: 'text-cyan-700',
    dotBg: 'bg-cyan-100/30 border-cyan-200/50',
    bgAtivo: 'bg-cyan-50 border-cyan-400 ring-cyan-300/20',
    borderAtivo: 'border-cyan-400',
    dotBorderAtivo: 'border-cyan-500 bg-cyan-600',
  },
  'Diabetes': {
    bg: 'bg-red-50/30 hover:bg-red-50/60',
    border: 'border-red-200/50 hover:border-red-300',
    text: 'text-red-700',
    dotBg: 'bg-red-100/30 border-red-200/50',
    bgAtivo: 'bg-red-50 border-red-400 ring-red-300/20',
    borderAtivo: 'border-red-400',
    dotBorderAtivo: 'border-red-500 bg-red-600',
  },
  'Dores': {
    bg: 'bg-fuchsia-50/30 hover:bg-fuchsia-50/60',
    border: 'border-fuchsia-200/50 hover:border-fuchsia-300',
    text: 'text-fuchsia-700',
    dotBg: 'bg-fuchsia-100/30 border-fuchsia-200/50',
    bgAtivo: 'bg-fuchsia-50 border-fuchsia-400 ring-fuchsia-300/20',
    borderAtivo: 'border-fuchsia-400',
    dotBorderAtivo: 'border-fuchsia-500 bg-fuchsia-600',
  },
  'Enxaqueca': {
    bg: 'bg-slate-50/30 hover:bg-slate-50/60',
    border: 'border-slate-200/50 hover:border-slate-300',
    text: 'text-slate-700',
    dotBg: 'bg-slate-100/30 border-slate-200/50',
    bgAtivo: 'bg-slate-50 border-slate-400 ring-slate-300/20',
    borderAtivo: 'border-slate-400',
    dotBorderAtivo: 'border-slate-500 bg-slate-600',
  },
  'Insônia': {
    bg: 'bg-indigo-50/30 hover:bg-indigo-50/60',
    border: 'border-indigo-200/50 hover:border-indigo-300',
    text: 'text-indigo-700',
    dotBg: 'bg-indigo-100/30 border-indigo-200/50',
    bgAtivo: 'bg-indigo-50 border-indigo-400 ring-indigo-300/20',
    borderAtivo: 'border-indigo-400',
    dotBorderAtivo: 'border-indigo-500 bg-indigo-600',
  },
  'Intestino irritável': {
    bg: 'bg-lime-50/30 hover:bg-lime-50/60',
    border: 'border-lime-200/50 hover:border-lime-300',
    text: 'text-lime-700',
    dotBg: 'bg-lime-100/30 border-lime-200/50',
    bgAtivo: 'bg-lime-50 border-lime-400 ring-lime-300/20',
    borderAtivo: 'border-lime-400',
    dotBorderAtivo: 'border-lime-500 bg-lime-600',
  },
  'Obesidade': {
    bg: 'bg-zinc-50/30 hover:bg-zinc-50/60',
    border: 'border-zinc-200/50 hover:border-zinc-300',
    text: 'text-zinc-700',
    dotBg: 'bg-zinc-100/30 border-zinc-200/50',
    bgAtivo: 'bg-zinc-50 border-zinc-400 ring-zinc-300/20',
    borderAtivo: 'border-zinc-400',
    dotBorderAtivo: 'border-zinc-500 bg-zinc-600',
  },
  'TDAH': {
    bg: 'bg-purple-50/30 hover:bg-purple-50/60',
    border: 'border-purple-200/50 hover:border-purple-300',
    text: 'text-purple-700',
    dotBg: 'bg-purple-100/30 border-purple-200/50',
    bgAtivo: 'bg-purple-50 border-purple-400 ring-purple-300/20',
    borderAtivo: 'border-purple-400',
    dotBorderAtivo: 'border-purple-500 bg-purple-600',
  },
  'Outro(a)': {
    bg: 'bg-gray-50/30 hover:bg-gray-100/60',
    border: 'border-gray-200/70 hover:border-gray-300',
    text: 'text-gray-700',
    dotBg: 'bg-gray-100/40 border-gray-200',
    bgAtivo: 'bg-gray-100 border-gray-400 ring-gray-300/20',
    borderAtivo: 'border-gray-400',
    dotBorderAtivo: 'border-gray-500 bg-gray-600',
  },
};

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

  return (
    <section id="condicoes" className="py-16 lg:py-24 scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Cabeçalho — pergunta à esquerda, badge + subtítulo à direita */}
        <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-16">
          <h2 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Para qual condição você busca um tratamento?
          </h2>
          <div className="lg:text-right">
            <span className="bg-secondary/10 text-secondary inline-block rounded-full px-3 py-1 text-xs font-semibold">
              Patologias
            </span>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed lg:ml-auto lg:max-w-sm">
              Selecione as suas patologias abaixo e inicie seu tratamento com Medicina Endocanabinoide
              ainda hoje!
            </p>
          </div>
        </div>

        {/* Grid de chips */}
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {PATOLOGIAS.map((patologia) => {
            const ativo = selected.has(patologia);
            const cores = PATOLOGIA_CORES[patologia] || PATOLOGIA_CORES['Outro(a)'];
            return (
              <button
                key={patologia}
                type="button"
                onClick={() => handleChip(patologia)}
                className={cn(
                  'group flex items-center gap-3 rounded-full border px-4 py-3 text-left text-sm font-semibold shadow-sm transition-all duration-300 ease-in-out hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
                  cores.text,
                  ativo
                    ? cn(cores.bgAtivo, 'ring-1')
                    : cn(cores.bg, cores.border),
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ease-in-out',
                    ativo ? cores.dotBorderAtivo : cores.dotBg,
                  )}
                  aria-hidden="true"
                >
                  {ativo && <span className="h-2 w-2 rounded-full bg-white scale-100 transition-transform duration-300" />}
                </span>
                <span className="leading-tight font-medium">{patologia}</span>
              </button>
            );
          })}
        </div>
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
