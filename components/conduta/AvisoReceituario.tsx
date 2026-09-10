'use client';

/**
 * O aviso do `CAN-04` — e a razão de ele ser AVISO e não trava.
 *
 * O tipo de receituário depende do teor de THC do produto: até 0,2% Receita de Controle
 * Especial; acima disso, Notificação de Receita "A" (RDC 1.015/2026, Art. 37, §§ 1º e 2º).
 *
 * 🔴 QUEM APLICA A NORMA É O MÉDICO. Decisão do dono em 24/08/2026:
 *
 *   `DO-46`: "isso é algo que o 'MÉDICO' preenche não o SISTEMA."
 *   `DO-47`: "o médico quem deve seguir o procedimento correto, o sistema avisa."
 *
 * Um software que derivasse o tipo sozinho a partir de campo que ninguém preencheu estaria
 * AFIRMANDO um fato regulatório que não tem; um que travasse a escolha estaria DIRIGINDO a
 * conduta — a fronteira `IMD-01` x `IMD-02` do IMDRF, e a proibição nº 2 do `CLAUDE.md`.
 *
 * 🔴 SEM TEOR, ELE DIZ QUE NÃO SABE. Nunca assume a faixa permissiva. Silêncio que parece
 * aprovação é a pior das três saídas.
 */

import { AlertTriangle, HelpCircle, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { avisoDeReceituario, type TipoReceituario } from '@/lib/conduta/receituario';
import { cn } from '@/lib/utils';

/** Cor por tipo, dos tokens `--chart-*` — nenhum hex novo (proibição nº 3). */
const APARENCIA: Record<
  TipoReceituario,
  { icone: typeof ShieldCheck; classe: string; borda: string }
> = {
  controle_especial: {
    icone: ShieldCheck,
    classe: 'text-[var(--chart-2)]',
    borda: 'border-[var(--chart-2)]/30 bg-[var(--chart-2)]/5',
  },
  notificacao_a: {
    icone: AlertTriangle,
    classe: 'text-[var(--chart-5)]',
    borda: 'border-[var(--chart-5)]/40 bg-[var(--chart-5)]/5',
  },
  indeterminado: {
    icone: HelpCircle,
    classe: 'text-muted-foreground',
    borda: 'border-border/60 bg-muted/30',
  },
};

interface Props {
  /** O que o médico informou, ou o do catálogo. `null` é estado legítimo. */
  teorThcPercentual: number | string | null | undefined;
  /** `compacto` cabe ao lado de um campo; `pleno` é o bloco explicativo. */
  variante?: 'compacto' | 'pleno';
  className?: string;
}

export function AvisoReceituario({ teorThcPercentual, variante = 'pleno', className }: Props) {
  const aviso = avisoDeReceituario(teorThcPercentual);
  const { icone: Icone, classe, borda } = APARENCIA[aviso.tipo];

  if (variante === 'compacto') {
    return (
      <Badge variant="outline" className={cn('gap-1.5 font-normal', borda, className)}>
        <Icone size={12} className={classe} />
        <span className={classe}>{aviso.rotulo}</span>
      </Badge>
    );
  }

  return (
    <div className={cn('rounded-xl border p-4', borda, className)}>
      <div className="flex items-start gap-3">
        <Icone size={18} className={cn('mt-0.5 shrink-0', classe)} />
        <div className="space-y-1">
          <p className={cn('font-heading text-sm font-semibold', classe)}>{aviso.rotulo}</p>
          <p className="text-muted-foreground text-xs leading-relaxed">{aviso.explicacao}</p>
          {aviso.fundamento && (
            <p className="text-muted-foreground/70 pt-1 font-mono text-[0.65rem]">
              {aviso.fundamento}
            </p>
          )}
          {/* A frase que mantém a decisão onde ela pertence. */}
          <p className="text-muted-foreground/80 pt-1 text-[0.7rem] italic">
            Este é um aviso. A escolha do receituário é sua.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * O aviso de TROCA de faixa, mostrado no ajuste de dose quando o produto novo muda o tipo de
 * receituário. `DO-47`: a prescrição nova continua **opcional**.
 */
export function AvisoTrocaDeFaixa({ mensagem }: { mensagem: string }) {
  if (!mensagem) return null;
  return (
    <div className="animate-fade-in flex items-start gap-3 rounded-xl border border-[var(--chart-5)]/40 bg-[var(--chart-5)]/5 p-4">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--chart-5)]" />
      <p className="text-foreground/90 text-xs leading-relaxed">{mensagem}</p>
    </div>
  );
}
