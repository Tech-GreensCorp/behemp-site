import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { listarInvoices } from '@/app/(admin)/_actions/invoices';
import { InvoiceTypeBadge, InvoiceStatusBadge } from '@/components/admin/invoices/invoice-type-badge';
import { Plus, FileText, Pencil, ExternalLink } from 'lucide-react';
import { InvoiceFilters } from '@/components/admin/invoices/invoice-filters';
import { InvoicePagination } from '@/components/admin/invoices/invoice-pagination';
import { PageHeader } from '@/components/shared/page-header';
import { DataList, DataRow, DataEmpty } from '@/components/shared/data-list';

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
      <PageHeader
        eyebrow="Financeiro"
        title="Invoices"
        description={`${totalInvoices} invoice${totalInvoices !== 1 ? 's' : ''} no sistema`}
        actions={
          <Link href="/admin/invoices/nova">
            <Button className="gap-2">
              <Plus size={16} />
              Nova Invoice
            </Button>
          </Link>
        }
      />

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

      {/* Lista */}
      {invoicesList.length === 0 ? (
        <DataEmpty
          icon={<FileText size={24} />}
          title="Nenhuma invoice encontrada"
          description={
            tipo || status || busca
              ? 'Tente ajustar os filtros de busca.'
              : 'Crie sua primeira invoice clicando no botão acima.'
          }
        />
      ) : (
        <DataList>
          {invoicesList.map((inv) => (
            <DataRow
              key={inv.id}
              icon={<FileText size={18} className="text-muted-foreground" />}
              title={inv.invoiceNumber}
              subtitle={inv.patientName ?? '—'}
              meta={new Date(inv.invoiceDate + 'T00:00:00').toLocaleDateString('pt-BR')}
              trailing={
                <>
                  <InvoiceTypeBadge type={inv.invoiceType} />
                  <InvoiceStatusBadge status={inv.status} />
                  <Link href={`/admin/invoices/${inv.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Pencil size={14} />
                    </Button>
                  </Link>
                  <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ExternalLink size={14} />
                    </Button>
                  </a>
                </>
              }
            />
          ))}
        </DataList>
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
