import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pill, ShoppingCart, AlertTriangle, Calendar } from 'lucide-react';

const MEDICAMENTOS_MOCK = [
  {
    id: '1',
    nome: 'CBD Full Spectrum 3000mg',
    dosagem: '15 gotas/dia',
    frasco: '30ml',
    diasRestantes: 12,
    dataInicio: '2026-03-20',
    previsaoTermino: '2026-05-16',
    ativa: true,
  },
  {
    id: '2',
    nome: 'CBD Isolado 1000mg',
    dosagem: '10 gotas/dia',
    frasco: '30ml',
    diasRestantes: 0,
    dataInicio: '2026-01-20',
    previsaoTermino: '2026-03-20',
    ativa: false,
  },
];

export default function MedicamentosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Medicamentos</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe seus medicamentos e solicite recompra
        </p>
      </div>

      <div className="space-y-4">
        {MEDICAMENTOS_MOCK.map((med) => (
          <Card key={med.id} className={`border-0 shadow-sm ${!med.ativa ? 'opacity-60' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Pill className="h-5 w-5 text-primary" />
                  {med.nome}
                </CardTitle>
                {med.ativa ? <Badge>Ativa</Badge> : <Badge variant="outline">Encerrada</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Dosagem</p>
                  <p className="text-sm font-medium">{med.dosagem}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Frasco</p>
                  <p className="text-sm font-medium">{med.frasco}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Previsão de término</p>
                  <p className="text-sm font-medium">
                    {new Date(med.previsaoTermino).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              {med.ativa && (
                <>
                  {/* Barra de progresso */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Consumo</span>
                      <span>{med.diasRestantes} dias restantes</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.round((1 - med.diasRestantes / 40) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {med.diasRestantes <= 15 && (
                    <div className="flex items-center justify-between rounded-xl bg-amber-50 p-4 dark:bg-amber-500/10">
                      <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Medicamento acabando em {med.diasRestantes} dias</span>
                      </div>
                      <Button size="sm" className="gap-1.5">
                        <ShoppingCart className="h-4 w-4" />
                        Solicitar recompra
                      </Button>
                    </div>
                  )}
                </>
              )}

              {!med.ativa && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {new Date(med.dataInicio).toLocaleDateString('pt-BR')} —{' '}
                    {new Date(med.previsaoTermino).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
