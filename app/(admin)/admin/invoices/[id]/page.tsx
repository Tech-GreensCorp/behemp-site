import { redirect } from 'next/navigation';
import { buscarInvoice } from '@/app/(admin)/_actions/invoices';
import { InvoiceForm } from '@/components/admin/invoices/invoice-form';
import { PageHeader } from '@/components/shared/page-header';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarInvoicePage({ params }: Props) {
  const { id } = await params;
  const resultado = await buscarInvoice(id);

  if (!resultado.sucesso || !resultado.dados) {
    redirect('/admin/invoices');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Editar Invoice"
        description={resultado.dados.invoiceNumber}
      />
      <InvoiceForm invoice={resultado.dados} />
    </div>
  );
}
