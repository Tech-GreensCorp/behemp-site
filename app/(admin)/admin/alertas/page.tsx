import { buscarResumoAlertas, listarAlertas } from '@/app/(admin)/_actions/alertas';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { DispararManualBtn } from './_components/disparar-manual-btn';
import { PageHeader } from '@/components/shared/page-header';
import { DataList, DataRow } from '@/components/shared/data-list';
import type { AlertaMedicacao, AlertaLicenca, AlertaMensalidade } from '@/lib/alertas/coletor';

export default async function AlertasDashboardPage() {
  const resumo = await buscarResumoAlertas();
  const alertas = await listarAlertas();

  const dadosResumo = resumo.sucesso ? resumo.dados : { criticos: 0, atencao: 0, ativosMed: 0, ativosLic: 0, ativosMen: 0 };
  const dadosAlertas = alertas.sucesso ? alertas.dados : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Controle"
        title="Central de Alertas"
        description="Monitoramento inteligente de medicamentos, licenças e mensalidades."
        actions={<DispararManualBtn />}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-red-50 border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-900">Alertas Críticos</CardTitle>
            <span className="text-red-500 text-lg">🔴</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{dadosResumo?.criticos || 0}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-900">Em Atenção</CardTitle>
            <span className="text-amber-500 text-lg">🟡</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{dadosResumo?.atencao || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medicações Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dadosResumo?.ativosMed || 0}</div>
            <p className="text-xs text-muted-foreground">Sendo monitoradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Licenças Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dadosResumo?.ativosLic || 0}</div>
            <p className="text-xs text-muted-foreground">Sendo monitoradas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Painel de Alertas</CardTitle>
          <CardDescription>
            Lista de pacientes precisando de atenção.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(!dadosAlertas || dadosAlertas.length === 0) ? (
            <div className="text-center py-10 text-muted-foreground">
              Nenhum alerta pendente no momento. Tudo tranquilo! ✅
            </div>
          ) : (
            <DataList>
              {dadosAlertas.map((alerta: AlertaMedicacao | AlertaLicenca | AlertaMensalidade, i: number) => (
                <DataRow
                  key={i}
                  title={alerta.pacienteNome}
                  subtitle={
                    <>
                      {alerta.tipo === 'medicacao' && (
                        <>
                          {(alerta as AlertaMedicacao).medicamento} — termina em {alerta.diasRestantes} dias (
                          {format(new Date((alerta as AlertaMedicacao).dataFim), 'dd/MM/yyyy')})
                        </>
                      )}
                      {alerta.tipo === 'licenca_anvisa' && (
                        <>
                          Licença vence em {alerta.diasRestantes} dias (
                          {format(new Date((alerta as AlertaLicenca).dataValidade), 'dd/MM/yyyy')})
                        </>
                      )}
                      {alerta.tipo === 'mensalidade' && (
                        <>
                          Atraso de {(alerta as AlertaMensalidade).diasAtraso} dias (venceu{' '}
                          {format(new Date((alerta as AlertaMensalidade).dataVencimento), 'dd/MM/yyyy')})
                        </>
                      )}
                    </>
                  }
                  meta={
                    <>
                      <div>{alerta.pacienteTelefone || 'N/A'}</div>
                      <div>{alerta.pacienteEmail}</div>
                    </>
                  }
                  trailing={
                    <>
                      {alerta.prioridade === 'critico' && <Badge variant="destructive">Crítico</Badge>}
                      {alerta.prioridade === 'atencao' && <Badge className="bg-amber-500 hover:bg-amber-600">Atenção</Badge>}
                      {alerta.prioridade === 'aviso' && <Badge className="bg-blue-500 hover:bg-blue-600">Aviso</Badge>}
                    </>
                  }
                />
              ))}
            </DataList>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
