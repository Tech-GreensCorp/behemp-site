'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Barcode, Clock, CreditCard, QrCode, Wallet } from 'lucide-react';

function formatarValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarContagem(msRestante: number): string {
  if (msRestante <= 0) return '00:00';
  const totalSegundos = Math.floor(msRestante / 1000);
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

interface AgendamentoPagamentoStepProps {
  medicoNome: string;
  dataHora: Date;
  valor: number | null;
  moeda: string;
  /** ISO — prazo para pagar antes da reserva ser liberada automaticamente. */
  expiraEm: string;
  /** Disparado uma única vez quando o prazo chega a zero — quem usa decide o que fazer
   *  (ex.: voltar para a etapa de escolha de horário). */
  onExpirar?: () => void;
}

/**
 * Última etapa do wizard: layout de pagamento (PIX/boleto/cartão), sem integração real
 * de gateway ainda. Nenhum botão aqui dispara cobrança — é só estrutura visual, pronta
 * para plugar o checkout de verdade quando o Gather existir. A consulta continua
 * 'reservada' (aguardando pagamento) até essa integração existir.
 */
export function AgendamentoPagamentoStep({
  medicoNome,
  dataHora,
  valor,
  moeda,
  expiraEm,
  onExpirar,
}: AgendamentoPagamentoStepProps) {
  const [agora, setAgora] = useState(() => Date.now());
  const expirarAvisadoRef = useRef(false);

  useEffect(() => {
    const intervalo = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, []);

  const msRestante = new Date(expiraEm).getTime() - agora;
  const expirado = msRestante <= 0;
  const valorFormatado = valor !== null ? `${moeda} ${formatarValor(valor)}` : 'A confirmar';

  useEffect(() => {
    if (expirado && !expirarAvisadoRef.current) {
      expirarAvisadoRef.current = true;
      onExpirar?.();
    }
  }, [expirado, onExpirar]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-4 py-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Wallet size={26} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Falta pagar para confirmar sua consulta</h2>
              <p className="text-sm text-muted-foreground">
                Seu horário com <strong className="text-foreground">{medicoNome}</strong> está
                reservado — a consulta só é confirmada após o pagamento.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-border/60 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Consulta</p>
              <p className="text-sm font-semibold">
                {format(dataHora, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="text-sm font-semibold">{valorFormatado}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prazo para pagar</p>
              <p className="text-sm font-semibold">
                {format(new Date(expiraEm), 'HH:mm', { locale: ptBR })}
              </p>
            </div>
          </div>

          <div
            className={`flex items-center gap-3 rounded-xl border p-4 ${
              expirado
                ? 'border-destructive/40 bg-destructive/5'
                : 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'
            }`}
          >
            {expirado ? (
              <AlertTriangle size={18} className="shrink-0 text-destructive" />
            ) : (
              <Clock size={18} className="shrink-0 text-amber-700 dark:text-amber-400" />
            )}
            <div className="flex-1">
              <p
                className={`text-sm font-semibold ${
                  expirado ? 'text-destructive' : 'text-amber-800 dark:text-amber-400'
                }`}
              >
                {expirado
                  ? 'O prazo para pagamento acabou'
                  : `Tempo restante para pagar: ${formatarContagem(msRestante)}`}
              </p>
              <p
                className={`text-xs ${
                  expirado ? 'text-destructive/80' : 'text-amber-700/80 dark:text-amber-400/70'
                }`}
              >
                {expirado
                  ? 'Sua reserva pode já ter sido liberada. Volte à etapa de agendamento para escolher um novo horário.'
                  : 'Se o pagamento não for concluído até o prazo, a reserva é liberada automaticamente e o horário volta a ficar disponível.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard size={16} className="text-primary" />
            Forma de pagamento
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Escolha como prefere pagar. Nenhuma cobrança é feita agora — a integração de
            pagamento ainda está em desenvolvimento.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pix">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pix">PIX</TabsTrigger>
              <TabsTrigger value="boleto">Boleto</TabsTrigger>
              <TabsTrigger value="credito">Crédito</TabsTrigger>
              <TabsTrigger value="debito">Débito</TabsTrigger>
            </TabsList>

            <TabsContent value="pix" className="mt-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40">
                  <QrCode size={56} className="text-muted-foreground/50" />
                </div>
                <div className="flex-1 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Escaneie o QR Code com o app do seu banco ou copie o código PIX abaixo.
                  </p>
                  <div className="flex gap-2">
                    <Input readOnly disabled value="pix copia-e-cola indisponível ainda" className="text-xs" />
                    <Button variant="outline" disabled>
                      Copiar
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="boleto" className="mt-6">
              <div className="space-y-3">
                <Label>Linha digitável</Label>
                <Input readOnly disabled value="00000.00000 00000.000000 00000.000000 0 00000000000000" className="text-xs" />
                <div className="flex items-center gap-2">
                  <Barcode size={16} className="text-muted-foreground" />
                  <Button variant="outline" disabled>
                    Baixar boleto
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Boletos costumam levar até 2 dias úteis para compensar — considere o prazo da
                  reserva antes de escolher esta opção.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="credito" className="mt-6">
              <div className="max-w-xs space-y-4">
                <div className="space-y-1.5">
                  <Label>Número do cartão</Label>
                  <Input disabled placeholder="0000 0000 0000 0000" />
                </div>
                <div className="flex gap-3">
                  <div className="w-24 space-y-1.5">
                    <Label>Validade</Label>
                    <Input disabled placeholder="MM/AA" />
                  </div>
                  <div className="w-20 space-y-1.5">
                    <Label>CVV</Label>
                    <Input disabled placeholder="123" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Nome impresso no cartão</Label>
                  <Input disabled placeholder="Nome completo" />
                </div>
                <Button disabled className="w-full">
                  Pagar com cartão de crédito
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="debito" className="mt-6">
              <div className="max-w-xs space-y-4">
                <div className="space-y-1.5">
                  <Label>Número do cartão</Label>
                  <Input disabled placeholder="0000 0000 0000 0000" />
                </div>
                <div className="flex gap-3">
                  <div className="w-24 space-y-1.5">
                    <Label>Validade</Label>
                    <Input disabled placeholder="MM/AA" />
                  </div>
                  <div className="w-20 space-y-1.5">
                    <Label>CVV</Label>
                    <Input disabled placeholder="123" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Nome impresso no cartão</Label>
                  <Input disabled placeholder="Nome completo" />
                </div>
                <Button disabled className="w-full">
                  Pagar com cartão de débito
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
