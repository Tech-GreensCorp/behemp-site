import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { obterConfigPagamentoMedico } from '@/app/(admin)/_actions/pagamentos-medicos';
import { FormConfigPagamentoMedico } from '@/components/admin/pagamentos/form-config-pagamento-medico';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-header';

export const metadata: Metadata = {
  title: 'Configurar pagamento do médico — Admin Be4Hope',
};

interface Props {
  params: Promise<{ medicoId: string }>;
}

export default async function PagamentoMedicoPage({ params }: Props) {
  const { medicoId } = await params;
  const resultado = await obterConfigPagamentoMedico(medicoId);

  if (!resultado.sucesso || !resultado.dados) {
    notFound();
  }

  const config = resultado.dados;

  return (
    <div className="space-y-6">
      <Link href="/admin/pagamentos/medicos">
        <Button variant="ghost" size="sm" className="gap-1.5">
          <ChevronLeft size={16} />
          Médicos
        </Button>
      </Link>

      <PageHeader
        title={config.medicoNome}
        description={`${config.especialidade} — meios de pagamento`}
      />

      <FormConfigPagamentoMedico configInicial={config} />
    </div>
  );
}
