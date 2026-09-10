import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { obterPagamento } from '@/app/(admin)/_actions/pagamentos';
import { PagamentoStatusBadge } from '@/components/admin/pagamentos/pagamento-status-badge';
import { PagamentoFunilBadge } from '@/components/admin/pagamentos/pagamento-funil-badge';
import { PagamentoStatusForm } from '@/components/admin/pagamentos/pagamento-status-form';
import { AlertTriangle, ChevronLeft, Wallet } from 'lucide-react';

function formatarValor(v: string): string {
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function PagamentoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resultado = await obterPagamento(id);

  if (!resultado.sucesso || !resultado.dados) {
    notFound();
  }

  const p = resultado.dados;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/pagamentos">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft size={16} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pagamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {p.pacienteNome} · {new Date(p.dataHora).toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </p>
        </div>
      </div>

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
              <p className="text-xs text-muted-foreground">Status do pagamento</p>
              <div className="mt-1"><PagamentoStatusBadge status={p.status} /></div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estágio do agendamento</p>
              <div className="mt-1">
                <PagamentoFunilBadge
                  pagamentoConcluidoEm={p.pagamentoConcluidoEm}
                  confirmadoEm={p.confirmadoEm}
                  erroConfirmacao={p.erroConfirmacao}
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor (recebido integralmente pelo médico)</p>
              <p className="mt-1 text-lg font-bold">{p.moeda} {formatarValor(p.valor)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paciente</p>
              <p className="mt-1 font-medium">{p.pacienteNome}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recebido por</p>
              <p className="mt-1 font-medium">{p.medicoNome}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Criado em</p>
              <p className="mt-1">{new Date(p.createdAt).toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pago em</p>
              <p className="mt-1">{p.pagoEm ? new Date(p.pagoEm).toLocaleString('pt-BR') : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gateway</p>
              <p className="mt-1">{p.gatewayProvider ?? 'Aguardando integração'}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Rastreamento do funil</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Iniciou o agendamento</p>
                <p className="mt-0.5 text-sm">{new Date(p.iniciadoEm).toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Iniciou o pagamento</p>
                <p className="mt-0.5 text-sm">
                  {p.pagamentoIniciadoEm ? new Date(p.pagamentoIniciadoEm).toLocaleString('pt-BR') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Concluiu a etapa de pagamento</p>
                <p className="mt-0.5 text-sm">
                  {p.pagamentoConcluidoEm ? new Date(p.pagamentoConcluidoEm).toLocaleString('pt-BR') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Agendamento confirmado</p>
                <p className="mt-0.5 text-sm">
                  {p.confirmadoEm ? new Date(p.confirmadoEm).toLocaleString('pt-BR') : '—'}
                </p>
              </div>
            </div>
            {p.consultaId && (
              <p className="mt-3 text-xs text-muted-foreground">
                Consulta vinculada: <span className="font-mono">{p.consultaId}</span>
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Alterar status do pagamento</p>
            <PagamentoStatusForm pagamentoId={p.id} statusAtual={p.status} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
