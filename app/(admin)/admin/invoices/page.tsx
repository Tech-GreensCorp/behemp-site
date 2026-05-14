import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { listarInvoices } from '@/app/(admin)/_actions/invoices';
import { InvoiceTypeBadge, InvoiceStatusBadge } from '@/components/admin/invoices/invoice-type-badge';
import { Plus, FileText, Pencil, ExternalLink } from 'lucide-react';
import { InvoiceFilters } from '@/components/admin/invoices/invoice-filters';
import { InvoicePagination } from '@/components/admin/invoices/invoice-pagination';

/**
 * Lista de invoices — Server Component com filtros via searchParams.
 * Os filtros e paginação são controlados pela URL (SSR seguro).
 */
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;

  const tipo = params.tipo || undefined;
  const status = params.status || undefined;
  const busca = params.busca || '';
  const pagina = parseInt(params.pagina || '1', 10);
  const porPagina = 15;
  const offset = (pagina - 1) * porPagina;

  const resultado = await listarInvoices({
    tipo,
    status,
    busca: busca || undefined,
    limite: porPagina,
    offset,
  });

  const invoicesList = resultado.dados?.invoices ?? [];
  const total = resultado.dados?.total ?? 0;
  const totalPaginas = Math.ceil(total / porPagina);

  // Contadores por tipo (total geral sem filtros de tipo)
  const totalGeral = await listarInvoices({ limite: 1 });
  const totalInvoices = totalGeral.dados?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Invoices</h1>
          <p className="mt-1 text-muted-foreground">
            {totalInvoices} invoice{totalInvoices !== 1 ? 's' : ''} no sistema
          </p>
        </div>
        <Link href="/admin/invoices/nova">
          <Button className="gap-2">
            <Plus size={16} />
            Nova Invoice
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <InvoiceFilters
        tipoAtual={tipo}
        statusAtual={status}
        buscaAtual={busca}
      />

      {/* Info de resultados */}
      {(tipo || status || busca) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {total} resultado{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </span>
          {(tipo || status || busca) && (
            <Link
              href="/admin/invoices"
              className="text-xs font-medium text-primary hover:underline"
            >
              Limpar filtros
            </Link>
          )}
        </div>
      )}

      {/* Tabela */}
      {invoicesList.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText size={48} className="mb-4 text-muted-foreground/40" />
            <p className="text-lg font-medium">Nenhuma invoice encontrada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tipo || status || busca
                ? 'Tente ajustar os filtros de busca.'
                : 'Crie sua primeira invoice clicando no botão acima.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3">Número</th>
                    <th className="px-6 py-3">Tipo</th>
                    <th className="px-6 py-3">Paciente</th>
                    <th className="px-6 py-3">Data</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoicesList.map((inv) => (
                    <tr key={inv.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-6 py-4 text-sm font-medium">{inv.invoiceNumber}</td>
                      <td className="px-6 py-4"><InvoiceTypeBadge type={inv.invoiceType} /></td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {inv.patientName ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(inv.invoiceDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4"><InvoiceStatusBadge status={inv.status} /></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/admin/invoices/${inv.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil size={14} />
                            </Button>
                          </Link>
                          <a
                            href={`/api/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <ExternalLink size={14} />
                            </Button>
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paginação */}
      {totalPaginas > 1 && (
        <InvoicePagination
          paginaAtual={pagina}
          totalPaginas={totalPaginas}
          totalRegistros={total}
          porPagina={porPagina}
          tipoAtual={tipo}
          statusAtual={status}
          buscaAtual={busca}
        />
      )}
    </div>
  );
}
