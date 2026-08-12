import { buscarResumoAlertas, listarAlertas } from '@/app/(admin)/_actions/alertas';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { DispararManualBtn } from './_components/disparar-manual-btn';
import type { AlertaMedicacao, AlertaLicenca, AlertaMensalidade } from '@/lib/alertas/coletor';

export default async function AlertasDashboardPage() {
  const resumo = await buscarResumoAlertas();
  const alertas = await listarAlertas();

  const dadosResumo = resumo.sucesso ? resumo.dados : { criticos: 0, atencao: 0, ativosMed: 0, ativosLic: 0, ativosMen: 0 };
  const dadosAlertas = alertas.sucesso ? alertas.dados : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-verde-musgo">
            Central de Alertas
          </h1>
          <p className="text-muted-foreground">
            Monitoramento inteligente de medicamentos, licenças e mensalidades.
          </p>
        </div>
        
        <DispararManualBtn />
      </div>

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
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-creme/50 text-verde-musgo">
                  <tr>
                    <th className="px-4 py-3">Prioridade</th>
                    <th className="px-4 py-3">Paciente</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Detalhe</th>
                    <th className="px-4 py-3">Contato</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosAlertas.map((alerta: AlertaMedicacao | AlertaLicenca | AlertaMensalidade, i: number) => (
                    <tr key={i} className="border-b border-creme hover:bg-creme/20">
                      <td className="px-4 py-3">
                        {alerta.prioridade === 'critico' && <Badge variant="destructive">Crítico</Badge>}
                        {alerta.prioridade === 'atencao' && <Badge className="bg-amber-500 hover:bg-amber-600">Atenção</Badge>}
                        {alerta.prioridade === 'aviso' && <Badge className="bg-blue-500 hover:bg-blue-600">Aviso</Badge>}
                      </td>
                      <td className="px-4 py-3 font-medium">{alerta.pacienteNome}</td>
                      <td className="px-4 py-3 capitalize">{alerta.tipo.replace('_', ' ')}</td>
                      <td className="px-4 py-3">
                        {alerta.tipo === 'medicacao' && (
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs text-verde-musgo truncate max-w-[200px]" title={(alerta as AlertaMedicacao).medicamento}>
                              {(alerta as AlertaMedicacao).medicamento}
                            </span>
                            <span className="text-xs">
                              Termina em {alerta.diasRestantes} dias ({format(new Date((alerta as AlertaMedicacao).dataFim), 'dd/MM/yyyy')})
                            </span>
                          </div>
                        )}
                        {alerta.tipo === 'licenca_anvisa' && (
                          <div className="text-xs">
                            Vence em {alerta.diasRestantes} dias ({format(new Date((alerta as AlertaLicenca).dataValidade), 'dd/MM/yyyy')})
                          </div>
                        )}
                        {alerta.tipo === 'mensalidade' && (
                          <div className="text-xs">
                            Atraso de {(alerta as AlertaMensalidade).diasAtraso} dias (Venceu {format(new Date((alerta as AlertaMensalidade).dataVencimento), 'dd/MM/yyyy')})
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div>{alerta.pacienteTelefone || 'N/A'}</div>
                        <div className="text-muted-foreground">{alerta.pacienteEmail}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
