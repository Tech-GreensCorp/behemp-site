import { redirect } from 'next/navigation';
import { buscarInvoice } from '@/app/(admin)/_actions/invoices';
import { InvoiceForm } from '@/components/admin/invoices/invoice-form';

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Editar Invoice
        </h1>
        <p className="mt-1 text-muted-foreground">
          {resultado.dados.invoiceNumber}
        </p>
      </div>
      <InvoiceForm invoice={resultado.dados} />
    </div>
  );
}
