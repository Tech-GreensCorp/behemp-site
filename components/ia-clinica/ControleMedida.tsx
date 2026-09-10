'use client';

/**
 * Controle de entrada numérica por grandeza — ADR-0004 D-05.
 *
 * POR QUE ESTE COMPONENTE EXISTE, EM VEZ DE `<input type="number">`
 * A ADR rejeita o input genérico com um motivo concreto: *"aceita 700 gotas/dia sem piscar"*.
 * Cada grandeza clínica tem faixa plausível, faixa normal e valor que pede atenção — e um campo
 * que aceita qualquer número transforma erro de digitação em decisão de dose.
 *
 * O QUE SE COPIA DO VIDAI (o `−`/`+`, a faixa, o sinal de perigo) está em `09` §1 D-05: é a
 * lógica de construção, não o arquivo.
 *
 * 🔴 MOSTRA O VALOR ANTERIOR AO LADO. É o coração da D-01: no retorno, o médico precisa ver de
 * onde a medida saiu, não só onde ela está. Sem isso a série existe no banco e não na tela.
 */

import { AlertTriangle, Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface FaixaMedida {
  min: number;
  max: number;
  passo?: number;
  /** Faixa considerada normal — desenhada como referência, não como validação. */
  normal?: { de: number; ate: number };
  /** A partir daqui, sinaliza. Não bloqueia: valor extremo pode ser real. */
  alerta?: (valor: number) => boolean;
  unidade?: string;
}

interface Props {
  rotulo: string;
  /** O que o número significa. Obrigatório quando a direção da escala não é óbvia. */
  ajuda?: string;
  valor: number | null;
  onChange: (valor: number | null) => void;
  faixa: FaixaMedida;
  /** Valor da medição anterior — o "de onde saiu". */
  anterior?: number | null;
  /** `true` quando um número MAIOR é melhor (qualidade de vida). Inverte a leitura da variação. */
  maiorEhMelhor?: boolean;
  className?: string;
}

/** Variação entre o valor atual e o anterior, já interpretada como melhora ou piora. */
function interpretarVariacao(
  atual: number,
  anterior: number,
  maiorEhMelhor: boolean,
): { texto: string; tom: 'melhor' | 'pior' | 'igual' } {
  const delta = atual - anterior;
  if (delta === 0) return { texto: 'sem mudança', tom: 'igual' };
  const sinal = delta > 0 ? '+' : '';
  const melhorou = maiorEhMelhor ? delta > 0 : delta < 0;
  return { texto: `${sinal}${delta}`, tom: melhorou ? 'melhor' : 'pior' };
}

export function ControleMedida({
  rotulo,
  ajuda,
  valor,
  onChange,
  faixa,
  anterior,
  maiorEhMelhor = false,
  className,
}: Props) {
  const passo = faixa.passo ?? 1;
  const idCampo = `medida-${rotulo.replace(/\s+/g, '-').toLowerCase()}`;

  // Clamp na faixa plausível: é o que impede 700 gotas ou PA 900.
  const ajustar = (delta: number) => {
    const base = valor ?? faixa.normal?.de ?? faixa.min;
    onChange(Math.min(faixa.max, Math.max(faixa.min, base + delta)));
  };

  const forcarFaixa = (bruto: string) => {
    if (bruto === '') return onChange(null);
    const n = Number(bruto);
    if (Number.isNaN(n)) return;
    onChange(Math.min(faixa.max, Math.max(faixa.min, n)));
  };

  const emAlerta = valor !== null && faixa.alerta?.(valor) === true;
  const variacao =
    valor !== null && anterior !== null && anterior !== undefined
      ? interpretarVariacao(valor, anterior, maiorEhMelhor)
      : null;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={idCampo} className="text-sm font-medium">
          {rotulo}
          {faixa.unidade && (
            <span className="text-muted-foreground ml-1 font-normal">({faixa.unidade})</span>
          )}
        </Label>
        {/* O valor anterior, sempre visível quando existe — D-01. */}
        {anterior !== null && anterior !== undefined && (
          <span className="text-muted-foreground text-xs">
            antes: <strong className="font-mono">{anterior}</strong>
            {variacao && (
              <span
                className={cn(
                  'ml-1.5 font-mono font-semibold',
                  variacao.tom === 'melhor' && 'text-secondary',
                  variacao.tom === 'pior' && 'text-destructive',
                )}
              >
                {variacao.texto}
              </span>
            )}
          </span>
        )}
      </div>

      {ajuda && <p className="text-muted-foreground text-xs">{ajuda}</p>}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 shrink-0"
          onClick={() => ajustar(-passo)}
          disabled={valor !== null && valor <= faixa.min}
          aria-label={`Diminuir ${rotulo}`}
        >
          <Minus className="size-4" />
        </Button>

        <Input
          id={idCampo}
          type="number"
          inputMode="numeric"
          value={valor ?? ''}
          onChange={(e) => forcarFaixa(e.target.value)}
          min={faixa.min}
          max={faixa.max}
          step={passo}
          placeholder="—"
          aria-describedby={`${idCampo}-faixa`}
          className={cn(
            'h-9 text-center font-mono tabular-nums',
            emAlerta && 'border-destructive text-destructive',
          )}
        />

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 shrink-0"
          onClick={() => ajustar(passo)}
          disabled={valor !== null && valor >= faixa.max}
          aria-label={`Aumentar ${rotulo}`}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <div id={`${idCampo}-faixa`} className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {faixa.min}–{faixa.max}
          {faixa.normal && (
            <>
              {' · '}
              normal {faixa.normal.de}–{faixa.normal.ate}
            </>
          )}
        </span>
        {/* Sinaliza, não bloqueia: valor extremo pode ser verdadeiro, e travar o campo
            impediria registrar o caso que mais importa. */}
        {emAlerta && (
          <span className="text-destructive flex items-center gap-1 font-medium">
            <AlertTriangle className="size-3" />
            fora do esperado
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AS FAIXAS DAS CINCO MEDIDAS DE DO-24 E DOS DOIS VITAIS DE DO-25
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Declaradas UMA vez, aqui. Se cada tela declarasse a sua, a faixa de dor divergiria entre a
 * primeira avaliação e o retorno — e a série deixaria de ser comparável.
 *
 * ⚠️ As faixas de PA marcam o que **pede atenção**, não diagnóstico. Rótulo de hipertensão é ato
 * clínico, e o sistema não o emite: sinaliza para o médico olhar.
 */
export const FAIXAS = {
  dor: {
    min: 0,
    max: 10,
    normal: { de: 0, ate: 3 },
    alerta: (v: number) => v >= 8,
  },
  sono: { min: 0, max: 10, normal: { de: 7, ate: 10 }, alerta: (v: number) => v <= 3 },
  ansiedade: { min: 0, max: 10, normal: { de: 0, ate: 3 }, alerta: (v: number) => v >= 8 },
  qualidadeVida: { min: 0, max: 10, normal: { de: 7, ate: 10 }, alerta: (v: number) => v <= 3 },
  crises: { min: 0, max: 1000, unidade: 'nº' },
  pressaoSistolica: {
    min: 50,
    max: 300,
    normal: { de: 90, ate: 130 },
    alerta: (v: number) => v < 90 || v >= 140,
    unidade: 'mmHg',
  },
  pressaoDiastolica: {
    min: 30,
    max: 200,
    normal: { de: 60, ate: 85 },
    alerta: (v: number) => v < 60 || v >= 90,
    unidade: 'mmHg',
  },
  peso: { min: 1, max: 400, passo: 1, unidade: 'kg' },
} as const satisfies Record<string, FaixaMedida>;
