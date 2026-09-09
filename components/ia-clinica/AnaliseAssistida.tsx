'use client';

/**
 * A área de análise assistida — o painel de hipóteses **mais** a Trava 2, ligados.
 *
 * POR QUE OS DOIS JUNTOS, NUM COMPONENTE
 * Porque a sequência é a regra: a saída aparece, e o passo humano vem **imediatamente depois**,
 * na mesma vista. Separar em telas diferentes deixaria a sugestão visível sem a decisão ao lado
 * — e é a proximidade das duas coisas que faz o médico entender que uma depende da outra.
 *
 * A hipótese que ele abre no painel é a que aparece pré-selecionada na decisão: o gesto de
 * examinar já encaminha o gesto de decidir, sem decidir por ele.
 *
 * 🔴 SEM MOTOR, NÃO INVENTA ANÁLISE
 * Quando não há grafo, aparece o estado vazio explicando o que virá — **sem botão inerte**.
 * Botão que não faz nada ensina o médico a não confiar na tela.
 */

import { useState } from 'react';
import { Sparkles } from 'lucide-react';

import { PainelHipoteses } from '@/components/ia-clinica/PainelHipoteses';
import { RevisaoHumana } from '@/components/ia-clinica/RevisaoHumana';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { GrafoEvidencias } from '@/lib/ia-clinica/contrato';

interface Props {
  pacienteId: string;
  anamneseId?: string;
  teleconsultaId?: string;
  /** `null` quando o motor não produziu análise — o caso de hoje, em produção. */
  grafo: GrafoEvidencias | null;
  /** `true` quando o grafo vem de fixture, não do motor. A tela precisa dizer isso. */
  ehDemonstracao?: boolean;
  /**
   * Compacto para o **sidebar da teleconsulta**. Pedido do dono em 24/08/2026: *"só temos que
   * tomar cuidado em como faremos isso na teleconsulta por conta do sidebar dela na lateral"*.
   *
   * O que `denso` muda, e por que só isso: cartões de medicamento nascem **fechados**,
   * tipografia cai um passo, e o rótulo textual do botão de revisar sai (fica só o chevron, com
   * `aria-label`). O que ele **não** muda é o que a tela diz — nenhum bloco de evidência, nenhum
   * rótulo de procedência e nenhuma ressalva desaparecem por falta de espaço. Esconder a
   * contradição para caber na coluna seria trocar a regra por layout.
   */
  denso?: boolean;
}

export function AnaliseAssistida({
  pacienteId,
  anamneseId,
  teleconsultaId,
  grafo,
  ehDemonstracao = false,
  denso = false,
}: Props) {
  /**
   * A **primeira** hipótese nasce aberta; as outras, fechadas — ADR-0006 D-01.
   *
   * 🔴 CORRIGIDO EM 24/08/2026. Estava nascendo com nenhuma aberta, o que **divergia da ADR** sem
   * que nada apontasse. O fundamento da D-01 é o NN/g: *"the very fact that something appears on
   * the initial display tells users that it's important"* — e a hipótese de slot 1 é a principal
   * por construção do motor. Com tudo fechado, a tela obriga um clique para dizer qualquer coisa,
   * e o médico vê três títulos equivalentes onde existe uma hierarquia.
   *
   * A D-01 também rejeitou **abrir as três**: isso desfaria a hierarquia pelo outro lado.
   */
  const hipoteseDeMenorSlot =
    grafo && grafo.hipoteses.length > 0
      ? [...grafo.hipoteses].sort((a, b) => a.slot - b.slot)[0].id
      : null;
  const [hipoteseAberta, setHipoteseAberta] = useState<string | null>(hipoteseDeMenorSlot);

  if (!grafo) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <Sparkles className="text-muted-foreground size-4" />
            Análise assistida
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            Quando o motor estiver ligado, aqui aparecem as hipóteses ranqueadas com o grafo de
            evidências, e cada achado mostra de onde saiu — se foi relato do paciente, registro
            anterior ou inferência da IA.
          </p>
          <p>
            A sugestão nunca entra no prontuário sozinha: você valida ou registra divergência, e a
            divergência também é dado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quando o dado é de demonstração, a tela DIZ. Deixar dado de fixture passar por análise
          real é o pior tipo de mentira de interface — e o guarda `sem-dado-inventado` existe
          justamente para impedir que isso vire hábito. */}
      {ehDemonstracao && (
        <div className="border-primary/40 bg-primary/[0.03] flex items-center gap-2 rounded-lg border border-dashed px-3.5 py-2.5">
          <Badge variant="outline" className="border-primary/40 text-primary text-xs">
            demonstração
          </Badge>
          <p className="text-muted-foreground text-xs">
            Análise de exemplo, do contrato congelado — <strong>não é deste paciente</strong>. O
            motor ainda não está ligado. Serve para ver e revisar o layout.
          </p>
        </div>
      )}

      <PainelHipoteses
        grafo={grafo}
        hipoteseAberta={hipoteseAberta}
        onAbrir={setHipoteseAberta}
        denso={denso}
      />

      {/* A Trava 2, imediatamente depois da saída. Sem espaço para a sugestão parecer conclusão. */}
      <RevisaoHumana
        pacienteId={pacienteId}
        anamneseId={anamneseId}
        teleconsultaId={teleconsultaId}
        grafo={grafo}
        hipoteseAberta={hipoteseAberta}
        denso={denso}
      />
    </div>
  );
}
