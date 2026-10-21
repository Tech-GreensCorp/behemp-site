import { InvoiceForm } from '@/components/admin/invoices/invoice-form';
import { PageHeader } from '@/components/shared/page-header';

export default function NovaInvoicePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Nova Invoice"
        description="Preencha os dados para gerar uma nova invoice médica."
      />
      <InvoiceForm />
    </div>
  );
}
