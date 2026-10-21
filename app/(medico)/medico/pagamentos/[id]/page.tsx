import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { obterPagamentoMedico } from '@/app/(medico)/_actions/pagamentos';
import { PagamentoStatusBadge } from '@/components/shared/pagamentos/pagamento-status-badge';
import { PagamentoFunilBadge } from '@/components/shared/pagamentos/pagamento-funil-badge';
import { AlertTriangle, ChevronLeft, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';

export const metadata: Metadata = {
  title: 'Pagamento — Área Médica Be4Hope',
};

function formatarValor(v: string): string {
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function PagamentoDetalheMedicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resultado = await obterPagamentoMedico(id);

  if (!resultado.sucesso || !resultado.dados) {
    notFound();
  }

  const p = resultado.dados;

  return (
    <div className="space-y-6">
      <Link href="/medico/pagamentos">
        <Button variant="ghost" size="sm" className="gap-1.5">
          <ChevronLeft size={16} />
          Pagamentos
        </Button>
      </Link>

      <PageHeader
        title="Pagamento"
        description={`${p.pacienteNome} · ${new Date(p.dataHora).toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        })}`}
      />

      {p.erroConfirmacao && !p.confirmadoEm && (
        <Card className="border-0 bg-red-50 shadow-sm">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                {p.pagamentoConcluidoEm
                  ? 'O paciente concluiu a etapa de pagamento, mas o agendamento não foi confirmado.'
                  : 'A confirmação do agendamento falhou.'}
              </p>
              <p className="mt-1 text-sm text-red-700">{p.erroConfirmacao}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet size={16} />
            Detalhes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs">Status do pagamento</p>
              <div className="mt-1">
                <PagamentoStatusBadge status={p.status} />
              </div>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Estágio do agendamento</p>
              <div className="mt-1">
                <PagamentoFunilBadge
                  pagamentoConcluidoEm={p.pagamentoConcluidoEm}
                  confirmadoEm={p.confirmadoEm}
                  erroConfirmacao={p.erroConfirmacao}
                />
              </div>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Valor</p>
              <p className="mt-1 text-lg font-bold">
                {p.moeda} {formatarValor(p.valor)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Paciente</p>
              <p className="mt-1 font-medium">{p.pacienteNome}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Pago em</p>
              <p className="mt-1">{p.pagoEm ? new Date(p.pagoEm).toLocaleString('pt-BR') : '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Gateway</p>
              <p className="mt-1">{p.gatewayProvider ?? 'Aguardando integração'}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-muted-foreground mb-3 text-xs font-medium">Rastreamento do funil</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs">Iniciou o agendamento</p>
                <p className="mt-0.5 text-sm">{new Date(p.iniciadoEm).toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Iniciou o pagamento</p>
                <p className="mt-0.5 text-sm">
                  {p.pagamentoIniciadoEm
                    ? new Date(p.pagamentoIniciadoEm).toLocaleString('pt-BR')
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Concluiu a etapa de pagamento</p>
                <p className="mt-0.5 text-sm">
                  {p.pagamentoConcluidoEm
                    ? new Date(p.pagamentoConcluidoEm).toLocaleString('pt-BR')
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Agendamento confirmado</p>
                <p className="mt-0.5 text-sm">
                  {p.confirmadoEm ? new Date(p.confirmadoEm).toLocaleString('pt-BR') : '—'}
                </p>
              </div>
            </div>
            {p.consultaId && (
              <p className="text-muted-foreground mt-3 text-xs">
                Consulta vinculada: <span className="font-mono">{p.consultaId}</span>
              </p>
            )}
          </div>

          {p.observacoes && (
            <div className="border-t pt-4">
              <p className="text-muted-foreground mb-1 text-xs font-medium">Observações</p>
              <p className="text-sm">{p.observacoes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
