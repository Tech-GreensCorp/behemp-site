import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  listarPagamentos,
  obterResumoPagamentos,
  obterEvolucaoRecebidosPlataforma,
  obterDistribuicaoStatusPlataforma,
} from '@/app/(admin)/_actions/pagamentos';
import { PagamentoStatusBadge } from '@/components/shared/pagamentos/pagamento-status-badge';
import { PagamentoFunilBadge } from '@/components/shared/pagamentos/pagamento-funil-badge';
import { PagamentoFilters } from '@/components/shared/pagamentos/pagamento-filters';
import { PainelFinanceiroPagamentos } from '@/components/shared/pagamentos/painel-financeiro-pagamentos';
import { Wallet, Pencil, Landmark } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataList, DataRow, DataEmpty } from '@/components/shared/data-list';

function formatarValor(v: string | number): string {
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Lista de pagamentos de teleconsulta — Server Component com filtros via searchParams.
 * Mesmo padrão de app/(admin)/admin/invoices/page.tsx.
 */
export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;

  const status = params.status || undefined;
  const busca = params.busca || '';
  const atencao = params.atencao === '1';
  const pagina = parseInt(params.pagina || '1', 10);
  const porPagina = 20;
  const offset = (pagina - 1) * porPagina;

  const [resultado, resumoResultado, evolucaoResultado, distribuicaoResultado] = await Promise.all([
    listarPagamentos({ status, busca: busca || undefined, atencao, limite: porPagina, offset }),
    obterResumoPagamentos(),
    obterEvolucaoRecebidosPlataforma(),
    obterDistribuicaoStatusPlataforma(),
  ]);

  const itens = resultado.dados?.items ?? [];
  const total = resultado.dados?.total ?? 0;
  const totalPaginas = Math.ceil(total / porPagina);
  const evolucao = evolucaoResultado.dados ?? [];
  const distribuicaoStatus = distribuicaoResultado.dados ?? [];

  const resumo = resumoResultado.dados ?? {
    totalRecebido: '0',
    totalPendente: '0',
    quantidadePendente: 0,
    quantidadePaga: 0,
    quantidadeAtencao: 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Pagamentos"
        description={
          <>
            {total} pagamento{total !== 1 ? 's' : ''} de teleconsulta
            <span className="mt-1 block text-xs">
              O valor vai direto para a conta do médico — este painel é um registro de
              acompanhamento, a Be4Hope não retém nem intermedeia o valor.
            </span>
          </>
        }
        actions={
          <Link href="/admin/pagamentos/medicos">
            <Button variant="outline" className="w-full gap-2 sm:w-auto">
              <Landmark size={16} />
              Meios de pagamento por médico
            </Button>
          </Link>
        }
      />

      <PainelFinanceiroPagamentos
        resumo={resumo}
        evolucao={evolucao}
        distribuicaoStatus={distribuicaoStatus}
        atencaoHref="/admin/pagamentos?atencao=1"
        escopo="plataforma"
      />

      <PagamentoFilters
        basePath="/admin/pagamentos"
        statusAtual={status}
        buscaAtual={busca}
        atencaoAtual={atencao}
        placeholderBusca="Buscar por paciente, médico..."
      />

      {itens.length === 0 ? (
        <DataEmpty
          icon={<Wallet size={24} />}
          title="Nenhum pagamento encontrado"
          description={
            status || busca || atencao
              ? 'Tente ajustar os filtros de busca.'
              : 'Pagamentos aparecem aqui assim que um paciente inicia um agendamento.'
          }
        />
      ) : (
        <DataList>
          {itens.map((p) => (
            <DataRow
              key={p.id}
              title={p.pacienteNome ?? '—'}
              subtitle={p.medicoNome ?? '—'}
              meta={
                <>
                  {new Date(p.dataHora).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                  <div className="text-foreground font-semibold">
                    {p.moeda} {formatarValor(p.valor)}
                  </div>
                </>
              }
              trailing={
                <>
                  <PagamentoStatusBadge status={p.status} />
                  <PagamentoFunilBadge
                    pagamentoConcluidoEm={p.pagamentoConcluidoEm}
                    confirmadoEm={p.confirmadoEm}
                    erroConfirmacao={p.erroConfirmacao}
                  />
                  <Link href={`/admin/pagamentos/${p.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Pencil size={14} />
                    </Button>
                  </Link>
                </>
              }
            />
          ))}
        </DataList>
      )}

      {totalPaginas > 1 && (
        <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/pagamentos?${new URLSearchParams({
                ...(status ? { status } : {}),
                ...(busca ? { busca } : {}),
                ...(atencao ? { atencao: '1' } : {}),
                pagina: String(p),
              }).toString()}`}
              className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium ${
                p === pagina ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
