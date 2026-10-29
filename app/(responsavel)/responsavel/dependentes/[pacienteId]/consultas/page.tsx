import type { Metadata } from 'next';
import { CalendarDays } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { listarConsultasDoDependente } from '@/lib/dependentes/leituras';
import { LABEL_CONSULTA, formatarDataHora, primeiroNome } from '@/lib/dependentes/rotulos';

import { carregarDependente } from '../../../../_lib/carregar-dependente';

export const metadata: Metadata = { title: 'Consultas | Be4Hope' };
export const dynamic = 'force-dynamic';

/**
 * As consultas de UM dependente (leitura). Entrar na sala da teleconsulta ainda NÃO é do responsável: o código
 * da sala e da chamada recusa o papel (`lib/auth/escopo-sala.ts`, `escopo-chamada.ts`) e tem fatia própria na
 * ADR-0033 (D-08). Esta tela só LISTA.
 */
export default async function ConsultasDoDependentePage({
  params,
}: {
  params: Promise<{ pacienteId: string }>;
}) {
  const { pacienteId } = await params;
  const { escopo, ficha } = await carregarDependente(pacienteId);
  const lista = await listarConsultasDoDependente(escopo.pacienteId);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-foreground text-xl font-bold">
        Consultas de {primeiroNome(ficha.nome)}
      </h2>
      {lista.length === 0 ? (
        <Card className="border-border/50 rounded-[1.75rem] border-dashed">
          <CardContent className="text-muted-foreground p-6 text-sm">
            Nenhuma consulta de {primeiroNome(ficha.nome)} até agora.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {lista.map((c) => (
            <li key={c.id}>
              <Card className="border-border/50 rounded-[1.5rem] shadow-sm">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    <CalendarDays className="text-primary h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm font-bold">
                      {formatarDataHora(c.dataHora)}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">{c.medicoNome}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[11px] font-bold">
                    {LABEL_CONSULTA[c.status] ?? c.status}
                  </Badge>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
