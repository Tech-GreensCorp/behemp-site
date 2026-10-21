'use client';

/**
 * O passo humano entre a conduta e o documento legal.
 *
 * ADR-0005 D-04: a conduta **preenche** a prescrição e entrega ao fluxo existente. Este diálogo
 * é a entrega — mostra exatamente o que vai ser gravado, e só então chama a `criarPrescricao`
 * que já existe.
 *
 * 🔴 POR QUE UM PASSO, E NÃO UM BOTÃO DIRETO. A proibição nº 2 do `CLAUDE.md` veda caminho de um
 * clique entre sugestão e prescrição. Aqui a origem é a conduta do próprio médico, não uma
 * saída de modelo — mas o princípio vale igual: quem emite receituário controlado confere antes
 * o que está emitindo.
 *
 * 🔴 E QUANDO O SISTEMA NÃO TEM O TIPO EXIGIDO, ELE DIZ. `prescricaoTipoEnum` não tem
 * `notificacao_a` (medido em `db/schema/enums.ts:107`), e o `CAN-04` exige esse documento para
 * THC acima de 0,2%. Nesse caso o diálogo AVISA que a Notificação de Receita "A" precisa ser
 * emitida fora do sistema — em vez de gravar `controle_especial` e deixar parecer conforme.
 * Fingir conformidade num receituário controlado é pior que não emitir.
 */

import { AlertTriangle, FileSignature, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface RascunhoParaConfirmar {
  medicamentos: Array<{
    nome: string;
    dose: string;
    forma: string;
    posologia: string;
    quantidade: string;
  }>;
  tipoExigido: 'controle_especial' | 'notificacao_a' | 'indeterminado';
  tipoQueOSistemaGrava: 'simples' | 'controle_especial' | 'personalizado';
  faltaTipoNoSistema: boolean;
  avisoDoTipo: string;
}

interface Props {
  rascunho: RascunhoParaConfirmar | null;
  emitindo?: boolean;
  onFechar: () => void;
  onConfirmar: () => void;
}

export function PontePrescricao({ rascunho, emitindo = false, onFechar, onConfirmar }: Props) {
  return (
    <Dialog open={rascunho !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2 text-base">
            <FileSignature size={17} className="text-primary" />
            Confirmar a prescrição
          </DialogTitle>
        </DialogHeader>

        {rascunho && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Isto é o que vai ser gravado na prescrição, a partir do plano vigente. Confira antes
              de emitir — a assinatura, o PDF e a numeração seguem o fluxo de sempre.
            </p>

            {rascunho.medicamentos.map((m, i) => (
              <div key={i} className="space-y-1.5 rounded-xl border p-4">
                <p className="font-heading text-sm font-semibold">{m.nome}</p>
                <dl className="space-y-1 font-mono text-xs">
                  <Linha rotulo="Dose" valor={m.dose} />
                  <Linha rotulo="Forma" valor={m.forma} />
                  <Linha rotulo="Posologia" valor={m.posologia} />
                  <Linha rotulo="Quantidade" valor={m.quantidade} />
                </dl>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">Receituário exigido:</span>
              <Badge variant="outline" className="font-normal">
                {rascunho.avisoDoTipo}
              </Badge>
            </div>

            {rascunho.faltaTipoNoSistema && (
              <div className="flex items-start gap-3 rounded-xl border border-[var(--chart-5)]/40 bg-[var(--chart-5)]/5 p-4">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--chart-5)]" />
                <div className="space-y-1 text-xs leading-relaxed">
                  <p className="font-semibold">
                    A Notificação de Receita &quot;A&quot; não é emitida por este sistema.
                  </p>
                  <p className="text-muted-foreground">
                    O teor de THC informado exige esse documento (CAN-04). A prescrição será gravada
                    como Receita de Controle Especial, e a Notificação precisa ser emitida pelo
                    caminho próprio. O sistema registra o que foi avisado e o que você decidiu.
                  </p>
                </div>
              </div>
            )}

            {rascunho.tipoExigido === 'indeterminado' && (
              <p className="bg-muted/40 text-muted-foreground rounded-xl px-4 py-3 text-xs leading-relaxed">
                O teor de THC do produto não foi informado, então não é possível dizer qual
                receituário se aplica. A prescrição será gravada como simples.
              </p>
            )}

            <div className="flex justify-end gap-3 border-t pt-4">
              <Button variant="outline" onClick={onFechar} disabled={emitindo}>
                Cancelar
              </Button>
              <Button onClick={onConfirmar} disabled={emitindo} className="gap-2 rounded-xl">
                {emitindo && <Loader2 size={15} className="animate-spin" />}
                Emitir prescrição
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground w-20 shrink-0">{rotulo}</dt>
      <dd className="min-w-0 flex-1">{valor}</dd>
    </div>
  );
}
