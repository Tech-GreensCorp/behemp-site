import type { ReactNode } from 'react';

import { AbasDoDependente } from '@/components/responsavel/abas-do-dependente';
import { Badge } from '@/components/ui/badge';
import { idadeEmAnos } from '@/lib/dependentes/regras';
import { LABEL_STATUS_DO_PACIENTE } from '@/lib/dependentes/rotulos';

import { carregarDependente } from '../../../_lib/carregar-dependente';

/**
 * O cabeçalho de UM dependente: o NOME dele em destaque, em toda seção. É o que identifica "de quem" são os
 * medicamentos, os documentos e as solicitações que a página mostra.
 *
 * ⚠️ Este layout prova o vínculo para decidir o que desenhar, mas NÃO protege as páginas filhas: cada uma chama
 * `carregarDependente` por conta própria.
 */
export default async function DependenteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ pacienteId: string }>;
}) {
  const { pacienteId } = await params;
  const { escopo, ficha } = await carregarDependente(pacienteId);
  const idade = idadeEmAnos(ficha.dataNascimento);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Dependente
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-foreground text-3xl font-bold tracking-tight">
            {ficha.nome}
          </h1>
          <Badge variant="secondary" className="text-[11px] font-bold">
            {LABEL_STATUS_DO_PACIENTE[ficha.status] ?? ficha.status}
          </Badge>
        </div>
        {idade !== null && (
          <p className="text-muted-foreground text-sm">
            {idade} {idade === 1 ? 'ano' : 'anos'}
          </p>
        )}
      </div>
      <AbasDoDependente pacienteId={escopo.pacienteId} />
      {children}
    </div>
  );
}
