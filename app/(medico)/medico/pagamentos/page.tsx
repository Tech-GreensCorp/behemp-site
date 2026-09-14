import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  listarPagamentosMedico,
  obterConfigPagamentoMedicoLogado,
  obterEvolucaoRecebidosMedico,
  obterDistribuicaoStatusMedico,
} from '@/app/(medico)/_actions/pagamentos';
import { PagamentoStatusBadge } from '@/components/shared/pagamentos/pagamento-status-badge';
import { PagamentoFunilBadge } from '@/components/shared/pagamentos/pagamento-funil-badge';
import { PagamentoFilters } from '@/components/shared/pagamentos/pagamento-filters';
import { PainelFinanceiroPagamentos } from '@/components/shared/pagamentos/painel-financeiro-pagamentos';
import { ExportarPagamentosCsv } from '@/components/shared/pagamentos/exportar-pagamentos-csv';
import { PageHeader } from '@/components/shared/page-header';
import { DataList, DataRow, DataEmpty } from '@/components/shared/data-list';
import { Wallet, Landmark, AlertTriangle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pagamentos — Área Médica Be4Hope',
};

function formatarValor(v: string | number): string {
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Pagamentos das próprias consultas — visão do médico. Só existe porque, até esta
 * implementação, o médico não tinha nenhuma tela com parâmetro sobre pagamento (achado
 * catalogado ao mapear o fluxo de agendamento/teleconsulta/pagamento). Read-only: trocar
 * status de um pagamento continua exclusivo do admin (é controle financeiro, não dado
 * do médico) — aqui ele só vê o que já existe sobre as próprias consultas.
 */
export default async function PagamentosMedicoPage({
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

  const [resultado, resultadoExportacao, configResultado, evolucaoResultado, distribuicaoResultado] =
    await Promise.all([
      listarPagamentosMedico({ status, busca: busca || undefined, atencao, limite: porPagina, offset }),
      // Mesmos filtros da tela, mas sem paginar — é o que o CSV exporta.
      listarPagamentosMedico({ status, busca: busca || undefined, atencao, limite: 1000, offset: 0 }),
      obterConfigPagamentoMedicoLogado(),
      obterEvolucaoRecebidosMedico(),
      obterDistribuicaoStatusMedico(),
    ]);

  const itens = resultado.dados?.items ?? [];
  const total = resultado.dados?.total ?? 0;
  const totalPaginas = Math.ceil(total / porPagina);
  const itensExportaveis = resultadoExportacao.dados?.items ?? [];

  const resumo = resultado.dados?.resumo ?? {
    totalRecebido: '0',
    totalPendente: '0',
    quantidadePendente: 0,
    quantidadePaga: 0,
  };
  const evolucao = evolucaoResultado.dados ?? [];
  const distribuicaoStatus = distribuicaoResultado.dados ?? [];

  const config = configResultado.dados;
  const configurado = Boolean(
    config &&
      (config.pixHabilitado ||
        config.boletoHabilitado ||
        config.cartaoCreditoHabilitado ||
        config.cartaoDebitoHabilitado),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Pagamentos"
        description={
          <>
            {total} pagamento{total !== 1 ? 's' : ''} das suas consultas
            <span className="mt-1 block text-xs">
              O valor vai direto para você — a Be4Hope não retém nem intermedeia. Esta tela é
              só um registro de acompanhamento; a etapa de pagamento do paciente ainda está em
              desenvolvimento.
            </span>
          </>
        }
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <ExportarPagamentosCsv itens={itensExportaveis} />
            <Link href="/medico/pagamentos/config">
              <Button variant="outline" className="w-full gap-2 sm:w-auto">
                <Landmark size={16} />
                Meus dados de recebimento
              </Button>
            </Link>
          </div>
        }
      />

      {!configurado && (
        <Card className="border-0 bg-amber-50 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                Você ainda não tem nenhum meio de recebimento ativo
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Cadastre sua chave PIX e/ou dados bancários — o administrador precisa
                revisar e ativar antes de aparecer na tela de pagamento do paciente.
              </p>
              <Link href="/medico/pagamentos/config" className="mt-2 inline-block">
                <Button size="sm" variant="outline" className="gap-1.5 border-amber-300 bg-white">
                  <Landmark size={14} />
                  Cadastrar meus dados
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <PainelFinanceiroPagamentos
        resumo={resumo}
        evolucao={evolucao}
        distribuicaoStatus={distribuicaoStatus}
        escopo="medico"
      />

      <PagamentoFilters
        basePath="/medico/pagamentos"
        statusAtual={status}
        buscaAtual={busca}
        atencaoAtual={atencao}
        placeholderBusca="Buscar por paciente..."
      />

      {itens.length === 0 ? (
        <DataEmpty
          icon={<Wallet size={24} />}
          title="Nenhum pagamento encontrado"
          description={
            status || busca || atencao
              ? 'Tente ajustar os filtros de busca.'
              : 'Pagamentos aparecem aqui assim que um paciente inicia um agendamento com você.'
          }
        />
      ) : (
        <DataList>
          {itens.map((p) => (
            <DataRow
              key={p.id}
              href={`/medico/pagamentos/${p.id}`}
              title={p.pacienteNome}
              subtitle={new Date(p.dataHora).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
              meta={
                <div className="text-foreground font-semibold">
                  {p.moeda} {formatarValor(p.valor)}
                </div>
              }
              trailing={
                <>
                  <PagamentoStatusBadge status={p.status} />
                  <PagamentoFunilBadge
                    pagamentoConcluidoEm={p.pagamentoConcluidoEm}
                    confirmadoEm={p.confirmadoEm}
                    erroConfirmacao={p.erroConfirmacao}
                  />
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
              href={`/medico/pagamentos?${new URLSearchParams({
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
