import { redirect } from 'next/navigation';
import { buscarPlanoTratamento } from '@/app/(admin)/_actions/planos-tratamento';
import { PlanoTratamentoForm } from '@/components/admin/planos-tratamento/plano-tratamento-form';
import { PageHeader } from '@/components/shared/page-header';
import { verificarAdmin } from '@/lib/auth';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarPlanoTratamentoPage({ params }: Props) {
  const { id } = await params;
  const [resultado, auth] = await Promise.all([buscarPlanoTratamento(id), verificarAdmin()]);

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
      {/* O botão Excluir só existe para admin — decidido aqui, no servidor. A action confere de
          novo; esconder o botão não é a barreira, é a cortesia. */}
      <PlanoTratamentoForm plano={resultado.dados} podeExcluir={auth.autorizado} />
    </div>
  );
}
