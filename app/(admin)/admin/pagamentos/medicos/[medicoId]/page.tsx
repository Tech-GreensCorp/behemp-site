import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { obterConfigPagamentoMedico } from '@/app/(admin)/_actions/pagamentos-medicos';
import { FormConfigPagamentoMedico } from '@/components/admin/pagamentos/form-config-pagamento-medico';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';

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
      <div className="flex items-center gap-3">
        <Link href="/admin/pagamentos/medicos">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft size={16} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{config.medicoNome}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {config.especialidade} — meios de pagamento
          </p>
        </div>
      </div>

      <FormConfigPagamentoMedico configInicial={config} />
    </div>
  );
}
