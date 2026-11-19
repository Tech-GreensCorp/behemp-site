import { redirect } from 'next/navigation';
import { buscarPlanoTratamento } from '@/app/(admin)/_actions/planos-tratamento';
import { PlanoTratamentoForm } from '@/components/admin/planos-tratamento/plano-tratamento-form';
import { PageHeader } from '@/components/shared/page-header';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarPlanoTratamentoPage({ params }: Props) {
  const { id } = await params;
  const resultado = await buscarPlanoTratamento(id);

  if (!resultado.sucesso || !resultado.dados) {
    redirect('/admin/planos-tratamento');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Editar Plano de Tratamento"
        description={resultado.dados.planoNumber}
      />
      <PlanoTratamentoForm plano={resultado.dados} />
    </div>
  );
}
