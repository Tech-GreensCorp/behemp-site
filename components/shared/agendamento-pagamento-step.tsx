'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, CreditCard, Video } from 'lucide-react';

function formatarValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface AgendamentoPagamentoStepProps {
  meetLink: string;
  valor: number | null;
  moeda: string;
}

/**
 * Última tela do wizard: confirma a consulta e mostra o pagamento.
 * Só layout — nenhuma requisição própria. O valor e o status exibidos aqui já foram
 * registrados nas etapas anteriores (reserva + confirmação); esta tela só lê o que o
 * componente pai já tem em memória. Fica pronta para, quando o Gather existir, virar
 * o checkout de verdade sem mudar o resto do fluxo.
 */
export function AgendamentoPagamentoStep({ meetLink, valor, moeda }: AgendamentoPagamentoStepProps) {
  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold">Consulta confirmada!</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {meetLink
              ? 'Você receberá um e-mail de confirmação com os detalhes e o link do Google Meet.'
              : 'Você receberá um e-mail de confirmação com os detalhes — o link da videochamada será enviado em breve.'}
          </p>
          {meetLink && (
            <a href={meetLink} target="_blank" rel="noopener noreferrer" className="mt-5">
              <Button className="gap-2">
                <Video size={16} />
                Acessar Google Meet
              </Button>
            </a>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard size={16} className="text-primary" />
            Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Valor da consulta</span>
            <span className="text-lg font-bold">
              {valor !== null ? `${moeda} ${formatarValor(valor)}` : 'A confirmar'}
            </span>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            Sua consulta já está garantida
          </Badge>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Em breve você poderá pagar diretamente por aqui. Por enquanto, não precisa se
            preocupar com o pagamento — entraremos em contato assim que estiver disponível.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
