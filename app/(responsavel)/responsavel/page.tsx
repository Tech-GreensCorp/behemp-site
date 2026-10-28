import type { Metadata } from 'next';
import { Baby } from 'lucide-react';

import { FormularioDeDependente } from '@/components/responsavel/formulario-de-dependente';
import { Card, CardContent } from '@/components/ui/card';
import { listarDependentesDoResponsavel } from '@/lib/auth/escopo-do-responsavel';
import { idadeEmAnos } from '@/lib/dependentes/regras';

export const metadata: Metadata = { title: 'Área do responsável | Be4Hope' };
// Lê o banco a cada acesso: a lista é do responsável logado, nunca pode ser cacheada entre usuários.
export const dynamic = 'force-dynamic';

/**
 * Os dependentes do responsável logado (ADR-0033). A lista vem de `listarDependentesDoResponsavel`, que só
 * devolve vínculos `ativos` DESTE responsável: nenhum identificador vem da URL nem do cliente.
 */
export default async function ResponsavelPage() {
  const dependentes = await listarDependentesDoResponsavel();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">
          Seus dependentes
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Aqui ficam as pessoas que estão sob a sua responsabilidade. O acompanhamento e as
          solicitações em nome deles estão sendo liberados por etapa.
        </p>
      </div>

      {dependentes.length === 0 ? (
        <Card className="border-border/50 rounded-[1.75rem] border-dashed">
          <CardContent className="text-muted-foreground p-6 text-sm">
            Você ainda não cadastrou nenhum dependente. Use o formulário abaixo.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {dependentes.map((d) => {
            const idade = idadeEmAnos(d.dataNascimento);
            return (
              <li key={d.vinculoId}>
                <Card className="border-border/50 rounded-[1.75rem] shadow-sm">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="bg-primary/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
                      <Baby className="text-primary h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-foreground truncate text-base font-bold">
                        {d.nome}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {d.parentesco}
                        {idade !== null && ` · ${idade} ${idade === 1 ? 'ano' : 'anos'}`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <FormularioDeDependente />
    </div>
  );
}
