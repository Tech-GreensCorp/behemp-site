import type { Metadata } from 'next';

import { DadosDoDependente } from '@/components/responsavel/dados-do-dependente';
import { JornadaDoDependente } from '@/components/responsavel/jornada-do-dependente';
import { ResumoDoDependenteCards } from '@/components/responsavel/resumo-do-dependente';
import { resumoDoDependente } from '@/lib/dependentes/leituras';

import { carregarDependente } from '../../../_lib/carregar-dependente';

export const metadata: Metadata = { title: 'Dependente | Be4Hope' };
export const dynamic = 'force-dynamic';

/** A visão geral de UM dependente: andamento, os quatro números e os dados, sem misturar com os de outro. */
export default async function DependenteVisaoGeralPage({
  params,
}: {
  params: Promise<{ pacienteId: string }>;
}) {
  const { pacienteId } = await params;
  const { escopo, ficha } = await carregarDependente(pacienteId);
  const resumo = await resumoDoDependente(escopo.pacienteId);

  return (
    <div className="space-y-6">
      <JornadaDoDependente
        nome={ficha.nome}
        fase={ficha.jornadaFase}
        status={ficha.status}
        medicoNome={ficha.medicoNome}
      />
      <ResumoDoDependenteCards resumo={resumo} />
      <DadosDoDependente ficha={ficha} />
    </div>
  );
}
