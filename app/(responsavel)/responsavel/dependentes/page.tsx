import type { Metadata } from 'next';
import Link from 'next/link';
import { Baby, ChevronRight, UserPlus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { listarDependentesDoResponsavel } from '@/lib/auth/escopo-do-responsavel';
import { idadeEmAnos } from '@/lib/dependentes/regras';
import { obterFichaDoDependente } from '@/lib/dependentes/leituras';
import {
  caminhoDoDependente,
  LABEL_JORNADA,
  LABEL_STATUS_DO_PACIENTE,
} from '@/lib/dependentes/rotulos';

export const metadata: Metadata = { title: 'Seus dependentes | Be4Hope' };
export const dynamic = 'force-dynamic';

/**
 * "Seus dependentes": a lista, e cada linha ABRE o dependente (pedido de Dryelle: antes não dava para clicar).
 * Os dados vêm de `listarDependentesDoResponsavel`, que só devolve os vínculos ativos DESTE responsável.
 */
export default async function SeusDependentesPage() {
  const dependentes = await listarDependentesDoResponsavel();
  const fichas = await Promise.all(dependentes.map((d) => obterFichaDoDependente(d.pacienteId)));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">
            Seus dependentes
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            As pessoas que estão sob a sua responsabilidade. Abra uma para ver os dados e as
            solicitações dela.
          </p>
        </div>
        <Button
          render={<Link href="/responsavel/dependentes/novo" />}
          className="h-10 rounded-full px-6 text-xs font-semibold"
        >
          <UserPlus className="mr-1.5 h-4 w-4" /> Cadastrar dependente
        </Button>
      </div>

      {dependentes.length === 0 ? (
        <Card className="border-border/50 rounded-[1.75rem] border-dashed">
          <CardContent className="text-muted-foreground p-6 text-sm">
            Você ainda não cadastrou nenhum dependente.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {dependentes.map((d, i) => {
            const idade = idadeEmAnos(d.dataNascimento);
            const ficha = fichas[i];
            return (
              <li key={d.vinculoId}>
                <Link
                  href={caminhoDoDependente(d.pacienteId)}
                  className="border-border/50 hover:border-primary/40 group flex items-center gap-4 rounded-[1.5rem] border bg-white p-4 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="bg-primary/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
                    <Baby className="text-primary h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-foreground truncate text-base font-bold">
                      {d.nome}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {d.parentesco}
                      {idade !== null && ` · ${idade} ${idade === 1 ? 'ano' : 'anos'}`}
                      {ficha && ` · ${LABEL_JORNADA[ficha.jornadaFase] ?? ficha.jornadaFase}`}
                    </p>
                  </div>
                  {ficha && (
                    <Badge
                      variant="secondary"
                      className="hidden shrink-0 text-[11px] font-bold sm:inline-flex"
                    >
                      {LABEL_STATUS_DO_PACIENTE[ficha.status] ?? ficha.status}
                    </Badge>
                  )}
                  <ChevronRight className="text-muted-foreground group-hover:text-primary h-5 w-5 shrink-0 transition-colors" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
