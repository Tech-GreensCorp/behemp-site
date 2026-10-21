'use client';

/**
 * A curva de titulação — a dose do paciente ao longo do tratamento.
 *
 * POR QUE ISTO EXISTE
 * No canabidiol a titulação **é** o tratamento: *"start low, go slow"* pressupõe ajuste guiado
 * por efeito ao longo de semanas. Uma tela que mostra só a dose de hoje esconde exatamente a
 * informação que dá valor ao acompanhamento (ADR-0005 D-01, R-01).
 *
 * 🔴 O ANTERIOR NUNCA SOME. Cada passo mostra de onde veio e para onde foi, com o motivo — é o
 * `DO-44` (b): *"a dosagem ou medicamento anterior tem que ficar no historico"*.
 *
 * ⚠️ LINHAS LEGADAS APARECEM E VÊM MARCADAS. As anteriores à Sprint 5 foram digitadas em texto
 * livre, sem vínculo com produto do catálogo (`DO-48`). Escondê-las seria perder o histórico na
 * prática; mostrá-las sem marca faria parecer que têm a mesma procedência das novas.
 *
 * 🛑 SEM `<Table>`. O idioma de lista deste produto é lista de Card — `table.tsx` existe e é
 * usado em ZERO arquivos (`06-PADROES-DO-CODIGO.md` §4.4).
 */

import { ArrowRight, FileClock, History } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

import { formatarData } from './PlanoVigente';

export interface PassoDaCurva {
  ajusteId: string;
  dataAjuste: string;
  proximaRevisao: string | null;
  motivoAjuste: string;
  medicamentoNome: string | null;
  dosagemAnterior: string | null;
  novaDosagem: string;
  frequencia: string;
  viaAdministracao: string | null;
  legado: boolean;
}

export function CurvaDeTitulacao({ passos }: { passos: PassoDaCurva[] }) {
  if (passos.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-14 text-center">
          <History size={40} className="text-muted-foreground/40" />
          <p className="font-heading text-base font-medium">Nenhum ajuste registrado</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Quando a dose for ajustada, cada passo aparece aqui com o motivo e a data da próxima
            revisão.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ol className="space-y-3">
      {passos.map((p, i) => (
        <li
          key={`${p.ajusteId}-${i}`}
          className="animate-fade-up"
          style={{ animationDelay: `${Math.min(i, 4) * 60}ms` }}
        >
          <Card className="border-0 shadow-sm transition-all hover:shadow-md">
            <CardContent className="space-y-2.5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileClock size={14} className="text-primary shrink-0" />
                  <span className="text-sm font-medium">{formatarData(p.dataAjuste)}</span>
                  {p.medicamentoNome && (
                    <Badge variant="secondary" className="font-normal">
                      {p.medicamentoNome}
                    </Badge>
                  )}
                </div>
                {p.legado && (
                  // A marca existe para que ninguém confunda dado digitado à mão com dado
                  // vinculado ao catálogo. Ver `DO-48` e ADR-0012 D-03.
                  <Badge variant="outline" className="text-muted-foreground font-normal">
                    registro anterior · texto livre
                  </Badge>
                )}
              </div>

              {/* de -> para: a mudança, que é o que a curva conta */}
              <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
                {p.dosagemAnterior ? (
                  <>
                    <span className="text-muted-foreground decoration-muted-foreground/40 line-through">
                      {p.dosagemAnterior}
                    </span>
                    <ArrowRight size={13} className="text-muted-foreground" />
                  </>
                ) : (
                  <span className="text-muted-foreground text-xs">dose inicial</span>
                )}
                <span className="text-foreground font-semibold">{p.novaDosagem}</span>
                <span className="text-muted-foreground text-xs">· {p.frequencia}</span>
                {p.viaAdministracao && (
                  <span className="text-muted-foreground text-xs">· {p.viaAdministracao}</span>
                )}
              </div>

              <p className="text-muted-foreground text-xs leading-relaxed">
                <span className="text-foreground/80 font-medium">Motivo:</span> {p.motivoAjuste}
              </p>

              {p.proximaRevisao && (
                <p className="text-primary font-mono text-[0.7rem]">
                  próxima revisão em {formatarData(p.proximaRevisao)}
                </p>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ol>
  );
}
