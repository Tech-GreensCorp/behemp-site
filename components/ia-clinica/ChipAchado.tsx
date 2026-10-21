'use client';

/**
 * Um achado na tela, com a **origem** dita ao lado — o chip que o painel de hipóteses e a tela
 * de decisão usam, ambos.
 *
 * 🔴 A REGRA QUE ELE CARREGA
 * `inferido_ia` aparece **diferente** de `historico_validado`. Sem isso, sugestão de modelo e
 * fato registrado ficam idênticos na tela — e é exatamente essa indistinção que faz um sistema
 * de apoio virar um sistema que dirige (proibição nº 2 do `CLAUDE.md`, `ANV-01`…`ANV-04`).
 *
 * Compartilhado de propósito: duplicar o chip é duplicar a regra, e regra duplicada é regra que
 * um dia vale em uma tela e não vale na outra.
 */

import { Bot, CircleAlert, FileText, FlaskConical, Siren, Stethoscope } from 'lucide-react';

import { achadoEhInferidoPelaIa, type Achado } from '@/lib/ia-clinica/contrato';
import { cn } from '@/lib/utils';

/** Como cada proveniência aparece. Rótulo curto, porque vai num chip ao lado do achado. */
export const PROVENIENCIA: Record<
  Achado['proveniencia'],
  { rotulo: string; icone: typeof Bot; classe: string }
> = {
  inferido_ia: { rotulo: 'inferido pela IA', icone: Bot, classe: 'text-primary' },
  historico_validado: { rotulo: 'registro anterior', icone: FileText, classe: 'text-secondary' },
  episodio_atual: { rotulo: 'relato de hoje', icone: Stethoscope, classe: 'text-foreground' },
  exame_lab: { rotulo: 'exame', icone: FlaskConical, classe: 'text-foreground' },
  red_flag: { rotulo: 'sinal de alarme', icone: Siren, classe: 'text-destructive' },
};

/**
 * 🔴 O QUE FAZER COM UMA ORIGEM QUE O CONTRATO NÃO CONHECE.
 *
 * Em 24/08/2026 um fixture novo trouxe `relato_paciente`, `medida_registrada` e `lab_importado` —
 * três valores inventados, que não existem em `ProvenienciaAchado`. `PROVENIENCIA[valor]` deu
 * `undefined` e a tela caiu inteira com *"can't access property 'icone'"*. O `as never` no import
 * do JSON tinha desligado a checagem do TypeScript.
 *
 * Duas saídas erradas e uma certa:
 *
 * - ❌ **Não tratar.** Um dado ruim do motor derruba a tela clínica inteira. Inaceitável.
 * - ❌ **Cair para um padrão silencioso** (ex.: tratar como `episodio_atual`). Pior que quebrar:
 *   a tela afirmaria uma origem que ninguém declarou, e a origem do achado é **regra** aqui
 *   (proibição nº 2 do `CLAUDE.md`) — é ela que separa sugestão de fato.
 * - ✅ **Denunciar.** Renderiza, e diz que a origem é desconhecida, com o valor cru visível. A
 *   tela sobrevive, o médico não é enganado, e o defeito fica óbvio para quem o vê.
 */
function origemDe(proveniencia: string): (typeof PROVENIENCIA)[keyof typeof PROVENIENCIA] {
  return (
    PROVENIENCIA[proveniencia as Achado['proveniencia']] ?? {
      rotulo: `origem desconhecida: ${proveniencia}`,
      icone: CircleAlert,
      classe: 'text-destructive',
    }
  );
}

export function ChipAchado({ achado, denso = false }: { achado: Achado; denso?: boolean }) {
  const p = origemDe(achado.proveniencia);
  const Icone = p.icone;
  return (
    <li className={cn('flex items-start gap-2', denso ? 'text-[13px]' : 'text-sm')}>
      <Icone className={cn('mt-0.5 size-3.5 shrink-0', p.classe)} aria-hidden />
      <span>
        <span className="text-foreground">{achado.titulo}</span>
        {/* A origem, sempre. É o que separa sugestão de fato. */}
        <span
          className={cn(
            'ml-1.5 text-xs',
            achadoEhInferidoPelaIa(achado) ? 'text-primary font-medium' : 'text-muted-foreground',
          )}
        >
          {p.rotulo}
        </span>
      </span>
    </li>
  );
}
