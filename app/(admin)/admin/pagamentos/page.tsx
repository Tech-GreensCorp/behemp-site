import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { listarPagamentos } from '@/app/(admin)/_actions/pagamentos';
import { PagamentoStatusBadge } from '@/components/admin/pagamentos/pagamento-status-badge';
import { PagamentoFunilBadge } from '@/components/admin/pagamentos/pagamento-funil-badge';
import { PagamentoFilters } from '@/components/admin/pagamentos/pagamento-filters';
import { Settings, Wallet, Pencil } from 'lucide-react';

function formatarValor(v: string): string {
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

  const resultado = await listarPagamentos({
    status,
    busca: busca || undefined,
    atencao,
    limite: porPagina,
    offset,
  });

  const itens = resultado.dados?.items ?? [];
  const total = resultado.dados?.total ?? 0;
  const totalPaginas = Math.ceil(total / porPagina);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Pagamentos</h1>
          <p className="mt-1 text-muted-foreground">
            {total} pagamento{total !== 1 ? 's' : ''} de teleconsulta
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            O valor vai direto para a conta do médico — este painel é um registro de
            acompanhamento, a Be4Hope não retém nem intermedeia o valor.
          </p>
        </div>
        <Link href="/admin/pagamentos/configuracoes">
          <Button variant="outline" className="gap-2">
            <Settings size={16} />
            Configurar valor da consulta
          </Button>
        </Link>
      </div>

      <PagamentoFilters statusAtual={status} buscaAtual={busca} atencaoAtual={atencao} />

      {itens.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Wallet size={48} className="mb-4 text-muted-foreground/40" />
            <p className="text-lg font-medium">Nenhum pagamento encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {status || busca || atencao
                ? 'Tente ajustar os filtros de busca.'
                : 'Pagamentos aparecem aqui assim que um paciente inicia um agendamento.'}
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
                    <th className="px-6 py-3">Paciente</th>
                    <th className="px-6 py-3">Médico</th>
                    <th className="px-6 py-3">Horário solicitado</th>
                    <th className="px-6 py-3 text-right">Valor (recebido pelo médico)</th>
                    <th className="px-6 py-3">Pagamento</th>
                    <th className="px-6 py-3">Agendamento</th>
                    <th className="px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itens.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-6 py-4 text-sm font-medium">{p.pacienteNome ?? '—'}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{p.medicoNome ?? '—'}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(p.dataHora).toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold">
                        {p.moeda} {formatarValor(p.valor)}
                      </td>
                      <td className="px-6 py-4">
                        <PagamentoStatusBadge status={p.status} />
                      </td>
                      <td className="px-6 py-4">
                        <PagamentoFunilBadge
                          pagamentoConcluidoEm={p.pagamentoConcluidoEm}
                          confirmadoEm={p.confirmadoEm}
                          erroConfirmacao={p.erroConfirmacao}
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/admin/pagamentos/${p.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Pencil size={14} />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
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
