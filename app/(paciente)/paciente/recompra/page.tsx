'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  MedicineBottle01Icon,
  Calendar01Icon,
  ShoppingCart01Icon,
  CheckmarkCircle01Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';
import { listarDosagens } from '@/app/_actions/dosagens';
import { pedirRecompraAgora, agendarRecompra } from '@/app/_actions/recompras';
import { toast } from 'sonner';

/**
 * Página de recompra de medicamento do paciente.
 *
 * Fórmula (CLAUDE.md):
 *   gotas_totais = ml_frasco × gotas_por_ml (padrão 20)
 *   dias_duracao = gotas_totais / gotas_por_dia
 *   data_termino = data_inicio + dias_duracao
 */

interface DosagemInfo {
  id: string;
  medicamentoNome: string;
  gotasPorDia: number;
  mlFrasco: number;
  dataInicio: string;
  dataFimPrevista: string;
  ativa: boolean;
}

export default function RecompraPage() {
  const [dosagens, setDosagens] = useState<DosagemInfo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);

  useEffect(() => {
    carregarDosagens();
  }, []);

  async function carregarDosagens() {
    // TODO: usar pacienteId do usuario autenticado
    // Por enquanto a action lista todas (será filtrada quando o paciente estiver vinculado)
    setCarregando(false);
  }

  async function handlePedirAgora(dosagemId: string) {
    setProcessando(dosagemId);
    const resultado = await pedirRecompraAgora({ dosagemId });
    setProcessando(null);

    if (resultado.sucesso) {
      toast.success('Pedido de recompra enviado com sucesso!');
    } else {
      toast.error(resultado.erro || 'Erro ao pedir recompra');
    }
  }

  async function handleAgendar(dosagemId: string) {
    setProcessando(dosagemId);
    const resultado = await agendarRecompra({ dosagemId });
    setProcessando(null);

    if (resultado.sucesso) {
      toast.success('Recompra agendada! Você será notificado na data prevista.');
    } else {
      toast.error(resultado.erro || 'Erro ao agendar recompra');
    }
  }

  function calcularDiasRestantes(dataFim: string): number {
    const hoje = new Date();
    const fim = new Date(dataFim);
    const diff = fim.getTime() - hoje.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  if (carregando) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recompra de Medicamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe suas dosagens ativas e solicite recompra quando necessário
        </p>
      </div>

      {/* Explicação */}
      <Card className="border-0 bg-primary/5 shadow-sm">
        <CardContent className="flex items-start gap-4 p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <HugeiconsIcon icon={MedicineBottle01Icon} size={20} className="text-primary" />
          </div>
          <div>
            <p className="font-medium">Como funciona?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              O sistema calcula automaticamente quando seu medicamento vai acabar com base
              no tamanho do frasco (ml) e na quantidade de gotas por dia. Você pode pedir
              a recompra agora ou agendar para ser notificado na data ideal.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Dosagens ativas */}
      {dosagens.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HugeiconsIcon icon={MedicineBottle01Icon} size={48} className="mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium">Nenhuma dosagem ativa</p>
            <p className="text-sm text-muted-foreground">
              Quando seu médico registrar uma dosagem, ela aparecerá aqui para controle de recompra.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {dosagens.filter((d) => d.ativa).map((dosagem) => {
            const diasRestantes = calcularDiasRestantes(dosagem.dataFimPrevista);
            const urgente = diasRestantes <= 7;
            const atencao = diasRestantes <= 14;

            return (
              <Card key={dosagem.id} className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{dosagem.medicamentoNome}</CardTitle>
                    <Badge
                      variant={urgente ? 'destructive' : atencao ? 'secondary' : 'outline'}
                    >
                      {diasRestantes <= 0
                        ? 'Expirado'
                        : `${diasRestantes} dias restantes`}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={MedicineBottle01Icon} size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Frasco</p>
                        <p className="text-sm font-medium">{dosagem.mlFrasco} ml</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">💧</span>
                      <div>
                        <p className="text-xs text-muted-foreground">Gotas/dia</p>
                        <p className="text-sm font-medium">{dosagem.gotasPorDia}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={Calendar01Icon} size={16} className="text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Previsão de término</p>
                        <p className="text-sm font-medium">
                          {new Date(dosagem.dataFimPrevista).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div className="mt-4">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          urgente ? 'bg-destructive' : atencao ? 'bg-amber-500' : 'bg-primary'
                        }`}
                        style={{
                          width: `${Math.max(0, Math.min(100, 100 - (diasRestantes / 30) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="mt-4 flex gap-3">
                    <Button
                      size="sm"
                      onClick={() => handlePedirAgora(dosagem.id)}
                      disabled={processando === dosagem.id}
                      className="gap-2"
                    >
                      {processando === dosagem.id ? (
                        <HugeiconsIcon icon={Loading03Icon} size={16} className="animate-spin" />
                      ) : (
                        <HugeiconsIcon icon={ShoppingCart01Icon} size={16} />
                      )}
                      Pedir agora
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAgendar(dosagem.id)}
                      disabled={processando === dosagem.id}
                      className="gap-2"
                    >
                      <HugeiconsIcon icon={Calendar01Icon} size={16} />
                      Pedir no futuro
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
