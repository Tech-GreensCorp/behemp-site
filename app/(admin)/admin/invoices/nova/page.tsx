import { InvoiceForm } from '@/components/admin/invoices/invoice-form';

export default function NovaInvoicePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Nova Invoice</h1>
        <p className="mt-1 text-muted-foreground">
          Preencha os dados para gerar uma nova invoice médica.
        </p>
      </div>
      <InvoiceForm />
    </div>
  );
}
