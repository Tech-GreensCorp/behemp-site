'use client';

/**
 * O painel da conduta e titulação de UM paciente — a superfície padrão do `DO-44` (c):
 * *"creio que o certo era separar por paciente além de ter o filtro de geral"*.
 *
 * 🔴 DESENHO ENXUTO POR REQUISITO, NÃO POR GOSTO (`DO-44` d): *"tem que ta bem desenhado
 * intuitivo e nada muito cheio pra nao bagunçar a mente do médico"*. Numa tela que decide dose,
 * densidade é risco clínico. Por isso: o plano vigente e a curva; o formulário só quando
 * chamado; o histórico legado colapsado.
 *
 * Revelação progressiva é o P4 do VidAI (`docs/09-FRONTEND-VIDAI-MEDIDO.md`) — o que importa
 * agora fica visível sem rolagem, o resto existe sem competir.
 *
 * ⚠️ Este componente é PURO DE DADOS: recebe tudo por prop e devolve as intenções por callback.
 * É o que permite o `/preview` montar o COMPONENTE REAL com dados de exemplo, em vez de uma
 * cópia — a cópia diverge do original, e o que o dono aprova deixa de ser o que vai a produção
 * (recusado com motivo no handoff §5.7).
 */

import { useState } from 'react';
import { ChevronDown, Plus, Stethoscope } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { CurvaDeTitulacao, type PassoDaCurva } from './CurvaDeTitulacao';
import { FormConduta, type ProdutoParaForm, type ValoresDaConduta } from './FormConduta';
import { PlanoVigente, type PlanoVigenteDados } from './PlanoVigente';

interface Props {
  pacienteNome?: string | null;
  planosVigentes: PlanoVigenteDados[];
  curva: PassoDaCurva[];
  produtos: ProdutoParaForm[];
  salvando?: boolean;
  onCriarConduta: (v: ValoresDaConduta) => void;
  onAjustarDose: (v: ValoresDaConduta, plano: PlanoVigenteDados) => void;
  /** A ponte para a prescrição. Ausente no preview, onde nada é gravado. */
  onPrescrever?: (plano: PlanoVigenteDados) => void;
  /** O histórico legado em texto livre, colapsado (`DO-48`). */
  historicoLegado?: React.ReactNode;
}

type Aberto =
  | { tipo: 'nenhum' }
  | { tipo: 'conduta' }
  | { tipo: 'ajuste'; plano: PlanoVigenteDados };

export function PainelTitulacao({
  pacienteNome,
  planosVigentes,
  curva,
  produtos,
  salvando = false,
  onCriarConduta,
  onAjustarDose,
  onPrescrever,
  historicoLegado,
}: Props) {
  const [aberto, setAberto] = useState<Aberto>({ tipo: 'nenhum' });
  const [legadoAberto, setLegadoAberto] = useState(false);

  const semPlano = planosVigentes.length === 0;

  return (
    <div className="space-y-6">
      {/* ── Plano vigente ───────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">
            Plano vigente
            {pacienteNome && (
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                · {pacienteNome}
              </span>
            )}
          </h2>
          {aberto.tipo === 'nenhum' && (
            <Button
              size="sm"
              className="gap-1.5 rounded-xl"
              onClick={() => setAberto({ tipo: 'conduta' })}
            >
              <Plus size={14} />
              Nova conduta
            </Button>
          )}
        </div>

        {semPlano && aberto.tipo === 'nenhum' ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <Stethoscope size={40} className="text-muted-foreground/40" />
              <p className="font-heading text-base font-medium">Sem plano terapêutico ativo</p>
              <p className="text-muted-foreground max-w-sm text-sm">
                Registre a conduta para que o acompanhamento, o cálculo de mg/dia e o alerta de fim
                de frasco passem a existir.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {planosVigentes.map((p) => (
              <PlanoVigente
                key={p.dosagemId}
                plano={p}
                onAjustar={
                  aberto.tipo === 'nenhum'
                    ? (plano) => setAberto({ tipo: 'ajuste', plano })
                    : undefined
                }
                onPrescrever={aberto.tipo === 'nenhum' ? onPrescrever : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Formulário, só quando chamado ───────────────────────── */}
      {aberto.tipo !== 'nenhum' && (
        <FormConduta
          modo={aberto.tipo === 'ajuste' ? 'ajuste' : 'conduta'}
          produtos={produtos}
          teorAnterior={aberto.tipo === 'ajuste' ? aberto.plano.teorThcPercentual : null}
          salvando={salvando}
          onCancelar={() => setAberto({ tipo: 'nenhum' })}
          onSalvar={(v) => {
            if (aberto.tipo === 'ajuste') onAjustarDose(v, aberto.plano);
            else onCriarConduta(v);
            setAberto({ tipo: 'nenhum' });
          }}
        />
      )}

      {/* ── A curva ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Curva de titulação</h2>
        <CurvaDeTitulacao passos={curva} />
      </section>

      {/* ── Histórico legado, colapsado (`DO-48`) ───────────────── */}
      {historicoLegado && (
        <section>
          <button
            type="button"
            onClick={() => setLegadoAberto((v) => !v)}
            className="border-border/60 hover:bg-muted/40 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors"
            aria-expanded={legadoAberto}
          >
            <span className="text-sm font-medium">
              Registros anteriores, em texto livre
              <span className="text-muted-foreground ml-2 text-xs font-normal">
                somente leitura
              </span>
            </span>
            <ChevronDown
              size={16}
              className={cn('shrink-0 transition-transform', legadoAberto && 'rotate-180')}
            />
          </button>
          {legadoAberto && <div className="animate-fade-in pt-3">{historicoLegado}</div>}
        </section>
      )}
    </div>
  );
}
