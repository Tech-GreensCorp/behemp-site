'use client';

/**
 * A evidência de uma hipótese — o que sustenta, o que contradiz, o que ficou sem explicação, e
 * as opções de medicamento. **Um** componente, usado em duas telas.
 *
 * 🔴 POR QUE É COMPARTILHADO, E NÃO COPIADO
 * O dono pediu em 24/08/2026 que a tela **"Sua decisão"** mostrasse *"o mesmo dado que há em
 * Hipóteses sugeridas pela IA"*. A palavra é **mesmo**. Copiar o bloco atenderia o pedido hoje e
 * o quebraria no primeiro ajuste: as duas cópias divergem, e o médico revisaria na hora da
 * decisão uma versão diferente da que leu no painel. Num passo de HITL, isso é pior que não ter
 * o botão — porque a revisão passaria a dar falsa segurança.
 *
 * A ordem dos blocos é a ordem do raciocínio: sustenta → contradiz → sem explicação → opções.
 * Conduta vem depois do argumento. Invertida, a tela apresentaria a escolha antes da razão.
 */

import { CircleHelp, ThumbsDown, ThumbsUp } from 'lucide-react';

import { ChipAchado } from '@/components/ia-clinica/ChipAchado';
import { MedicacoesSugeridas } from '@/components/ia-clinica/MedicacoesSugeridas';
import type { GrafoEvidencias, Hipotese } from '@/lib/ia-clinica/contrato';
import { evidenciaDa } from '@/lib/ia-clinica/evidencia';
import { cn } from '@/lib/utils';

interface Props {
  grafo: GrafoEvidencias;
  hipotese: Hipotese;
  /** Compacto para o sidebar da teleconsulta. */
  denso?: boolean;
  className?: string;
}

export function EvidenciaDaHipotese({ grafo, hipotese, denso = false, className }: Props) {
  const { aFavor, contra, lacunas } = evidenciaDa(grafo, hipotese.id);

  return (
    <div className={cn('space-y-4', className)}>
      {hipotese.resumo && (
        <p className={cn('text-muted-foreground', denso ? 'text-[13px]' : 'text-sm')}>
          {hipotese.resumo}
        </p>
      )}

      {aFavor.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            <ThumbsUp className="size-3.5" />O que sustenta
          </p>
          <ul className="space-y-1.5">
            {aFavor.map((a) => (
              <ChipAchado key={a.id} achado={a} denso={denso} />
            ))}
          </ul>
        </div>
      )}

      {/* O que contradiz aparece com o mesmo peso do que sustenta. Esconder a contradição é o
          que transforma apoio à decisão em confirmação de viés. */}
      {contra.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-destructive flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            <ThumbsDown className="size-3.5" />O que contradiz
          </p>
          <ul className="space-y-1.5">
            {contra.map((a) => (
              <ChipAchado key={a.id} achado={a} denso={denso} />
            ))}
          </ul>
        </div>
      )}

      {lacunas.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            <CircleHelp className="size-3.5" />
            Sem explicação por esta hipótese
          </p>
          <ul className="space-y-1.5">
            {lacunas.map((a) => (
              <ChipAchado key={a.id} achado={a} denso={denso} />
            ))}
          </ul>
        </div>
      )}

      <div className="border-t pt-3.5">
        <MedicacoesSugeridas medicamentos={hipotese.medicamentos} denso={denso} />
      </div>
    </div>
  );
}
