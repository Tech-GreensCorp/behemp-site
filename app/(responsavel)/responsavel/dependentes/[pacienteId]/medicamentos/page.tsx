import type { Metadata } from 'next';
import { Pill } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { listarMedicamentosDoDependente } from '@/lib/dependentes/leituras';
import { primeiroNome, formatarDataISO } from '@/lib/dependentes/rotulos';

import { carregarDependente } from '../../../../_lib/carregar-dependente';

export const metadata: Metadata = { title: 'Medicamentos | Be4Hope' };
export const dynamic = 'force-dynamic';

export default async function MedicamentosDoDependentePage({
  params,
}: {
  params: Promise<{ pacienteId: string }>;
}) {
  const { pacienteId } = await params;
  const { escopo, ficha } = await carregarDependente(pacienteId);
  const itens = await listarMedicamentosDoDependente(escopo.pacienteId);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-foreground text-xl font-bold">
        Medicamentos de {primeiroNome(ficha.nome)}
      </h2>
      {itens.length === 0 ? (
        <Card className="border-border/50 rounded-[1.75rem] border-dashed">
          <CardContent className="text-muted-foreground p-6 text-sm">
            Nenhum medicamento foi registrado para {primeiroNome(ficha.nome)} ainda. Eles aparecem
            aqui depois da consulta com o médico.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {itens.map((m) => (
            <li key={m.id}>
              <Card className="border-border/50 rounded-[1.5rem] shadow-sm">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    <Pill className="text-primary h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="font-display text-foreground text-base font-bold">
                      {m.tipoCanabinoide} · {m.novaDosagem}
                    </p>
                    <p className="text-muted-foreground text-sm">{m.frequencia}</p>
                    <p className="text-muted-foreground text-xs">
                      {[
                        m.concentracaoTHC && `THC ${m.concentracaoTHC}`,
                        m.concentracaoCBD && `CBD ${m.concentracaoCBD}`,
                        m.viaAdministracao,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Ajuste de {formatarDataISO(m.dataAjuste)}
                      {m.proximaRevisao && ` · revisão em ${formatarDataISO(m.proximaRevisao)}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
