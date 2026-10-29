import type { Metadata } from 'next';

import { FormularioDeRecompra } from '@/components/responsavel/formulario-de-recompra';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { responsavelDaSessao } from '@/lib/auth/escopo-do-responsavel';
import { listarRecomprasDoDependente } from '@/lib/dependentes/leituras';
import {
  LABEL_RECOMPRA,
  formatarDataHora,
  formatarDataISO,
  primeiroNome,
} from '@/lib/dependentes/rotulos';

import { carregarDependente } from '../../../../_lib/carregar-dependente';

export const metadata: Metadata = { title: 'Solicitações | Be4Hope' };
export const dynamic = 'force-dynamic';

/**
 * As solicitações (recompras) de UM dependente: o formulário pede em nome dele, e a lista mostra só as dele.
 * O `pacienteId` que o formulário envia é o que o resolvedor devolveu; a action o prova de novo.
 */
export default async function SolicitacoesDoDependentePage({
  params,
}: {
  params: Promise<{ pacienteId: string }>;
}) {
  const { pacienteId } = await params;
  const { escopo, ficha } = await carregarDependente(pacienteId);
  const [lista, responsavel] = await Promise.all([
    listarRecomprasDoDependente(escopo.pacienteId),
    responsavelDaSessao(),
  ]);

  return (
    <div className="space-y-8">
      <FormularioDeRecompra
        pacienteId={escopo.pacienteId}
        nomeDoDependente={primeiroNome(ficha.nome)}
        contatoEmail={responsavel?.email ?? ''}
      />

      <div className="space-y-4">
        <h2 className="font-display text-foreground text-xl font-bold">
          Solicitações de {primeiroNome(ficha.nome)}
        </h2>
        {lista.length === 0 ? (
          <Card className="border-border/50 rounded-[1.75rem] border-dashed">
            <CardContent className="text-muted-foreground p-6 text-sm">
              Nenhuma solicitação para {primeiroNome(ficha.nome)} até agora.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {lista.map((r) => (
              <li key={r.id}>
                <Card className="border-border/50 rounded-[1.5rem] shadow-sm">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-foreground text-sm font-bold">
                        {r.medicamentoNome ?? 'Medicamento'}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {r.mlFrasco && `${r.mlFrasco} ml`}
                        {r.gotasPorDia && ` · ${r.gotasPorDia} gotas/dia`} · previsão{' '}
                        {formatarDataISO(r.dataPrevista)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Pedida por {r.solicitanteNome} em {formatarDataHora(r.criadoEm)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[11px] font-bold">
                      {LABEL_RECOMPRA[r.status] ?? r.status}
                    </Badge>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
