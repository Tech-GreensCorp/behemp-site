'use client';

/**
 * As opções de medicamento de uma hipótese — no máximo 3, ranqueadas, com o porquê de cada uma.
 *
 * Pedido do dono em 24/08/2026: *"ao clicar em uma das hipóteses (…) tem que aparecer a medicação
 * daquele caso (…) no máximo 3 remédios por hipótese ranqueando qual é melhor e porque"*.
 *
 * 🔴 POR QUE ISTO NÃO VIOLA A PROIBIÇÃO Nº 2 — E O CRITÉRIO É OBJETIVO
 * Parecia haver contradição: o `DO-29` manda recomendar medicamento, e a proibição nº 2 do
 * `CLAUDE.md` proíbe a tela de **dirigir** a conduta. O IMDRF/SaMD N12:2014 resolve com uma
 * linha exata, catalogada como `IMD-01`/`IMD-02`:
 *
 * - **informar** = *"inform health care providers of **treatment options**"*. Listar opções
 *   ranqueadas com justificativa é **literalmente** esta definição — a categoria de MENOR risco.
 * - **dirigir** = *"aid in treatment by providing **enhanced support in the safe and effective
 *   use of drugs**"* — que é o que descreve dose, frequência, titulação, interação.
 *
 * Daí a regra que este componente materializa: **opção sim, posologia não.** Não há mg, não há
 * frequência, não há esquema de titulação — nem no tipo `MedicamentoSugerido`, nem aqui. Dose é
 * ato do médico, na prescrição. O guarda `medicacao-informa-nao-prescreve` mantém a ausência.
 *
 * 🔴 E NÃO HÁ BOTÃO DE PRESCREVER. Nenhum caminho de um clique entre sugestão e prescrição —
 * é o desenho que o `DO-33` aprovou e que a proibição nº 2 exige.
 *
 * ⚠️ `GAP-03` ABERTO: de onde vem o catálogo de produtos, e quem valida clinicamente, é decisão
 * de farmacêutico. Por isso `procedencia` é obrigatória e aparece em **cada** opção: enquanto o
 * corpus não existir, tudo que o motor sugerir chega rotulado como sugestão de modelo, nunca
 * como item de catálogo validado.
 */

import { useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Bot,
  Building2,
  ChevronDown,
  Info,
  Pill,
  Search,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  MAX_MEDICAMENTOS_POR_HIPOTESE,
  type ConfiancaEvidencia,
  type MedicamentoSugerido,
} from '@/lib/ia-clinica/contrato';
import { cn } from '@/lib/utils';

/**
 * Como cada procedência aparece. Mesma lógica de `PROVENIENCIA` em `PainelHipoteses` — sem o
 * rótulo, sugestão de modelo e item validado ficam idênticos na tela.
 */
const PROCEDENCIA: Record<
  MedicamentoSugerido['procedencia'],
  { rotulo: string; icone: typeof Bot; classe: string }
> = {
  inferido_ia: { rotulo: 'sugerido pela IA', icone: Bot, classe: 'text-primary' },
  catalogo_validado: { rotulo: 'catálogo validado', icone: BadgeCheck, classe: 'text-secondary' },
  protocolo_institucional: {
    rotulo: 'protocolo interno',
    icone: Building2,
    classe: 'text-secondary',
  },
};

/**
 * Procedência fora do contrato **denuncia**, não cai num padrão silencioso — mesma decisão do
 * `ChipAchado`, e pelo mesmo motivo: enquanto o `GAP-03` estiver aberto, a origem de uma
 * recomendação de medicamento é a informação que impede sugestão de modelo de passar por item de
 * catálogo validado. Inventar um padrão aqui seria mentir exatamente onde não se pode.
 */
function procedenciaDe(valor: string): (typeof PROCEDENCIA)[keyof typeof PROCEDENCIA] {
  return (
    PROCEDENCIA[valor as MedicamentoSugerido['procedencia']] ?? {
      rotulo: `procedência desconhecida: ${valor}`,
      icone: AlertTriangle,
      classe: 'text-destructive',
    }
  );
}

/** A faixa, nunca percentual — ADR-0006. Mesmas classes do painel de hipóteses. */
const FAIXA: Record<ConfiancaEvidencia, { rotulo: string; classe: string }> = {
  alta: { rotulo: 'evidência alta', classe: 'border-secondary/40 text-secondary' },
  media: { rotulo: 'evidência média', classe: 'border-primary/40 text-primary' },
  baixa: { rotulo: 'evidência baixa', classe: 'border-muted-foreground/30 text-muted-foreground' },
};

const ORDINAL = ['1ª opção', '2ª opção', '3ª opção'] as const;

function CartaoMedicamento({
  medicamento,
  denso,
}: {
  medicamento: MedicamentoSugerido;
  denso: boolean;
}) {
  // No modo denso o cartão nasce fechado: é o que faz caber no sidebar da teleconsulta, onde a
  // largura é de uma coluna estreita e o vídeo não pode perder espaço.
  const [aberto, setAberto] = useState(!denso);
  const proc = procedenciaDe(medicamento.procedencia);
  const IconeProc = proc.icone;
  const faixa = medicamento.confianca_evidencia;
  const temDetalhe = Boolean(medicamento.porQue || medicamento.ressalvas?.length);

  return (
    <li className="border-border rounded-lg border">
      <button
        type="button"
        onClick={() => temDetalhe && setAberto((v) => !v)}
        aria-expanded={temDetalhe ? aberto : undefined}
        disabled={!temDetalhe}
        className={cn(
          'flex w-full items-start gap-2.5 p-3 text-left',
          temDetalhe && 'hover:bg-muted/40 transition-colors',
        )}
      >
        <span
          className={cn(
            'bg-muted mt-0.5 flex shrink-0 items-center justify-center rounded-full font-mono font-bold',
            denso ? 'size-5 text-[10px]' : 'size-6 text-xs',
          )}
        >
          {medicamento.rank}
        </span>

        <span className="min-w-0 flex-1">
          <span className={cn('block font-medium', denso ? 'text-[13px]' : 'text-sm')}>
            {medicamento.nome}
          </span>

          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
              {ORDINAL[medicamento.rank - 1]}
            </span>
            {medicamento.proporcao && (
              <span className="text-muted-foreground font-mono text-[11px]">
                {medicamento.proporcao}
              </span>
            )}
            {medicamento.via && (
              <span className="text-muted-foreground text-[11px]">· {medicamento.via}</span>
            )}
          </span>

          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {faixa && (
              <Badge variant="outline" className={cn('text-[10px]', FAIXA[faixa].classe)}>
                {FAIXA[faixa].rotulo}
              </Badge>
            )}
            {/* A procedência de CADA opção, sempre. É o que impede sugestão de modelo de passar
                por item de catálogo validado enquanto o GAP-03 estiver aberto. */}
            <span className={cn('flex items-center gap-1 text-[10px]', proc.classe)}>
              <IconeProc className="size-3" />
              {proc.rotulo}
            </span>
            {medicamento.referencia && (
              <span className="text-muted-foreground font-mono text-[10px]">
                {medicamento.referencia}
              </span>
            )}
          </span>
        </span>

        {temDetalhe && (
          <ChevronDown
            className={cn(
              'text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform',
              aberto && 'rotate-180',
            )}
          />
        )}
      </button>

      {aberto && temDetalhe && (
        <div className="space-y-2.5 border-t px-3 py-3">
          {medicamento.porQue && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                Por que nesta posição
              </p>
              <p className={cn('text-foreground/90', denso ? 'text-[13px]' : 'text-sm')}>
                {medicamento.porQue}
              </p>
            </div>
          )}

          {/* As ressalvas têm o mesmo peso visual do argumento a favor — mesma decisão que faz
              "o que contradiz" aparecer junto de "o que sustenta" no painel de hipóteses. */}
          {medicamento.ressalvas && medicamento.ressalvas.length > 0 && (
            <div className="space-y-1">
              <p className="text-destructive flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
                <AlertTriangle className="size-3" />O que pesa contra
              </p>
              <ul className="space-y-1">
                {medicamento.ressalvas.map((r, i) => (
                  <li
                    key={i}
                    className={cn(
                      'text-muted-foreground flex gap-1.5',
                      denso ? 'text-[12px]' : 'text-sm',
                    )}
                  >
                    <span className="text-destructive/60 mt-0.5 shrink-0">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

interface Props {
  medicamentos: MedicamentoSugerido[] | undefined;
  /** Compacto para o sidebar da teleconsulta: cartões nascem fechados e a tipografia diminui. */
  denso?: boolean;
  className?: string;
}

export function MedicacoesSugeridas({ medicamentos, denso = false, className }: Props) {
  // Ausência é estado legítimo e informativo: significa que o motor não tinha base para sugerir.
  // Esconder a seção faria parecer que a hipótese não foi analisada.
  if (!medicamentos || medicamentos.length === 0) {
    return (
      <div className={cn('space-y-1.5', className)}>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          <Pill className="size-3.5" />
          Opções de medicamento
        </p>
        <p className="text-muted-foreground bg-muted/40 flex items-start gap-2 rounded-md p-3 text-sm">
          <Search className="mt-0.5 size-4 shrink-0" />
          <span>
            Nenhuma opção sugerida para esta hipótese. Quando o motor não sugere, em geral é porque
            o próximo passo é <strong className="text-foreground">investigar</strong>, não medicar.
          </span>
        </p>
      </div>
    );
  }

  // O contrato diz no máximo 3. Se vier mais, é defeito do motor — cortar em silêncio esconderia
  // o defeito, então corta e diz.
  const exibidos = medicamentos.slice(0, MAX_MEDICAMENTOS_POR_HIPOTESE);
  const cortados = medicamentos.length - exibidos.length;

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
        <Pill className="size-3.5" />
        Opções de medicamento
        <span className="text-muted-foreground/70 font-normal normal-case">
          — {exibidos.length} de no máximo {MAX_MEDICAMENTOS_POR_HIPOTESE}
        </span>
      </p>

      {/*
        O aviso que sustenta o enquadramento IMD-01. Não é disclaimer decorativo: é o que diz ao
        médico que a lista é insumo, e explica por que não há dose aqui.
      */}
      <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Opções para você considerar, em ordem sugerida.{' '}
          <strong className="text-foreground">Sem dose</strong> — posologia e titulação são sua
          decisão, na prescrição.
        </span>
      </p>

      <ul className="space-y-2">
        {exibidos.map((m) => (
          <CartaoMedicamento key={m.id} medicamento={m} denso={denso} />
        ))}
      </ul>

      {cortados > 0 && (
        <p className="text-destructive text-xs">
          ⚠️ O motor devolveu {medicamentos.length} opções; o contrato permite{' '}
          {MAX_MEDICAMENTOS_POR_HIPOTESE}. {cortados} não exibida(s) — defeito a reportar.
        </p>
      )}

      {/*
        FRONTEIRA_MOTOR_IA: na Metade 2, estas opções vêm do motor com o corpus de canabidiol
        (GAP-03). Nenhum botão de prescrever entra aqui — a prescrição é tela própria (Sprint 5).
      */}
    </div>
  );
}
