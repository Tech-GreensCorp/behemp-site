import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { listarPlanosTratamento } from '@/app/(admin)/_actions/planos-tratamento';
import { InvoiceStatusBadge } from '@/components/admin/invoices/invoice-type-badge';
import { Plus, ClipboardList, Pencil, ExternalLink } from 'lucide-react';
import { InvoiceFilters } from '@/components/admin/invoices/invoice-filters';
import { InvoicePagination } from '@/components/admin/invoices/invoice-pagination';
import { PageHeader } from '@/components/shared/page-header';
import { DataList, DataRow, DataEmpty } from '@/components/shared/data-list';
import { formatarData, formatarValor } from '@/lib/planos-tratamento/calculo';

const ROTA = '/admin/planos-tratamento';

/**
 * Lista de planos de tratamento (Adesão Collab) — mesmo desenho de `../invoices/page.tsx`.
 * Filtros e paginação controlados pela URL; os componentes de filtro/paginação são os da
 * invoice, apontados para esta rota via `basePath`. Sem filtro de tipo: todo plano é Collab.
 */
export default async function PlanosTratamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;

  const status = params.status || undefined;
  const busca = params.busca || '';
  const pagina = Math.max(1, parseInt(params.pagina || '1', 10) || 1);
  const porPagina = 15;
  const offset = (pagina - 1) * porPagina;

  const [resultado, totalGeral] = await Promise.all([
    listarPlanosTratamento({
      status,
      busca: busca || undefined,
      limite: porPagina,
      offset,
    }),
    listarPlanosTratamento({ limite: 1 }),
  ]);

  const planos = resultado.dados?.planos ?? [];
  const total = resultado.dados?.total ?? 0;
  const totalPaginas = Math.ceil(total / porPagina);
  const totalPlanos = totalGeral.dados?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Plano de Tratamento"
        description={`${totalPlanos} plano${totalPlanos !== 1 ? 's' : ''} de tratamento no sistema`}
        actions={
          <Link href={`${ROTA}/novo`}>
            <Button className="gap-2">
              <Plus size={16} />
              Novo Plano
            </Button>
          </Link>
        }
      />

      <InvoiceFilters
        statusAtual={status}
        buscaAtual={busca}
        basePath={ROTA}
        mostrarTipos={false}
      />

      {(status || busca) && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>
            {total} resultado{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </span>
          <Link href={ROTA} className="text-primary text-xs font-medium hover:underline">
            Limpar filtros
          </Link>
        </div>
      )}

      {!resultado.sucesso ? (
        <DataEmpty
          icon={<ClipboardList size={24} />}
          title="Não foi possível carregar os planos"
          description={resultado.erro ?? 'Tente novamente em instantes.'}
        />
      ) : planos.length === 0 ? (
        <DataEmpty
          icon={<ClipboardList size={24} />}
          title="Nenhum plano de tratamento encontrado"
          description={
            status || busca
              ? 'Tente ajustar os filtros de busca.'
              : 'Crie o primeiro plano clicando no botão acima.'
          }
        />
      ) : (
        <DataList>
          {planos.map((plano) => (
            <DataRow
              key={plano.id}
              icon={<ClipboardList size={18} className="text-muted-foreground" />}
              title={plano.planoNumber}
              subtitle={plano.patientName}
              meta={`${formatarData(plano.dataAdesao)} · R$ ${formatarValor(Number(plano.totalAdesao))}`}
              trailing={
                <>
                  <InvoiceStatusBadge status={plano.status} />
                  <Link href={`${ROTA}/${plano.id}`} aria-label="Editar plano">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Pencil size={14} />
                    </Button>
                  </Link>
                  <a
                    href={`/api/planos-tratamento/${plano.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Abrir documento do plano"
                  >
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

      {totalPaginas > 1 && (
        <InvoicePagination
          paginaAtual={pagina}
          totalPaginas={totalPaginas}
          totalRegistros={total}
          porPagina={porPagina}
          statusAtual={status}
          buscaAtual={busca}
          basePath={ROTA}
          rotuloPlural="planos"
        />
      )}
    </div>
  );
}
