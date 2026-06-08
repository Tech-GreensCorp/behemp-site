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
  'Alzheimer',
  'Diabetes',
  'Obesidade',
  'Anorexia',
  'Ansiedade',
  'Autismo',
  'Crohn',
  'Depressão',
  'Dores',
  'Epilepsia',
  'Enxaqueca',
  'Fibromialgia',
  'Insônia',
  'Intestino irritável',
  'Tabagismo',
  'TDAH',
  'Parkinson',
  'Outro(a)',
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

  return (
    <section id="condicoes" className="py-10 lg:py-14 scroll-mt-24">
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
              Selecione as suas patologias abaixo e inicie seu tratamento com cannabis medicinal
              ainda hoje!
            </p>
          </div>
        </div>

        {/* Grid de chips */}
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {PATOLOGIAS.map((patologia) => {
            const ativo = selected.has(patologia);
            return (
              <button
                key={patologia}
                type="button"
                onClick={() => handleChip(patologia)}
                className={cn(
                  'group flex items-center gap-3 rounded-full border bg-card px-4 py-3 text-left text-sm font-medium shadow-sm transition-all hover:shadow-md',
                  ativo ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/40',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                    ativo ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                  )}
                  aria-hidden="true"
                >
                  {ativo && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                <span className="leading-tight">{patologia}</span>
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
            <Button
              type="button"
              size="lg"
              disabled={!podeEnviar}
              onClick={falarComMedico}
              className="btn-pill text-white border border-primary gap-2 px-8"
              style={{ backgroundColor: '#54ab34' }}
            >
              <MessageCircle size={16} />
              Falar com médico
            </Button>
            <DialogClose
              render={
                <Button type="button" variant="outline" size="lg" className="btn-pill border-primary text-secondary px-8" />
              }
            >
              Voltar a página inicial
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
